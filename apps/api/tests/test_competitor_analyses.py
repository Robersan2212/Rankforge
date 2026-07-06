import asyncio
import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from apps.api.main import app
from apps.api.rate_limit import reset_rate_limits_for_tests
from apps.api.routers.projects import get_db
from apps.api.services.competitor_pipeline import run_competitor_analysis

os_environ = __import__("os")
os_environ.environ.setdefault("SUPABASE_URL", "https://test-project.supabase.co")

client = TestClient(app)
USER_A = "user-a-uuid"
PROJECT_A = "project-a-id"
ANALYSIS_ID = "analysis-uuid-1"

SERP_FIXTURE = {
    "keyword": "seo tips",
    "results": [
        {"url": f"https://competitor{i}.example.com/page", "rank_position": i + 1}
        for i in range(10)
    ],
}


def _ok_extract(url: str, rank_position: int | None = None) -> dict:
    return {
        "url": url,
        "rank_position": rank_position,
        "status": "ok",
        "headings": {
            "h1": ["Main"],
            "h2": ["Section"],
            "h3": [],
            "h4": [],
            "h5": [],
            "h6": [],
        },
        "word_count": 1500,
        "topics_covered": ["keyword research", "on-page optimization"],
        "faq_questions": ["What is SEO?"],
        "scraped_at": datetime.now(timezone.utc).isoformat(),
    }


@pytest.fixture(autouse=True)
def clear_state():
    reset_rate_limits_for_tests()
    yield
    app.dependency_overrides.clear()
    reset_rate_limits_for_tests()


def _mock_db_for_competitor_analyses():
    async def mock_get_db():
        mock_conn = AsyncMock()
        stored = {
            "id": ANALYSIS_ID,
            "project_id": PROJECT_A,
            "keyword": "seo tips",
            "user_page_url": "https://example.com/seo",
            "status": "pending",
            "created_at": datetime.now(timezone.utc),
        }

        async def fetchrow(query, *args):
            if "FROM public.projects WHERE id" in query:
                return {"id": args[0]}
            if "INSERT INTO public.competitor_analyses" in query:
                return stored
            if "FROM public.competitor_analyses" in query and "WHERE id" in query:
                return {**stored, "report": None, "error": None, "completed_at": None}
            return None

        async def fetch(query, *args):
            if "FROM public.competitor_analyses" in query and "ORDER BY" in query:
                return [stored]
            return []

        mock_conn.fetchrow = fetchrow
        mock_conn.fetch = fetch
        try:
            yield mock_conn
        finally:
            pass

    return mock_get_db


def test_create_competitor_analysis_enqueues_job():
    fake_payload = {"sub": USER_A, "email": "a@example.com"}
    app.dependency_overrides[get_db] = _mock_db_for_competitor_analyses()

    with patch(
        "apps.api.routers.projects.run_competitor_analysis",
        new_callable=AsyncMock,
    ) as mock_run:
        with patch("apps.api.auth._decode_token", return_value=fake_payload):
            res = client.post(
                f"/api/projects/{PROJECT_A}/competitor-analyses",
                headers={"Authorization": "Bearer token"},
                json={
                    "keyword": "seo tips",
                    "user_page_url": "https://example.com/seo",
                },
            )

    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "pending"
    assert body["keyword"] == "seo tips"
    mock_run.assert_called_once()


def test_competitor_rate_limit_returns_429():
    fake_payload = {"sub": USER_A, "email": "a@example.com"}
    app.dependency_overrides[get_db] = _mock_db_for_competitor_analyses()

    with patch(
        "apps.api.routers.projects.run_competitor_analysis",
        new_callable=AsyncMock,
    ):
        with patch("apps.api.auth._decode_token", return_value=fake_payload):
            for _ in range(5):
                res = client.post(
                    f"/api/projects/{PROJECT_A}/competitor-analyses",
                    headers={"Authorization": "Bearer token"},
                    json={
                        "keyword": "seo tips",
                        "user_page_url": "https://example.com/seo",
                    },
                )
                assert res.status_code == 201

            res = client.post(
                f"/api/projects/{PROJECT_A}/competitor-analyses",
                headers={"Authorization": "Bearer token"},
                json={
                    "keyword": "seo tips",
                    "user_page_url": "https://example.com/seo",
                },
            )

    assert res.status_code == 429


def test_pipeline_returns_at_least_8_of_10():
    asyncio.run(_run_pipeline_returns_at_least_8_of_10())


async def _run_pipeline_returns_at_least_8_of_10():
    call_count = {"extract": 0}

    async def mock_extract(url: str, rank_position: int | None = None) -> dict:
        call_count["extract"] += 1
        if "hang.example.com" in url:
            return {
                "url": url,
                "rank_position": rank_position,
                "status": "failed",
                "reason": "timeout",
            }
        if "blocked.example.com" in url:
            return {
                "url": url,
                "rank_position": rank_position,
                "status": "skipped",
                "reason": "robots_disallowed",
            }
        return _ok_extract(url, rank_position)

    serp_with_failures = {
        "keyword": "seo tips",
        "results": [
            {"url": "https://hang.example.com/page", "rank_position": 1},
            {"url": "https://blocked.example.com/page", "rank_position": 2},
        ]
        + [
            {"url": f"https://competitor{i}.example.com/page", "rank_position": i + 1}
            for i in range(2, 10)
        ],
    }

    mock_conn = AsyncMock()
    analysis_row = {
        "id": ANALYSIS_ID,
        "keyword": "seo tips",
        "user_page_url": "https://example.com/thin-page",
        "created_at": datetime.now(timezone.utc),
    }

    async def fetchrow(query, *args):
        if "FROM public.competitor_analyses WHERE id" in query:
            return analysis_row
        if "scraped_pages" in query:
            return None
        return None

    updates: list[tuple] = []

    async def execute(query, *args):
        updates.append((query, args))
        return "UPDATE 1"

    mock_conn.fetchrow = fetchrow
    mock_conn.execute = execute

    with patch(
        "apps.api.services.competitor_pipeline._get_db_connection",
        new_callable=AsyncMock,
        return_value=mock_conn,
    ):
        with patch(
            "apps.api.services.competitor_pipeline.get_top_results",
            new_callable=AsyncMock,
            return_value=serp_with_failures,
        ):
            with patch(
                "apps.api.services.competitor_pipeline.extract_page",
                side_effect=mock_extract,
            ):
                with patch(
                    "apps.api.services.competitor_pipeline.compute_content_gap",
                    new_callable=AsyncMock,
                    return_value={
                        "topics_missing_from_user_page": ["link building"],
                        "topics_user_page_shares": ["keyword research"],
                    },
                ):
                    await run_competitor_analysis(ANALYSIS_ID)

    final_update = updates[-1]
    report = json.loads(final_update[1][2])
    assert report["results_returned"] >= 8
    assert final_update[1][1] == "completed"

    for comp in report["competitors"]:
        if comp["status"] == "ok":
            assert comp["headings"] is not None
            assert comp["word_count"] is not None

    assert report["content_gap"]["topics_missing_from_user_page"]


def test_pipeline_marks_failed_url_and_completes():
    asyncio.run(_run_pipeline_marks_failed_url_and_completes())


async def _run_pipeline_marks_failed_url_and_completes():
    async def mock_extract(url: str, rank_position: int | None = None) -> dict:
        if "hang.example.com" in url:
            return {
                "url": url,
                "rank_position": rank_position,
                "status": "failed",
                "reason": "timeout",
            }
        return _ok_extract(url, rank_position)

    serp = {
        "keyword": "test",
        "results": [
            {"url": "https://hang.example.com/page", "rank_position": 1},
        ]
        + [
            {"url": f"https://ok{i}.example.com/page", "rank_position": i + 2}
            for i in range(9)
        ],
    }

    mock_conn = AsyncMock()
    analysis_row = {
        "id": ANALYSIS_ID,
        "keyword": "test",
        "user_page_url": "https://example.com/page",
        "created_at": datetime.now(timezone.utc),
    }

    async def fetchrow(query, *args):
        if "FROM public.competitor_analyses WHERE id" in query:
            return analysis_row
        return None

    updates: list[tuple] = []

    async def execute(query, *args):
        updates.append((query, args))
        return "UPDATE 1"

    mock_conn.fetchrow = fetchrow
    mock_conn.execute = execute

    with patch(
        "apps.api.services.competitor_pipeline._get_db_connection",
        new_callable=AsyncMock,
        return_value=mock_conn,
    ):
        with patch(
            "apps.api.services.competitor_pipeline.get_top_results",
            new_callable=AsyncMock,
            return_value=serp,
        ):
            with patch(
                "apps.api.services.competitor_pipeline.extract_page",
                side_effect=mock_extract,
            ):
                with patch(
                    "apps.api.services.competitor_pipeline.compute_content_gap",
                    new_callable=AsyncMock,
                    return_value={
                        "topics_missing_from_user_page": ["gap topic"],
                        "topics_user_page_shares": [],
                    },
                ):
                    await run_competitor_analysis(ANALYSIS_ID)

    report = json.loads(updates[-1][1][2])
    failed = next(c for c in report["competitors"] if "hang" in c["url"])
    assert failed["status"] == "failed"
    assert failed["reason"] == "timeout"
    assert report["results_returned"] >= 8
