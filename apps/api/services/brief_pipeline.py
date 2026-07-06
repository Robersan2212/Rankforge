"""Load upstream data and persist generated briefs (FR-04)."""

from __future__ import annotations

import json
from typing import Any

import asyncpg

from apps.api.models.brief_schema import ContentBrief
from apps.api.services.brief_errors import BriefGenerationError, UpstreamDataMissing
from apps.api.services.brief_generator import generate_content_brief


def _parse_json_field(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def extract_audit_payload(row: asyncpg.Record) -> dict[str, Any]:
    report = _parse_json_field(row.get("report") or row.get("results"))
    if not report:
        raise UpstreamDataMissing("Audit has no report data")
    return report


def extract_competitor_payload(row: asyncpg.Record) -> dict[str, Any]:
    status = row.get("status")
    if status not in ("completed", "partial"):
        raise UpstreamDataMissing(
            f"Competitor analysis is not ready (status={status})"
        )
    report = _parse_json_field(row.get("report"))
    if not report:
        raise UpstreamDataMissing("Competitor analysis has no report data")
    return report


async def load_upstream_data(
    db: asyncpg.Connection,
    *,
    project_id: str,
    audit_id: str,
    competitor_analysis_id: str,
) -> tuple[dict[str, Any], dict[str, Any], str]:
    audit_row = await db.fetchrow(
        """SELECT id, project_id, url, report
           FROM public.audits
           WHERE id = $1 AND project_id = $2""",
        audit_id,
        project_id,
    )
    if audit_row is None:
        raise UpstreamDataMissing("Audit not found for this project")

    competitor_row = await db.fetchrow(
        """SELECT id, project_id, keyword, status, report
           FROM public.competitor_analyses
           WHERE id = $1 AND project_id = $2""",
        competitor_analysis_id,
        project_id,
    )
    if competitor_row is None:
        raise UpstreamDataMissing("Competitor analysis not found for this project")

    audit_data = extract_audit_payload(audit_row)
    competitor_data = extract_competitor_payload(competitor_row)
    keyword = str(competitor_row["keyword"] or "").strip()
    if not keyword:
        raise UpstreamDataMissing("Competitor analysis keyword is missing")

    return audit_data, competitor_data, keyword


def brief_to_content(brief: ContentBrief) -> dict[str, Any]:
    return brief.model_dump()


async def generate_and_persist_brief(
    db: asyncpg.Connection,
    *,
    project_id: str,
    user_id: str,
    audit_id: str,
    competitor_analysis_id: str,
) -> dict[str, Any]:
    audit_data, competitor_data, keyword = await load_upstream_data(
        db,
        project_id=project_id,
        audit_id=audit_id,
        competitor_analysis_id=competitor_analysis_id,
    )

    try:
        brief = await generate_content_brief(
            primary_keyword=keyword,
            audit_data=audit_data,
            competitor_data=competitor_data,
            source_audit_id=audit_id,
            source_competitor_analysis_id=competitor_analysis_id,
        )
    except BriefGenerationError:
        raise
    except Exception as exc:
        raise BriefGenerationError(str(exc)) from exc

    content_json = json.dumps(brief_to_content(brief))

    try:
        row = await db.fetchrow(
            """INSERT INTO public.briefs
               (project_id, keyword, content, source_audit_id,
                source_competitor_analysis_id, created_by, status)
               VALUES ($1, $2, $3::jsonb, $4::uuid, $5::uuid, $6::uuid, 'completed')
               RETURNING *""",
            project_id,
            brief.primary_keyword,
            content_json,
            audit_id,
            competitor_analysis_id,
            user_id,
        )
    except asyncpg.UndefinedColumnError:
        row = await db.fetchrow(
            """INSERT INTO public.briefs (project_id, keyword, content)
               VALUES ($1, $2, $3::jsonb) RETURNING *""",
            project_id,
            brief.primary_keyword,
            content_json,
        )
    except asyncpg.UndefinedTableError as exc:
        raise UpstreamDataMissing(
            "Brief or competitor tables are missing. Apply database migrations."
        ) from exc

    return dict(row)
