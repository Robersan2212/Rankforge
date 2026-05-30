import os
import re
from typing import Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from apps.api.auth import get_current_user

router = APIRouter(prefix="/api/projects", tags=["projects"])


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


def slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_-]+", "-", slug)
    return slug.strip("-") or "project"


async def get_db():
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])
    try:
        yield conn
    finally:
        await conn.close()


def _row_to_dict(row: asyncpg.Record) -> dict[str, Any]:
    data = dict(row)
    for key, value in data.items():
        if isinstance(value, UUID):
            data[key] = str(value)
    return data


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


@router.post("", status_code=201)
async def create_project(
    body: ProjectCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
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


@router.get("/{project_id}/audits")
async def list_project_audits(
    project_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    project = await db.fetchrow(
        "SELECT id FROM public.projects WHERE id = $1 AND user_id = $2",
        project_id,
        current_user["id"],
    )
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    rows = await db.fetch(
        "SELECT * FROM public.audits WHERE project_id = $1 ORDER BY created_at DESC",
        project_id,
    )
    return [_row_to_dict(r) for r in rows]


class AuditCreate(BaseModel):
    url: str = Field(min_length=1)


@router.post("/{project_id}/audits", status_code=201)
async def create_project_audit(
    project_id: str,
    body: AuditCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    project = await db.fetchrow(
        "SELECT id FROM public.projects WHERE id = $1 AND user_id = $2",
        project_id,
        current_user["id"],
    )
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    row = await db.fetchrow(
        """INSERT INTO public.audits (project_id, url, results, seo_score)
           VALUES ($1, $2, '{}'::jsonb, 0) RETURNING *""",
        project_id,
        body.url,
    )
    return _row_to_dict(row)
