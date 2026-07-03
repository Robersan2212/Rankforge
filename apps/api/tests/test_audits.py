import json
import os
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from apps.api.main import app
from apps.api.rate_limit import reset_rate_limits_for_tests
from apps.api.routers.projects import get_db

os.environ.setdefault("SUPABASE_URL", "https://test-project.supabase.co")

client = TestClient(app)
USER_A = "user-a-uuid"
PROJECT_A = "project-a-id"

SAMPLE_REPORT = {
    "url": "https://example.com/page",
    "fetched_at": datetime.now(timezone.utc).isoformat(),
    "meta_title": "Example Page",
    "meta_title_length": 12,
    "meta_description": "A" * 130,
    "meta_description_length": 130,
    "headings": {"h1": ["Title"], "h2": ["Sub"], "h3": [], "h4": [], "h5": [], "h6": []},
    "word_count": 650,
    "links": {"internal_count": 2, "external_count": 1},
    "images": {"total": 1, "missing_alt_count": 0, "missing_alt_examples": []},
    "seo_score": 88,
    "score_breakdown": {
        "title": {"score": 10, "max": 15, "notes": "short"},
        "description": {"score": 15, "max": 15, "notes": "ok"},
        "headings": {"score": 18, "max": 20, "notes": "ok"},
        "content_length": {"score": 20, "max": 20, "notes": "ok"},
        "links": {"score": 15, "max": 15, "notes": "ok"},
        "images": {"score": 10, "max": 15, "notes": "ok"},
    },
    "errors": [],
}


@pytest.fixture(autouse=True)
def clear_dependency_overrides():
    reset_rate_limits_for_tests()
    yield
    app.dependency_overrides.clear()
    reset_rate_limits_for_tests()


def _mock_db_for_audits():
    async def mock_get_db():
        mock_conn = AsyncMock()
        inserted = {}

        async def fetchrow(query, *args):
            if "FROM public.projects WHERE id" in query:
                return {"id": args[0]}
            if "INSERT INTO public.audits" in query:
                inserted.update(
                    {
                        "id": "audit-new-id",
                        "project_id": args[0],
                        "url": args[1],
                        "report": json.loads(args[2]),
                        "seo_score": args[3],
                        "fetched_at": args[4],
                        "created_at": datetime.now(timezone.utc),
                    }
                )
                return inserted
            if "FROM public.audits" in query and "WHERE id" in query:
                return {
                    "id": args[0],
                    "project_id": args[1],
                    "url": SAMPLE_REPORT["url"],
                    "report": {
                        **SAMPLE_REPORT,
                        "audit_id": args[0],
                        "project_id": args[1],
                    },
                    "seo_score": SAMPLE_REPORT["seo_score"],
                    "fetched_at": SAMPLE_REPORT["fetched_at"],
                    "created_at": datetime.now(timezone.utc),
                }
            return None

        mock_conn.fetchrow = fetchrow
        try:
            yield mock_conn
        finally:
            pass

    return mock_get_db


def test_create_audit_persists_report():
    fake_payload = {"sub": USER_A, "email": "a@example.com"}
    app.dependency_overrides[get_db] = _mock_db_for_audits()

    with patch(
        "apps.api.routers.projects.run_audit",
        new_callable=AsyncMock,
        return_value=SAMPLE_REPORT,
    ):
        with patch("apps.api.auth._decode_token", return_value=fake_payload):
            res = client.post(
                f"/api/projects/{PROJECT_A}/audits",
                headers={"Authorization": "Bearer token"},
                json={"url": "https://example.com/page"},
            )

    assert res.status_code == 201
    body = res.json()
    assert body["seo_score"] == 88
    assert body["report"]["word_count"] == 650
    assert body["report"]["audit_id"] == "audit-new-id"


def test_get_audit_by_id():
    fake_payload = {"sub": USER_A, "email": "a@example.com"}
    app.dependency_overrides[get_db] = _mock_db_for_audits()

    with patch("apps.api.auth._decode_token", return_value=fake_payload):
        res = client.get(
            f"/api/projects/{PROJECT_A}/audits/audit-new-id",
            headers={"Authorization": "Bearer token"},
        )

    assert res.status_code == 200
    assert res.json()["seo_score"] == 88


def test_auditor_error_propagates():
    fake_payload = {"sub": USER_A, "email": "a@example.com"}
    app.dependency_overrides[get_db] = _mock_db_for_audits()

    with patch(
        "apps.api.routers.projects.run_audit",
        new_callable=AsyncMock,
        side_effect=HTTPException(
            status_code=403, detail="Crawling / is disallowed by robots.txt"
        ),
    ):
        with patch("apps.api.auth._decode_token", return_value=fake_payload):
            res = client.post(
                f"/api/projects/{PROJECT_A}/audits",
                headers={"Authorization": "Bearer token"},
                json={"url": "https://example.com"},
            )

    assert res.status_code == 403
    assert "robots.txt" in res.json()["detail"]


def test_audit_rate_limit_returns_429():
    fake_payload = {"sub": USER_A, "email": "a@example.com"}
    app.dependency_overrides[get_db] = _mock_db_for_audits()

    with patch(
        "apps.api.routers.projects.run_audit",
        new_callable=AsyncMock,
        return_value=SAMPLE_REPORT,
    ):
        with patch("apps.api.auth._decode_token", return_value=fake_payload):
            for _ in range(10):
                res = client.post(
                    f"/api/projects/{PROJECT_A}/audits",
                    headers={"Authorization": "Bearer token"},
                    json={"url": "https://example.com/page"},
                )
                assert res.status_code == 201

            res = client.post(
                f"/api/projects/{PROJECT_A}/audits",
                headers={"Authorization": "Bearer token"},
                json={"url": "https://example.com/page"},
            )

    assert res.status_code == 429


def test_run_audit_forwards_project_id():
    fake_payload = {"sub": USER_A, "email": "a@example.com"}
    app.dependency_overrides[get_db] = _mock_db_for_audits()

    with patch(
        "apps.api.routers.projects.run_audit",
        new_callable=AsyncMock,
        return_value=SAMPLE_REPORT,
    ) as mock_run:
        with patch("apps.api.auth._decode_token", return_value=fake_payload):
            res = client.post(
                f"/api/projects/{PROJECT_A}/audits",
                headers={"Authorization": "Bearer token"},
                json={"url": "https://example.com/page"},
            )

    assert res.status_code == 201
    mock_run.assert_awaited_once_with(
        "https://example.com/page", project_id=PROJECT_A
    )


def test_delete_audit_returns_204():
    fake_payload = {"sub": USER_A, "email": "a@example.com"}
    deleted = {"called": False}

    async def mock_get_db():
        mock_conn = AsyncMock()

        async def fetchrow(query, *args):
            if "FROM public.projects WHERE id" in query:
                return {"id": args[0]}
            return None

        async def execute(query, *args):
            if "DELETE FROM public.audits" in query:
                deleted["called"] = True
                return "DELETE 1"
            return "DELETE 0"

        mock_conn.fetchrow = fetchrow
        mock_conn.execute = execute
        try:
            yield mock_conn
        finally:
            pass

    app.dependency_overrides[get_db] = mock_get_db

    with patch("apps.api.auth._decode_token", return_value=fake_payload):
        res = client.delete(
            f"/api/projects/{PROJECT_A}/audits/audit-new-id",
            headers={"Authorization": "Bearer token"},
        )

    assert res.status_code == 204
    assert deleted["called"] is True
