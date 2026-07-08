"""SSE endpoint for AI full draft generation (FR-06)."""

from __future__ import annotations

import json
import logging
import os
import time
from collections.abc import AsyncIterator
from typing import Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from apps.api.agents.policy import get_draft_model
from apps.api.auth import get_current_user
from apps.api.prompts.full_draft import parse_brief_payload
from apps.api.rate_limit import (
    check_draft_rate_limit,
    release_generation_lock,
    try_acquire_generation_lock,
)
from apps.api.routers.projects import _require_owned_project, get_db
from apps.api.services.brief_errors import ClaudeAPIError
from apps.api.services.draft_generator import stream_full_draft
from apps.api.services.draft_service import (
    count_words,
    create_or_get_draft,
    load_brief_for_generation,
    save_completed_draft,
    save_partial_draft,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects", tags=["drafts"])


class DraftGenerateRequest(BaseModel):
    brief_id: str = Field(min_length=1)
    draft_id: str | None = None
    brief_payload: dict[str, Any] | None = None


def _sse_event(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _row_id(row: dict[str, Any]) -> str:
    draft_id = row.get("id")
    if isinstance(draft_id, UUID):
        return str(draft_id)
    return str(draft_id)


async def _open_stream_db() -> asyncpg.Connection:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise HTTPException(
            status_code=500,
            detail="DATABASE_URL is not configured on the API server",
        )
    return await asyncpg.connect(
        database_url,
        ssl="require",
        statement_cache_size=0,
    )


async def _generate_events(
    *,
    project_id: str,
    user_id: str,
    body: DraftGenerateRequest,
) -> AsyncIterator[str]:
    brief_id = body.brief_id
    accumulated = ""
    draft_row: dict[str, Any] | None = None
    draft_id: str | None = None
    start_time = time.monotonic()
    first_token_time: float | None = None
    model = get_draft_model()

    if not try_acquire_generation_lock(user_id, brief_id):
        yield _sse_event(
            "error",
            {
                "code": "duplicate_generation",
                "message": "A draft generation is already in progress for this brief.",
            },
        )
        return

    db = await _open_stream_db()
    try:
        if body.brief_payload is not None:
            brief = parse_brief_payload(body.brief_payload)
        else:
            brief = await load_brief_for_generation(db, project_id, brief_id)

        title = brief.primary_keyword
        draft_row = await create_or_get_draft(
            db,
            project_id=project_id,
            brief_id=brief_id,
            draft_id=body.draft_id,
            title=title,
        )
        draft_id = _row_id(draft_row)

        async for token in stream_full_draft(brief):
            if first_token_time is None:
                first_token_time = time.monotonic()
            accumulated += token
            yield _sse_event("token", {"text": token})

        word_count = count_words(accumulated)
        await save_completed_draft(
            db,
            draft_id=draft_id,
            content=accumulated,
            model=model,
            word_count=word_count,
        )

        time_to_first_ms = (
            int((first_token_time - start_time) * 1000)
            if first_token_time is not None
            else None
        )
        yield _sse_event(
            "done",
            {
                "draft_id": draft_id,
                "word_count": word_count,
                "time_to_first_token_ms": time_to_first_ms,
            },
        )
    except ClaudeAPIError as exc:
        logger.warning("draft_generation_claude_error: %s", exc)
        if draft_id and accumulated.strip():
            await save_partial_draft(
                db,
                draft_id=draft_id,
                content=accumulated,
                model=model,
                word_count=count_words(accumulated),
                failed=True,
            )
        yield _sse_event(
            "error",
            {"code": "api_error", "message": exc.user_message},
        )
    except HTTPException as exc:
        yield _sse_event(
            "error",
            {
                "code": "http_error",
                "message": exc.detail if isinstance(exc.detail, str) else str(exc.detail),
            },
        )
    except Exception as exc:
        logger.exception("draft_generation_unexpected_error: %s", type(exc).__name__)
        if draft_id and accumulated.strip():
            await save_partial_draft(
                db,
                draft_id=draft_id,
                content=accumulated,
                model=model,
                word_count=count_words(accumulated),
                failed=True,
            )
        yield _sse_event(
            "error",
            {"code": "api_error", "message": "Draft generation failed. Please try again."},
        )
    finally:
        await db.close()
        release_generation_lock(user_id, brief_id)


@router.post("/{project_id}/drafts/generate")
async def generate_project_draft(
    project_id: str,
    body: DraftGenerateRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    await _require_owned_project(db, project_id, current_user["id"])
    check_draft_rate_limit(current_user["id"])

    return StreamingResponse(
        _generate_events(
            project_id=project_id,
            user_id=current_user["id"],
            body=body,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
