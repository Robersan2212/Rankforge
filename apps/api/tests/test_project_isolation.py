import os
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from apps.api.main import app
from apps.api.routers.projects import get_db

os.environ.setdefault("SUPABASE_URL", "https://test-project.supabase.co")

client = TestClient(app)
USER_A = "user-a-uuid"
USER_B = "user-b-uuid"
PROJECT_A = "project-a-id"
PROJECT_B = "project-b-id"


@pytest.fixture(autouse=True)
def clear_dependency_overrides():
    yield
    app.dependency_overrides.clear()


def _mock_db_for_project_isolation():
    async def mock_get_db():
        mock_conn = AsyncMock()

        async def fetchrow(query, *args):
            if "FROM public.projects WHERE id" in query and args[0] in (
                PROJECT_A,
                PROJECT_B,
            ):
                return {"id": args[0]}
            return None

        async def fetch(query, *args):
            if "FROM public.audits WHERE project_id" in query:
                if args[0] == PROJECT_A:
                    return [
                        {
                            "id": "audit-1",
                            "project_id": PROJECT_A,
                            "url": "https://a.example",
                            "results": {},
                            "seo_score": 0,
                            "created_at": None,
                        }
                    ]
                return []
            if "FROM public.briefs WHERE project_id" in query:
                if args[0] == PROJECT_A:
                    return [
                        {
                            "id": "brief-1",
                            "project_id": PROJECT_A,
                            "keyword": "seo tips",
                            "content": {"title": "Guide"},
                            "created_at": None,
                        }
                    ]
                return []
            return []

        mock_conn.fetchrow = fetchrow
        mock_conn.fetch = fetch
        try:
            yield mock_conn
        finally:
            pass

    return mock_get_db


def test_audits_isolated_by_project():
    fake_payload = {"sub": USER_A, "email": "a@example.com"}
    app.dependency_overrides[get_db] = _mock_db_for_project_isolation()

    with patch("apps.api.auth._decode_token", return_value=fake_payload):
        res_a = client.get(
            f"/api/projects/{PROJECT_A}/audits",
            headers={"Authorization": "Bearer token"},
        )
        res_b = client.get(
            f"/api/projects/{PROJECT_B}/audits",
            headers={"Authorization": "Bearer token"},
        )

    assert res_a.status_code == 200
    assert len(res_a.json()) == 1
    assert res_b.status_code == 200
    assert res_b.json() == []


def test_briefs_isolated_by_project():
    fake_payload = {"sub": USER_A, "email": "a@example.com"}
    app.dependency_overrides[get_db] = _mock_db_for_project_isolation()

    with patch("apps.api.auth._decode_token", return_value=fake_payload):
        res_a = client.get(
            f"/api/projects/{PROJECT_A}/briefs",
            headers={"Authorization": "Bearer token"},
        )
        res_b = client.get(
            f"/api/projects/{PROJECT_B}/briefs",
            headers={"Authorization": "Bearer token"},
        )

    assert res_a.status_code == 200
    assert len(res_a.json()) == 1
    assert res_b.status_code == 200
    assert res_b.json() == []


def test_other_users_project_returns_404():
    fake_payload = {"sub": USER_B, "email": "b@example.com"}

    async def mock_get_db():
        mock_conn = AsyncMock()

        async def fetchrow(query, *args):
            if "FROM public.projects WHERE id" in query:
                # User B does not own project A
                return None
            return None

        mock_conn.fetchrow = fetchrow
        try:
            yield mock_conn
        finally:
            pass

    app.dependency_overrides[get_db] = mock_get_db

    with patch("apps.api.auth._decode_token", return_value=fake_payload):
        res = client.get(
            f"/api/projects/{PROJECT_A}/audits",
            headers={"Authorization": "Bearer token"},
        )

    assert res.status_code == 404
