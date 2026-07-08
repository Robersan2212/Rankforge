"""Tests for FR-06 full draft generation SSE endpoint."""

from __future__ import annotations

import json
import os
from collections.abc import AsyncIterator
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from apps.api.main import app
from apps.api.rate_limit import reset_rate_limits_for_tests
from apps.api.routers.projects import get_db
from apps.api.services.brief_errors import ClaudeAPIError

os.environ.setdefault("SUPABASE_URL", "https://test-project.supabase.co")

client = TestClient(app)
USER_A = "user-a-uuid"
USER_B = "user-b-uuid"
PROJECT_A = "project-a-id"
BRIEF_A = "brief-a-id"
DRAFT_A = "draft-a-id"

AUTH_HEADERS = {"Authorization": "Bearer token"}

VALID_BRIEF_PAYLOAD = {
    "primary_keyword": "best running shoes",
    "target_word_count": 800,
    "recommended_structure": [
        {"section_title": "Introduction", "purpose": "Hook the reader."},
    ],
    "semantic_keywords": [
        "trail running",
        "marathon training",
        "running shoes",
        "cushioned shoes",
        "neutral shoes",
    ],
    "suggested_headings": [
        "Introduction",
        "What to Look For",
        "Top Picks",
        "FAQ",
    ],
    "faq_questions": [
        "How often should I replace running shoes?",
        "What is the difference between neutral and stability shoes?",
        "Can I use trail shoes on pavement?",
    ],
    "source_audit_id": "00000000-0000-4000-8000-000000000001",
    "source_competitor_analysis_id": "00000000-0000-4000-8000-000000000002",
    "generated_at": "2026-07-07T00:00:00+00:00",
}

LONG_DRAFT_TEXT = (
    "## Introduction\n\n"
    + ("This is a detailed paragraph about running shoes. " * 40)
    + "\n\n## What to Look For\n\n"
    + ("Consider fit cushioning and terrain when choosing shoes. " * 40)
    + "\n\n## Top Picks\n\n"
    + ("Our top recommendations cover road trail and marathon use. " * 40)
    + "\n\n## FAQ\n\n"
    + ("Replace shoes every 300 to 500 miles for best support. " * 20)
)


@pytest.fixture(autouse=True)
def clear_state():
    reset_rate_limits_for_tests()
    yield
    app.dependency_overrides.clear()
    reset_rate_limits_for_tests()


def _mock_db_for_draft_generation():
    drafts: dict[str, dict] = {
        DRAFT_A: {
            "id": DRAFT_A,
            "project_id": PROJECT_A,
            "brief_id": BRIEF_A,
            "title": "Test draft",
            "content": "",
            "status": "manual",
            "generation_model": None,
            "word_count": None,
            "generated_at": None,
            "created_at": None,
            "updated_at": None,
        }
    }

    mock_conn = AsyncMock()

    async def fetchrow(query, *args):
            q = " ".join(query.split())

            if "FROM public.projects WHERE id" in q:
                if len(args) >= 2 and args[0] == PROJECT_A and args[1] == USER_A:
                    return {"id": PROJECT_A}
                return None

            if "FROM public.briefs WHERE id" in q and "content" in q:
                if len(args) >= 2 and args[0] == BRIEF_A and args[1] == PROJECT_A:
                    return {"content": VALID_BRIEF_PAYLOAD}
                return None

            if "FROM public.drafts" in q and "WHERE id = $1 AND project_id = $2" in q:
                draft = drafts.get(args[0])
                if draft and draft["project_id"] == args[1]:
                    return dict(draft)
                return None

            if "INSERT INTO public.drafts" in q:
                new_id = "new-draft-id"
                drafts[new_id] = {
                    "id": new_id,
                    "project_id": args[0],
                    "brief_id": str(args[1]),
                    "title": args[2],
                    "content": "",
                    "status": "generating",
                    "generation_model": None,
                    "word_count": None,
                    "generated_at": None,
                    "created_at": None,
                    "updated_at": None,
                }
                return dict(drafts[new_id])

            if "SELECT * FROM public.drafts WHERE id = $1" in q and len(args) == 1:
                draft = drafts.get(args[0])
                return dict(draft) if draft else None

            if "UPDATE public.drafts" in q and "RETURNING" in q:
                draft_id = args[0]
                draft = drafts.get(draft_id)
                if not draft:
                    return None
                if "status = 'completed'" in q:
                    draft["content"] = args[1]
                    draft["status"] = "completed"
                    draft["generation_model"] = args[2]
                    draft["word_count"] = args[3]
                elif "status = $3" in q:
                    draft["content"] = args[1]
                    draft["status"] = args[2]
                    draft["generation_model"] = args[3]
                    draft["word_count"] = args[4]
                return dict(draft)

            return None

    async def execute(query, *args):
        q = " ".join(query.split())
        if "UPDATE public.drafts" in q and "status = 'generating'" in q:
            draft = drafts.get(args[0])
            if draft:
                draft["status"] = "generating"
                draft["brief_id"] = str(args[1])

    mock_conn.fetchrow = fetchrow
    mock_conn.execute = execute
    mock_conn.close = AsyncMock()

    async def mock_get_db():
        yield mock_conn

    async def mock_open_stream_db():
        return mock_conn

    return mock_get_db, mock_open_stream_db, drafts


async def _mock_stream_success(_brief) -> AsyncIterator[str]:
    chunks = [
        "## Introduction\n\n",
        ("Opening paragraph about running shoes. " * 80),
        "\n\n## What to Look For\n\n",
        ("Fit cushioning and terrain matter for every runner. " * 80),
        "\n\n## Top Picks\n\n",
        ("Our recommendations cover road trail and marathon categories. " * 80),
        "\n\n## FAQ\n\n",
        ("Replace shoes regularly and choose the right support level. " * 40),
    ]
    for chunk in chunks:
        yield chunk


async def _mock_stream_failure(_brief) -> AsyncIterator[str]:
    yield "## Introduction\n\n"
    yield "Partial content before failure."
    raise ClaudeAPIError("rate limited", user_message="Service unavailable.")


def _parse_sse_events(body: str) -> list[tuple[str, dict]]:
    events: list[tuple[str, dict]] = []
    for block in body.split("\n\n"):
        if not block.strip():
            continue
        event_name = "message"
        data_line = ""
        for line in block.split("\n"):
            if line.startswith("event:"):
                event_name = line[6:].strip()
            elif line.startswith("data:"):
                data_line = line[5:].strip()
        if data_line:
            events.append((event_name, json.loads(data_line)))
    return events


def test_generate_draft_streams_tokens_and_completes():
    mock_get_db, mock_open_stream_db, drafts = _mock_db_for_draft_generation()
    app.dependency_overrides[get_db] = mock_get_db
    fake_payload = {"sub": USER_A, "email": "a@example.com"}

    with patch("apps.api.auth._decode_token", return_value=fake_payload), patch(
        "apps.api.routers.drafts._open_stream_db", side_effect=mock_open_stream_db
    ), patch(
        "apps.api.routers.drafts.stream_full_draft", side_effect=_mock_stream_success
    ):
        res = client.post(
            f"/api/projects/{PROJECT_A}/drafts/generate",
            headers=AUTH_HEADERS,
            json={"brief_id": BRIEF_A, "draft_id": DRAFT_A},
        )

    assert res.status_code == 200
    assert "text/event-stream" in res.headers.get("content-type", "")
    events = _parse_sse_events(res.text)
    token_events = [e for e in events if e[0] == "token"]
    done_events = [e for e in events if e[0] == "done"]

    assert len(token_events) > 1
    assert len(done_events) == 1
    assert done_events[0][1]["word_count"] >= 600
    assert drafts[DRAFT_A]["status"] == "completed"
    accumulated = "".join(t[1]["text"] for t in token_events)
    for heading in VALID_BRIEF_PAYLOAD["suggested_headings"]:
        assert heading in accumulated


def test_generate_draft_with_brief_payload():
    mock_get_db, mock_open_stream_db, _ = _mock_db_for_draft_generation()
    app.dependency_overrides[get_db] = mock_get_db
    fake_payload = {"sub": USER_A, "email": "a@example.com"}

    with patch("apps.api.auth._decode_token", return_value=fake_payload), patch(
        "apps.api.routers.drafts._open_stream_db", side_effect=mock_open_stream_db
    ), patch(
        "apps.api.routers.drafts.stream_full_draft", side_effect=_mock_stream_success
    ):
        res = client.post(
            f"/api/projects/{PROJECT_A}/drafts/generate",
            headers=AUTH_HEADERS,
            json={
                "brief_id": BRIEF_A,
                "brief_payload": VALID_BRIEF_PAYLOAD,
            },
        )

    assert res.status_code == 200
    events = _parse_sse_events(res.text)
    assert any(e[0] == "done" for e in events)


def test_generate_draft_midstream_error_saves_partial():
    mock_get_db, mock_open_stream_db, drafts = _mock_db_for_draft_generation()
    app.dependency_overrides[get_db] = mock_get_db
    fake_payload = {"sub": USER_A, "email": "a@example.com"}

    with patch("apps.api.auth._decode_token", return_value=fake_payload), patch(
        "apps.api.routers.drafts._open_stream_db", side_effect=mock_open_stream_db
    ), patch(
        "apps.api.routers.drafts.stream_full_draft", side_effect=_mock_stream_failure
    ):
        res = client.post(
            f"/api/projects/{PROJECT_A}/drafts/generate",
            headers=AUTH_HEADERS,
            json={"brief_id": BRIEF_A, "draft_id": DRAFT_A},
        )

    events = _parse_sse_events(res.text)
    assert any(e[0] == "error" for e in events)
    assert drafts[DRAFT_A]["status"] in ("partial", "failed")
    assert "Partial content" in drafts[DRAFT_A]["content"]


def test_generate_draft_requires_auth():
    res = client.post(
        f"/api/projects/{PROJECT_A}/drafts/generate",
        json={"brief_id": BRIEF_A},
    )
    assert res.status_code == 401


def test_other_user_cannot_generate_draft():
    mock_get_db, _, _ = _mock_db_for_draft_generation()
    app.dependency_overrides[get_db] = mock_get_db
    fake_payload = {"sub": USER_B, "email": "b@example.com"}

    with patch("apps.api.auth._decode_token", return_value=fake_payload):
        res = client.post(
            f"/api/projects/{PROJECT_A}/drafts/generate",
            headers={"Authorization": "Bearer token"},
            json={"brief_id": BRIEF_A},
        )

    assert res.status_code == 404


def test_duplicate_generation_returns_error_event():
    mock_get_db, mock_open_stream_db, _ = _mock_db_for_draft_generation()
    app.dependency_overrides[get_db] = mock_get_db
    fake_payload = {"sub": USER_A, "email": "a@example.com"}

    async def slow_stream(_brief) -> AsyncIterator[str]:
        yield "slow "
        import asyncio

        await asyncio.sleep(0.05)
        yield "content"

    with patch("apps.api.auth._decode_token", return_value=fake_payload), patch(
        "apps.api.routers.drafts._open_stream_db", side_effect=mock_open_stream_db
    ), patch(
        "apps.api.routers.drafts.stream_full_draft", side_effect=slow_stream
    ):
        import threading

        results: list[str] = []

        def run_request():
            res = client.post(
                f"/api/projects/{PROJECT_A}/drafts/generate",
                headers=AUTH_HEADERS,
                json={"brief_id": BRIEF_A, "draft_id": DRAFT_A},
            )
            results.append(res.text)

        t = threading.Thread(target=run_request)
        t.start()
        import time

        time.sleep(0.01)
        res2 = client.post(
            f"/api/projects/{PROJECT_A}/drafts/generate",
            headers=AUTH_HEADERS,
            json={"brief_id": BRIEF_A, "draft_id": DRAFT_A},
        )
        t.join()

    events = _parse_sse_events(res2.text)
    assert any(
        e[0] == "error" and e[1].get("code") == "duplicate_generation"
        for e in events
    )


def test_compute_max_tokens_bounded():
    from apps.api.prompts.full_draft import compute_max_tokens

    assert compute_max_tokens(300) == 1200
    assert compute_max_tokens(800) == 1600
    assert compute_max_tokens(5000) == 8192


def test_claude_error_does_not_leak_api_key():
    mock_get_db, mock_open_stream_db, _ = _mock_db_for_draft_generation()
    app.dependency_overrides[get_db] = mock_get_db
    fake_payload = {"sub": USER_A, "email": "a@example.com"}

    async def failing_stream(_brief) -> AsyncIterator[str]:
        raise ClaudeAPIError("secret api key leak in logs")
        yield ""  # pragma: no cover

    with patch("apps.api.auth._decode_token", return_value=fake_payload), patch(
        "apps.api.routers.drafts._open_stream_db", side_effect=mock_open_stream_db
    ), patch(
        "apps.api.routers.drafts.stream_full_draft", side_effect=failing_stream
    ):
        res = client.post(
            f"/api/projects/{PROJECT_A}/drafts/generate",
            headers=AUTH_HEADERS,
            json={"brief_id": BRIEF_A, "draft_id": DRAFT_A},
        )

    assert "secret api key" not in res.text
