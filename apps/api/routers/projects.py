import json
import os
import re
from datetime import datetime
from typing import Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field

from apps.api.auth import get_current_user
from apps.api.env import load_env_file
from apps.api.rate_limit import (
    check_brief_rate_limit,
    check_competitor_rate_limit,
    check_keyword_refresh_rate_limit,
    check_rate_limit,
)
from apps.api.services.brief_errors import BriefGenerationError
from apps.api.services.brief_pipeline import generate_and_persist_brief
from apps.api.services.competitor_pipeline import run_competitor_analysis
from apps.api.services.gsc_metrics import augment_audit_report
from apps.api.services.keyword_rankings import check_and_persist_ranking
from apps.api.services.page_auditor import run_audit

load_env_file()

router = APIRouter(prefix="/api/projects", tags=["projects"])



class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class AuditCreate(BaseModel):
    url: str = Field(min_length=1)


class BriefCreate(BaseModel):
    keyword: str = Field(min_length=1)
    title: str | None = None


class BriefGenerateCreate(BaseModel):
    audit_id: str = Field(min_length=1)
    competitor_analysis_id: str = Field(min_length=1)


class DraftCreate(BaseModel):
    title: str = Field(min_length=1)
    content: str = ""
    brief_id: str | None = None


class DraftUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    brief_id: str | None = None


MAX_DRAFT_CONTENT_LENGTH = 500_000


MAX_KEYWORDS_PER_PROJECT = 25
MAX_KEYWORD_LENGTH = 200


class KeywordCreate(BaseModel):
    keyword: str = Field(min_length=1, max_length=MAX_KEYWORD_LENGTH)
    target_url: str | None = Field(default=None, max_length=2048)


class CompetitorAnalysisCreate(BaseModel):
    keyword: str = Field(min_length=1)
    user_page_url: str = Field(min_length=1)


def slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_-]+", "-", slug)
    return slug.strip("-") or "project"


async def get_db():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise HTTPException(
            status_code=500,
            detail="DATABASE_URL is not configured on the API server",
        )
    conn = await asyncpg.connect(
        database_url,
        ssl="require",
        statement_cache_size=0,
    )
    try:
        yield conn
    finally:
        await conn.close()


def _row_to_dict(row: asyncpg.Record) -> dict[str, Any]:
    data = dict(row)
    for key, value in data.items():
        if isinstance(value, UUID):
            data[key] = str(value)
        elif key in ("report", "results") and isinstance(value, str):
            data["report"] = json.loads(value)
    if "results" in data and "report" not in data:
        data["report"] = data.pop("results")
    elif "results" in data:
        data.pop("results", None)
    return data


def _audit_row_to_dict(row: asyncpg.Record) -> dict[str, Any]:
    data = _row_to_dict(row)
    report = data.get("report")
    if isinstance(report, dict):
        data["report"] = {
            **report,
            "audit_id": data.get("id"),
            "project_id": data.get("project_id"),
        }
    return data


def _brief_row_to_dict(row: asyncpg.Record) -> dict[str, Any]:
    data = _row_to_dict(row)
    content = data.get("content")
    if isinstance(content, str):
        try:
            data["content"] = json.loads(content)
        except json.JSONDecodeError:
            pass
    return data


def _competitor_row_to_dict(row: asyncpg.Record) -> dict[str, Any]:
    data = _row_to_dict(row)
    report = data.get("report")
    if isinstance(report, dict):
        data["report"] = report
    return data


async def _ensure_user_profile(db, user_id: str, email: str) -> None:
    await db.execute(
        """INSERT INTO public.users (id, email)
           VALUES ($1, $2)
           ON CONFLICT (id) DO NOTHING""",
        user_id,
        email or "dev@example.com",
    )


async def _require_owned_project(db, project_id: str, user_id: str) -> None:
    project = await db.fetchrow(
        "SELECT id FROM public.projects WHERE id = $1 AND user_id = $2",
        project_id,
        user_id,
    )
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")


async def _require_project_brief(
    db, project_id: str, brief_id: str | None
) -> None:
    if brief_id is None:
        return
    row = await db.fetchrow(
        "SELECT id FROM public.briefs WHERE id = $1 AND project_id = $2",
        brief_id,
        project_id,
    )
    if row is None:
        raise HTTPException(status_code=400, detail="Brief not found in this project")


def _validate_draft_content(content: str | None) -> None:
    if content is not None and len(content) > MAX_DRAFT_CONTENT_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Draft content exceeds maximum length of {MAX_DRAFT_CONTENT_LENGTH} characters",
        )


@router.get("/stats")
async def get_user_stats(
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    row = await db.fetchrow(
        """
        SELECT
          (SELECT COUNT(*)::int FROM public.projects WHERE user_id = $1) AS projects,
          (SELECT COUNT(*)::int FROM public.audits a
             JOIN public.projects p ON p.id = a.project_id
             WHERE p.user_id = $1) AS audits,
          (SELECT COUNT(*)::int FROM public.briefs b
             JOIN public.projects p ON p.id = b.project_id
             WHERE p.user_id = $1) AS briefs,
          (SELECT COUNT(*)::int FROM public.drafts d
             JOIN public.projects p ON p.id = d.project_id
             WHERE p.user_id = $1) AS drafts,
          (SELECT COUNT(*)::int FROM public.tracked_keywords k
             JOIN public.projects p ON p.id = k.project_id
             WHERE p.user_id = $1) AS keywords
        """,
        current_user["id"],
    )
    return dict(row)


@router.get("")
async def list_projects(
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    rows = await db.fetch(
        "SELECT * FROM public.projects WHERE user_id = $1 ORDER BY created_at DESC",
        current_user["id"],
    )
    return [_row_to_dict(r) for r in rows]


@router.post("", status_code=201)
async def create_project(
    body: ProjectCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    await _ensure_user_profile(db, current_user["id"], current_user.get("email", ""))
    slug = slugify(body.name)
    try:
        row = await db.fetchrow(
            """INSERT INTO public.projects (user_id, name, slug)
               VALUES ($1, $2, $3) RETURNING *""",
            current_user["id"],
            body.name,
            slug,
        )
        return _row_to_dict(row)
    except asyncpg.UniqueViolationError:
        raise HTTPException(
            status_code=409,
            detail="Project with that name already exists",
        )


@router.get("/{project_id}")
async def get_project(
    project_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    row = await db.fetchrow(
        "SELECT * FROM public.projects WHERE id = $1 AND user_id = $2",
        project_id,
        current_user["id"],
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return _row_to_dict(row)


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    result = await db.execute(
        "DELETE FROM public.projects WHERE id = $1 AND user_id = $2",
        project_id,
        current_user["id"],
    )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Project not found")


@router.get("/{project_id}/stats")
async def get_project_stats(
    project_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    await _require_owned_project(db, project_id, current_user["id"])
    row = await db.fetchrow(
        """
        SELECT
          (SELECT COUNT(*)::int FROM public.audits WHERE project_id = $1) AS audits,
          (SELECT COUNT(*)::int FROM public.briefs WHERE project_id = $1) AS briefs,
          (SELECT COUNT(*)::int FROM public.drafts WHERE project_id = $1) AS drafts,
          (SELECT COUNT(*)::int FROM public.tracked_keywords WHERE project_id = $1) AS keywords,
          (SELECT COUNT(*)::int FROM public.competitor_analyses WHERE project_id = $1) AS competitors
        """,
        project_id,
    )
    return dict(row)


@router.get("/{project_id}/audits")
async def list_project_audits(
    project_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    await _require_owned_project(db, project_id, current_user["id"])
    rows = await db.fetch(
        "SELECT * FROM public.audits WHERE project_id = $1 ORDER BY created_at DESC",
        project_id,
    )
    return [_audit_row_to_dict(r) for r in rows]


def _parse_fetched_at(value: str | None) -> datetime | None:
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    return datetime.fromisoformat(normalized)


@router.post("/{project_id}/audits", status_code=201)
async def create_project_audit(
    project_id: str,
    body: AuditCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    await _require_owned_project(db, project_id, current_user["id"])
    check_rate_limit(current_user["id"])

    try:
        report = await run_audit(body.url, project_id=project_id)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Audit failed: {exc}",
        ) from exc

    fetched_at = _parse_fetched_at(report.get("fetched_at"))
    seo_score = int(report.get("seo_score") or 0)
    audited_url = report.get("url", body.url)
    report_payload = {
        **report,
        "project_id": project_id,
    }
    report_payload = await augment_audit_report(
        db,
        project_id=project_id,
        audited_url=audited_url,
        report=report_payload,
    )
    report_json = json.dumps(report_payload)

    try:
        row = await db.fetchrow(
            """INSERT INTO public.audits (project_id, url, report, seo_score, fetched_at)
               VALUES ($1, $2, $3::jsonb, $4, $5) RETURNING *""",
            project_id,
            audited_url,
            report_json,
            seo_score,
            fetched_at,
        )
    except asyncpg.UndefinedColumnError:
        row = await db.fetchrow(
            """INSERT INTO public.audits (project_id, url, results, seo_score, fetched_at)
               VALUES ($1, $2, $3::jsonb, $4, $5) RETURNING *""",
            project_id,
            audited_url,
            report_json,
            seo_score,
            fetched_at,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save audit: {exc}",
        ) from exc

    return _audit_row_to_dict(row)


@router.get("/{project_id}/audits/{audit_id}")
async def get_project_audit(
    project_id: str,
    audit_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    await _require_owned_project(db, project_id, current_user["id"])
    row = await db.fetchrow(
        """SELECT * FROM public.audits
           WHERE id = $1 AND project_id = $2""",
        audit_id,
        project_id,
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Audit not found")
    return _audit_row_to_dict(row)


@router.delete("/{project_id}/audits/{audit_id}", status_code=204)
async def delete_project_audit(
    project_id: str,
    audit_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    await _require_owned_project(db, project_id, current_user["id"])
    result = await db.execute(
        "DELETE FROM public.audits WHERE id = $1 AND project_id = $2",
        audit_id,
        project_id,
    )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Audit not found")


@router.get("/{project_id}/briefs")
async def list_project_briefs(
    project_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    await _require_owned_project(db, project_id, current_user["id"])
    rows = await db.fetch(
        "SELECT * FROM public.briefs WHERE project_id = $1 ORDER BY created_at DESC",
        project_id,
    )
    return [_brief_row_to_dict(r) for r in rows]


@router.post("/{project_id}/briefs/generate", status_code=201)
async def generate_project_brief(
    project_id: str,
    body: BriefGenerateCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    await _require_owned_project(db, project_id, current_user["id"])
    check_brief_rate_limit(current_user["id"])

    try:
        row = await generate_and_persist_brief(
            db,
            project_id=project_id,
            user_id=current_user["id"],
            audit_id=body.audit_id,
            competitor_analysis_id=body.competitor_analysis_id,
        )
    except BriefGenerationError as exc:
        status_code = 422 if "missing" in exc.user_message.lower() else 503
        raise HTTPException(status_code=status_code, detail=exc.user_message) from exc
    except asyncpg.PostgresError as exc:
        raise HTTPException(
            status_code=500,
            detail="Brief generation failed due to a database error.",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Brief generation failed. Please try again.",
        ) from exc

    return _brief_row_to_dict(row)


@router.get("/{project_id}/briefs/{brief_id}")
async def get_project_brief(
    project_id: str,
    brief_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    await _require_owned_project(db, project_id, current_user["id"])
    row = await db.fetchrow(
        """SELECT * FROM public.briefs
           WHERE id = $1 AND project_id = $2""",
        brief_id,
        project_id,
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Brief not found")
    return _brief_row_to_dict(row)


@router.delete("/{project_id}/briefs/{brief_id}", status_code=204)
async def delete_project_brief(
    project_id: str,
    brief_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    await _require_owned_project(db, project_id, current_user["id"])
    result = await db.execute(
        "DELETE FROM public.briefs WHERE id = $1 AND project_id = $2",
        brief_id,
        project_id,
    )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Brief not found")


@router.post("/{project_id}/briefs", status_code=201)
async def create_project_brief(
    project_id: str,
    body: BriefCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    await _require_owned_project(db, project_id, current_user["id"])
    content = json.dumps({"title": body.title}) if body.title else None
    row = await db.fetchrow(
        """INSERT INTO public.briefs (project_id, keyword, content)
           VALUES ($1, $2, $3::jsonb) RETURNING *""",
        project_id,
        body.keyword,
        content,
    )
    return _brief_row_to_dict(row)


@router.get("/{project_id}/drafts")
async def list_project_drafts(
    project_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    await _require_owned_project(db, project_id, current_user["id"])
    rows = await db.fetch(
        "SELECT * FROM public.drafts WHERE project_id = $1 ORDER BY updated_at DESC",
        project_id,
    )
    return [_row_to_dict(r) for r in rows]


@router.post("/{project_id}/drafts", status_code=201)
async def create_project_draft(
    project_id: str,
    body: DraftCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    await _require_owned_project(db, project_id, current_user["id"])
    _validate_draft_content(body.content)
    await _require_project_brief(db, project_id, body.brief_id)
    row = await db.fetchrow(
        """INSERT INTO public.drafts (project_id, brief_id, title, content)
           VALUES ($1, $2::uuid, $3, $4) RETURNING *""",
        project_id,
        body.brief_id,
        body.title,
        body.content,
    )
    return _row_to_dict(row)


@router.get("/{project_id}/drafts/{draft_id}")
async def get_project_draft(
    project_id: str,
    draft_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    await _require_owned_project(db, project_id, current_user["id"])
    row = await db.fetchrow(
        """SELECT * FROM public.drafts
           WHERE id = $1 AND project_id = $2""",
        draft_id,
        project_id,
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Draft not found")
    return _row_to_dict(row)


@router.patch("/{project_id}/drafts/{draft_id}")
async def update_project_draft(
    project_id: str,
    draft_id: str,
    body: DraftUpdate,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    await _require_owned_project(db, project_id, current_user["id"])

    updates = body.model_dump(exclude_unset=True)
    if not updates:
        row = await db.fetchrow(
            "SELECT * FROM public.drafts WHERE id = $1 AND project_id = $2",
            draft_id,
            project_id,
        )
        if row is None:
            raise HTTPException(status_code=404, detail="Draft not found")
        return _row_to_dict(row)

    if "content" in updates:
        _validate_draft_content(updates["content"])
    if "brief_id" in updates:
        await _require_project_brief(db, project_id, updates["brief_id"])

    existing = await db.fetchrow(
        """SELECT id FROM public.drafts
           WHERE id = $1 AND project_id = $2""",
        draft_id,
        project_id,
    )
    if existing is None:
        raise HTTPException(status_code=404, detail="Draft not found")

    set_clauses: list[str] = []
    values: list[Any] = []
    idx = 1

    for field in ("title", "content"):
        if field in updates:
            set_clauses.append(f"{field} = ${idx}")
            values.append(updates[field])
            idx += 1

    if "brief_id" in updates:
        set_clauses.append(f"brief_id = ${idx}::uuid")
        values.append(updates["brief_id"])
        idx += 1

    set_clauses.append("updated_at = now()")
    values.extend([draft_id, project_id])

    row = await db.fetchrow(
        f"""UPDATE public.drafts
            SET {", ".join(set_clauses)}
            WHERE id = ${idx} AND project_id = ${idx + 1}
            RETURNING *""",
        *values,
    )
    return _row_to_dict(row)


def _normalize_keyword(value: str) -> str:
    return " ".join(value.strip().split())


def _keyword_row_to_dict(row: asyncpg.Record) -> dict[str, Any]:
    data = _row_to_dict(row)
    if "latest_position" in data and data["latest_position"] is not None:
        data["latest_position"] = int(data["latest_position"])
    if "latest_checked_at" in data and data["latest_checked_at"] is not None:
        checked = data["latest_checked_at"]
        if isinstance(checked, datetime):
            data["latest_checked_at"] = checked.isoformat()
    return data


@router.get("/{project_id}/keywords")
async def list_project_keywords(
    project_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    await _require_owned_project(db, project_id, current_user["id"])
    try:
        rows = await db.fetch(
            """SELECT tk.*,
                      lr.position AS latest_position,
                      lr.checked_at AS latest_checked_at,
                      lr.source AS latest_source
               FROM public.tracked_keywords tk
               LEFT JOIN LATERAL (
                 SELECT position, checked_at, source
                 FROM public.keyword_rankings
                 WHERE tracked_keyword_id = tk.id
                 ORDER BY checked_at DESC
                 LIMIT 1
               ) lr ON true
               WHERE tk.project_id = $1 AND tk.is_active = true
               ORDER BY tk.created_at DESC""",
            project_id,
        )
    except asyncpg.UndefinedTableError:
        rows = await db.fetch(
            """SELECT * FROM public.tracked_keywords
               WHERE project_id = $1 ORDER BY created_at DESC""",
            project_id,
        )
    except asyncpg.UndefinedColumnError:
        rows = await db.fetch(
            """SELECT * FROM public.tracked_keywords
               WHERE project_id = $1 ORDER BY created_at DESC""",
            project_id,
        )
    return [_keyword_row_to_dict(r) for r in rows]


@router.post("/{project_id}/keywords", status_code=201)
async def create_project_keyword(
    project_id: str,
    body: KeywordCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    await _require_owned_project(db, project_id, current_user["id"])
    keyword = _normalize_keyword(body.keyword)
    if not keyword:
        raise HTTPException(status_code=422, detail="Keyword is required")

    target_url = (body.target_url or "").strip() or None

    try:
        active_count = await db.fetchval(
            """SELECT COUNT(*) FROM public.tracked_keywords
               WHERE project_id = $1 AND is_active = true""",
            project_id,
        )
    except asyncpg.UndefinedColumnError:
        active_count = await db.fetchval(
            """SELECT COUNT(*) FROM public.tracked_keywords
               WHERE project_id = $1""",
            project_id,
        )

    if active_count is not None and int(active_count) >= MAX_KEYWORDS_PER_PROJECT:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Project keyword limit reached "
                f"({MAX_KEYWORDS_PER_PROJECT} max)."
            ),
        )

    try:
        row = await db.fetchrow(
            """INSERT INTO public.tracked_keywords
               (project_id, keyword, target_url, is_active)
               VALUES ($1, $2, $3, true)
               RETURNING *""",
            project_id,
            keyword,
            target_url,
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(
            status_code=409,
            detail="That keyword is already tracked for this project",
        )
    except asyncpg.UndefinedColumnError:
        row = await db.fetchrow(
            """INSERT INTO public.tracked_keywords (project_id, keyword)
               VALUES ($1, $2) RETURNING *""",
            project_id,
            keyword,
        )

    data = _keyword_row_to_dict(row)
    data.setdefault("latest_position", None)
    data.setdefault("latest_checked_at", None)
    data.setdefault("latest_source", None)
    return data


@router.delete("/{project_id}/keywords/{keyword_id}", status_code=204)
async def delete_project_keyword(
    project_id: str,
    keyword_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    await _require_owned_project(db, project_id, current_user["id"])
    try:
        result = await db.execute(
            """UPDATE public.tracked_keywords
               SET is_active = false
               WHERE id = $1 AND project_id = $2 AND is_active = true""",
            keyword_id,
            project_id,
        )
    except asyncpg.UndefinedColumnError:
        result = await db.execute(
            """DELETE FROM public.tracked_keywords
               WHERE id = $1 AND project_id = $2""",
            keyword_id,
            project_id,
        )

    if result == "UPDATE 0" or result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Keyword not found")
    return None


@router.get("/{project_id}/keywords/{keyword_id}/history")
async def get_keyword_ranking_history(
    project_id: str,
    keyword_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    await _require_owned_project(db, project_id, current_user["id"])
    try:
        keyword = await db.fetchrow(
            """SELECT id, keyword, target_url, created_at, is_active
               FROM public.tracked_keywords
               WHERE id = $1 AND project_id = $2""",
            keyword_id,
            project_id,
        )
    except asyncpg.UndefinedColumnError:
        keyword = await db.fetchrow(
            """SELECT * FROM public.tracked_keywords
               WHERE id = $1 AND project_id = $2""",
            keyword_id,
            project_id,
        )
    if keyword is None:
        raise HTTPException(status_code=404, detail="Keyword not found")

    try:
        rows = await db.fetch(
            """SELECT id, tracked_keyword_id, position, checked_at, source
               FROM public.keyword_rankings
               WHERE tracked_keyword_id = $1
               ORDER BY checked_at ASC""",
            keyword_id,
        )
    except asyncpg.UndefinedTableError:
        rows = []

    return {
        "keyword": _keyword_row_to_dict(keyword),
        "history": [_row_to_dict(r) for r in rows],
    }


@router.post("/{project_id}/keywords/{keyword_id}/refresh")
async def refresh_keyword_ranking(
    project_id: str,
    keyword_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    await _require_owned_project(db, project_id, current_user["id"])
    check_keyword_refresh_rate_limit(keyword_id)

    keyword = await db.fetchrow(
        """SELECT id, keyword, target_url, is_active
           FROM public.tracked_keywords
           WHERE id = $1 AND project_id = $2 AND is_active = true""",
        keyword_id,
        project_id,
    )
    if keyword is None:
        raise HTTPException(status_code=404, detail="Keyword not found")

    ranking = await check_and_persist_ranking(
        db,
        tracked_keyword_id=str(keyword["id"]),
        keyword=keyword["keyword"],
        target_url=keyword["target_url"],
        source="manual",
    )
    if ranking is None:
        raise HTTPException(
            status_code=502,
            detail="SERP lookup failed. No ranking was recorded. Try again later.",
        )

    return {
        "keyword": _keyword_row_to_dict(keyword),
        "ranking": _row_to_dict(ranking),
    }


@router.get("/{project_id}/competitor-analyses")
async def list_competitor_analyses(
    project_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    await _require_owned_project(db, project_id, current_user["id"])
    try:
        rows = await db.fetch(
            """SELECT * FROM public.competitor_analyses
               WHERE project_id = $1 ORDER BY created_at DESC""",
            project_id,
        )
    except asyncpg.UndefinedTableError:
        return []
    return [_competitor_row_to_dict(r) for r in rows]


@router.post("/{project_id}/competitor-analyses", status_code=201)
async def create_competitor_analysis(
    project_id: str,
    body: CompetitorAnalysisCreate,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    await _require_owned_project(db, project_id, current_user["id"])
    check_competitor_rate_limit(current_user["id"])

    try:
        row = await db.fetchrow(
            """INSERT INTO public.competitor_analyses
               (project_id, keyword, user_page_url, status)
               VALUES ($1, $2, $3, 'pending') RETURNING *""",
            project_id,
            body.keyword.strip(),
            body.user_page_url.strip(),
        )
    except asyncpg.UndefinedTableError:
        raise HTTPException(
            status_code=503,
            detail=(
                "Competitor analysis tables are missing. Apply migration "
                "0004_competitor_analyses.sql (supabase db push or "
                "python apps/api/scripts/apply_competitor_migration.py)."
            ),
        ) from None

    analysis_id = str(row["id"])
    background_tasks.add_task(run_competitor_analysis, analysis_id)

    return _competitor_row_to_dict(row)


@router.get("/{project_id}/competitor-analyses/{analysis_id}")
async def get_competitor_analysis(
    project_id: str,
    analysis_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    await _require_owned_project(db, project_id, current_user["id"])
    row = await db.fetchrow(
        """SELECT * FROM public.competitor_analyses
           WHERE id = $1 AND project_id = $2""",
        analysis_id,
        project_id,
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Competitor analysis not found")
    return _competitor_row_to_dict(row)


@router.delete("/{project_id}/competitor-analyses/{analysis_id}", status_code=204)
async def delete_competitor_analysis(
    project_id: str,
    analysis_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    await _require_owned_project(db, project_id, current_user["id"])
    result = await db.execute(
        """DELETE FROM public.competitor_analyses
           WHERE id = $1 AND project_id = $2""",
        analysis_id,
        project_id,
    )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Competitor analysis not found")
