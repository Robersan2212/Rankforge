import os
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

os.environ["ENABLE_KEYWORD_RANKING_SCHEDULER"] = "false"
os.environ.setdefault("SUPABASE_URL", "https://test-project.supabase.co")

from apps.api.main import app
from apps.api.rate_limit import reset_rate_limits_for_tests
from apps.api.routers.projects import get_db
from apps.api.services.keyword_rankings import (
    find_position_in_results,
    normalize_url_for_match,
)

client = TestClient(app)
USER_A = "user-a-uuid"
USER_B = "user-b-uuid"
PROJECT_A = "project-a-id"
PROJECT_B = "project-b-id"
KW1 = "kw-1"
KW2 = "kw-2"
KW3 = "kw-3"

SERP_FIXTURE = {
    "keyword": "seo tips",
    "results": [
        {
            "url": "https://example.com/seo-tips",
            "rank_position": 3,
            "title": "SEO Tips",
            "snippet": "...",
        },
        {
            "url": "https://other.com/guide",
            "rank_position": 7,
            "title": "Guide",
            "snippet": "...",
        },
    ],
}


@pytest.fixture(autouse=True)
def clear_state():
    reset_rate_limits_for_tests()
    yield
    app.dependency_overrides.clear()
    reset_rate_limits_for_tests()


def test_normalize_and_find_position():
    assert normalize_url_for_match("https://www.Example.com/path/") == "example.com/path"
    assert (
        find_position_in_results(SERP_FIXTURE["results"], "https://example.com/seo-tips")
        == 3
    )
    assert find_position_in_results(SERP_FIXTURE["results"], "https://missing.com") is None
    assert find_position_in_results(SERP_FIXTURE["results"], None) is None


def _keyword_store():
    return {
        KW1: {
            "id": KW1,
            "project_id": PROJECT_A,
            "keyword": "seo tips",
            "target_url": "https://example.com/seo-tips",
            "created_at": datetime.now(timezone.utc),
            "is_active": True,
        },
        KW2: {
            "id": KW2,
            "project_id": PROJECT_A,
            "keyword": "content marketing",
            "target_url": "https://example.com/content",
            "created_at": datetime.now(timezone.utc),
            "is_active": True,
        },
        KW3: {
            "id": KW3,
            "project_id": PROJECT_A,
            "keyword": "on page seo",
            "target_url": "https://example.com/on-page",
            "created_at": datetime.now(timezone.utc),
            "is_active": True,
        },
    }


def _mock_db_for_keywords():
    keywords = _keyword_store()
    rankings: list[dict] = []

    async def mock_get_db():
        mock_conn = AsyncMock()

        async def fetchrow(query, *args):
            q = " ".join(query.split())
            if "FROM public.projects WHERE id" in q:
                if args[0] == PROJECT_A:
                    return {"id": PROJECT_A}
                return None
            if "INSERT INTO public.tracked_keywords" in q:
                new_id = f"kw-new-{len(keywords)}"
                row = {
                    "id": new_id,
                    "project_id": args[0],
                    "keyword": args[1],
                    "target_url": args[2] if len(args) > 2 else None,
                    "created_at": datetime.now(timezone.utc),
                    "is_active": True,
                }
                keywords[new_id] = row
                return row
            if "FROM public.tracked_keywords" in q and "WHERE id" in q:
                row = keywords.get(args[0])
                if row and row["project_id"] == args[1] and row.get("is_active", True):
                    return row
                return None
            if "INSERT INTO public.keyword_rankings" in q:
                row = {
                    "id": f"rank-{len(rankings)+1}",
                    "tracked_keyword_id": args[0],
                    "position": args[1],
                    "checked_at": datetime.now(timezone.utc),
                    "source": args[2],
                }
                rankings.append(row)
                return row
            return None

        async def fetchval(query, *args):
            if "COUNT(*)" in query:
                return sum(
                    1
                    for k in keywords.values()
                    if k["project_id"] == args[0] and k.get("is_active", True)
                )
            return None

        async def fetch(query, *args):
            q = " ".join(query.split())
            if "FROM public.tracked_keywords tk" in q or (
                "FROM public.tracked_keywords" in q and "ORDER BY" in q
            ):
                project_id = args[0]
                rows = [
                    {
                        **k,
                        "latest_position": next(
                            (
                                r["position"]
                                for r in reversed(rankings)
                                if r["tracked_keyword_id"] == k["id"]
                            ),
                            None,
                        ),
                        "latest_checked_at": next(
                            (
                                r["checked_at"]
                                for r in reversed(rankings)
                                if r["tracked_keyword_id"] == k["id"]
                            ),
                            None,
                        ),
                        "latest_source": next(
                            (
                                r["source"]
                                for r in reversed(rankings)
                                if r["tracked_keyword_id"] == k["id"]
                            ),
                            None,
                        ),
                    }
                    for k in keywords.values()
                    if k["project_id"] == project_id and k.get("is_active", True)
                ]
                return rows
            if "FROM public.keyword_rankings" in q:
                kid = args[0]
                return [r for r in rankings if r["tracked_keyword_id"] == kid]
            return []

        async def execute(query, *args):
            q = " ".join(query.split())
            if "SET is_active = false" in q:
                row = keywords.get(args[0])
                if row and row["project_id"] == args[1] and row.get("is_active", True):
                    row["is_active"] = False
                    return "UPDATE 1"
                return "UPDATE 0"
            return "UPDATE 0"

        mock_conn.fetchrow = fetchrow
        mock_conn.fetchval = fetchval
        mock_conn.fetch = fetch
        mock_conn.execute = execute
        try:
            yield mock_conn
        finally:
            pass

    return mock_get_db, rankings, keywords


def test_create_list_three_keywords():
    mock_db, _, _ = _mock_db_for_keywords()
    app.dependency_overrides[get_db] = mock_db
    fake = {"sub": USER_A, "email": "a@example.com"}

    with patch("apps.api.auth._decode_token", return_value=fake):
        res = client.get(
            f"/api/projects/{PROJECT_A}/keywords",
            headers={"Authorization": "Bearer token"},
        )
    assert res.status_code == 200
    assert len(res.json()) == 3


def test_manual_refresh_records_ranking():
    mock_db, rankings, _ = _mock_db_for_keywords()
    app.dependency_overrides[get_db] = mock_db
    fake = {"sub": USER_A, "email": "a@example.com"}

    with patch("apps.api.auth._decode_token", return_value=fake):
        with patch(
            "apps.api.services.keyword_rankings.get_top_results",
            new_callable=AsyncMock,
            return_value=SERP_FIXTURE,
        ):
            res = client.post(
                f"/api/projects/{PROJECT_A}/keywords/{KW1}/refresh",
                headers={"Authorization": "Bearer token"},
            )

    assert res.status_code == 200
    body = res.json()
    assert body["ranking"]["source"] == "manual"
    assert body["ranking"]["position"] == 3
    assert body["ranking"]["checked_at"] is not None
    assert len(rankings) == 1


def test_manual_refresh_rate_limit():
    mock_db, _, _ = _mock_db_for_keywords()
    app.dependency_overrides[get_db] = mock_db
    fake = {"sub": USER_A, "email": "a@example.com"}

    with patch("apps.api.auth._decode_token", return_value=fake):
        with patch(
            "apps.api.services.keyword_rankings.get_top_results",
            new_callable=AsyncMock,
            return_value=SERP_FIXTURE,
        ):
            first = client.post(
                f"/api/projects/{PROJECT_A}/keywords/{KW1}/refresh",
                headers={"Authorization": "Bearer token"},
            )
            second = client.post(
                f"/api/projects/{PROJECT_A}/keywords/{KW1}/refresh",
                headers={"Authorization": "Bearer token"},
            )

    assert first.status_code == 200
    assert second.status_code == 429


def test_history_returns_timeseries():
    mock_db, rankings, _ = _mock_db_for_keywords()
    rankings.append(
        {
            "id": "rank-seed",
            "tracked_keyword_id": KW1,
            "position": 5,
            "checked_at": datetime.now(timezone.utc),
            "source": "scheduled",
        }
    )
    app.dependency_overrides[get_db] = mock_db
    fake = {"sub": USER_A, "email": "a@example.com"}

    with patch("apps.api.auth._decode_token", return_value=fake):
        res = client.get(
            f"/api/projects/{PROJECT_A}/keywords/{KW1}/history",
            headers={"Authorization": "Bearer token"},
        )

    assert res.status_code == 200
    body = res.json()
    assert body["keyword"]["keyword"] == "seo tips"
    assert len(body["history"]) == 1
    assert body["history"][0]["position"] == 5


def test_keywords_isolated_by_project_ownership():
    mock_db, _, _ = _mock_db_for_keywords()
    app.dependency_overrides[get_db] = mock_db
    fake = {"sub": USER_A, "email": "a@example.com"}

    with patch("apps.api.auth._decode_token", return_value=fake):
        res = client.get(
            f"/api/projects/{PROJECT_B}/keywords",
            headers={"Authorization": "Bearer token"},
        )

    assert res.status_code == 404


def test_serp_failure_does_not_record_fake_position():
    mock_db, rankings, _ = _mock_db_for_keywords()
    app.dependency_overrides[get_db] = mock_db
    fake = {"sub": USER_A, "email": "a@example.com"}

    from fastapi import HTTPException

    with patch("apps.api.auth._decode_token", return_value=fake):
        with patch(
            "apps.api.services.keyword_rankings.get_top_results",
            new_callable=AsyncMock,
            side_effect=HTTPException(status_code=503, detail="down"),
        ):
            res = client.post(
                f"/api/projects/{PROJECT_A}/keywords/{KW1}/refresh",
                headers={"Authorization": "Bearer token"},
            )

    assert res.status_code == 502
    assert rankings == []


def test_delete_keyword_soft_deletes():
    mock_db, _, keywords = _mock_db_for_keywords()
    app.dependency_overrides[get_db] = mock_db
    fake = {"sub": USER_A, "email": "a@example.com"}

    with patch("apps.api.auth._decode_token", return_value=fake):
        res = client.delete(
            f"/api/projects/{PROJECT_A}/keywords/{KW1}",
            headers={"Authorization": "Bearer token"},
        )

    assert res.status_code == 204
    assert keywords[KW1]["is_active"] is False
