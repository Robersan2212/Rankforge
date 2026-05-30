import os
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from apps.api.main import app
from apps.api.routers.projects import get_db

os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret-for-unit-tests")

client = TestClient(app)
USER_ID = "user-uuid-123"
PROJECT_A = "project-a-id"
PROJECT_B = "project-b-id"


@pytest.fixture(autouse=True)
def clear_dependency_overrides():
    yield
    app.dependency_overrides.clear()


def test_audits_isolated_by_project():
    fake_payload = {"sub": USER_ID, "email": "test@example.com"}

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
            return []

        mock_conn.fetchrow = fetchrow
        mock_conn.fetch = fetch
        try:
            yield mock_conn
        finally:
            pass

    app.dependency_overrides[get_db] = mock_get_db

    with patch("apps.api.auth.jwt.decode", return_value=fake_payload):
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
