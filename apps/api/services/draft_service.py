"""Draft persistence and brief loading for FR-06."""

from __future__ import annotations

import json
from typing import Any

from fastapi import HTTPException

from apps.api.agents.policy import get_draft_model
from apps.api.prompts.full_draft import DraftBriefInput, parse_brief_payload


def count_words(text: str) -> int:
    stripped = text.strip()
    if not stripped:
        return 0
    return len(stripped.split())


async def load_brief_for_generation(
    db, project_id: str, brief_id: str
) -> DraftBriefInput:
    row = await db.fetchrow(
        "SELECT content FROM public.briefs WHERE id = $1 AND project_id = $2",
        brief_id,
        project_id,
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Brief not found")

    content = row["content"]
    if isinstance(content, str):
        try:
            content = json.loads(content)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=400, detail="Brief content is not valid JSON"
            ) from exc

    if not isinstance(content, dict):
        raise HTTPException(status_code=400, detail="Brief content is missing")

    try:
        return parse_brief_payload(content)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Brief content is incomplete for draft generation: {exc}",
        ) from exc


async def create_or_get_draft(
    db,
    *,
    project_id: str,
    brief_id: str,
    draft_id: str | None,
    title: str,
) -> dict[str, Any]:
    if draft_id:
        row = await db.fetchrow(
            """SELECT * FROM public.drafts
               WHERE id = $1 AND project_id = $2""",
            draft_id,
            project_id,
        )
        if row is None:
            raise HTTPException(status_code=404, detail="Draft not found")
        await db.execute(
            """UPDATE public.drafts
               SET status = 'generating', brief_id = $2::uuid, updated_at = now()
               WHERE id = $1""",
            draft_id,
            brief_id,
        )
        updated = await db.fetchrow(
            "SELECT * FROM public.drafts WHERE id = $1",
            draft_id,
        )
        return dict(updated)

    row = await db.fetchrow(
        """INSERT INTO public.drafts (project_id, brief_id, title, content, status)
           VALUES ($1, $2::uuid, $3, '', 'generating')
           RETURNING *""",
        project_id,
        brief_id,
        title,
    )
    return dict(row)


async def save_completed_draft(
    db,
    *,
    draft_id: str,
    content: str,
    model: str | None = None,
    word_count: int,
) -> dict[str, Any]:
    model = model or get_draft_model()
    row = await db.fetchrow(
        """UPDATE public.drafts
           SET content = $2,
               status = 'completed',
               generation_model = $3,
               word_count = $4,
               generated_at = now(),
               updated_at = now()
           WHERE id = $1
           RETURNING *""",
        draft_id,
        content,
        model,
        word_count,
    )
    return dict(row)


async def save_partial_draft(
    db,
    *,
    draft_id: str,
    content: str,
    model: str | None = None,
    word_count: int,
    failed: bool = False,
) -> dict[str, Any]:
    model = model or get_draft_model()
    status = "failed" if failed and not content.strip() else "partial"
    row = await db.fetchrow(
        """UPDATE public.drafts
           SET content = $2,
               status = $3,
               generation_model = $4,
               word_count = $5,
               generated_at = now(),
               updated_at = now()
           WHERE id = $1
           RETURNING *""",
        draft_id,
        content,
        status,
        model,
        word_count,
    )
    return dict(row)
