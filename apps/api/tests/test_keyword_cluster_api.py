"""API tests for SR-02 keyword clustering endpoints."""

from __future__ import annotations

import os
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("ENABLE_KEYWORD_RANKING_SCHEDULER", "false")
os.environ.setdefault("SUPABASE_URL", "https://test-project.supabase.co")

from apps.api.main import app
from apps.api.rate_limit import reset_rate_limits_for_tests
from apps.api.routers.projects import get_db

USER_A = "11111111-1111-1111-1111-111111111111"
PROJECT_A = "22222222-2222-2222-2222-222222222222"
JOB_ID = "33333333-3333-3333-3333-333333333333"


@pytest.fixture(autouse=True)
def _reset():
    reset_rate_limits_for_tests()
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()
    reset_rate_limits_for_tests()


def _auth_headers():
    return {"Authorization": "Bearer test-token"}


def test_create_cluster_job_returns_202():
    conn = AsyncMock()
    conn.fetchrow = AsyncMock(
        side_effect=[
            {"id": PROJECT_A},  # ownership
            {
                "id": JOB_ID,
                "project_id": PROJECT_A,
                "seed_keyword": "content marketing",
                "status": "pending",
                "created_at": None,
            },
        ]
    )

    async def override_db():
        yield conn

    app.dependency_overrides[get_db] = override_db

    with patch(
        "apps.api.auth._decode_token",
        return_value={"sub": USER_A, "email": "a@example.com"},
    ), patch(
        "apps.api.routers.projects.run_keyword_cluster_job"
    ) as mock_job:
        client = TestClient(app)
        res = client.post(
            f"/api/projects/{PROJECT_A}/keywords/cluster",
            headers=_auth_headers(),
            json={"seedKeyword": "content marketing"},
        )

    assert res.status_code == 202
    assert res.json()["jobId"] == JOB_ID
    mock_job.assert_called_once()


def test_create_cluster_job_validates_seed():
    conn = AsyncMock()
    conn.fetchrow = AsyncMock(return_value={"id": PROJECT_A})

    async def override_db():
        yield conn

    app.dependency_overrides[get_db] = override_db

    with patch(
        "apps.api.auth._decode_token",
        return_value={"sub": USER_A, "email": "a@example.com"},
    ):
        client = TestClient(app)
        res = client.post(
            f"/api/projects/{PROJECT_A}/keywords/cluster",
            headers=_auth_headers(),
            json={"seedKeyword": "x"},
        )

    assert res.status_code == 422


def test_get_cluster_job_returns_result_snapshot():
    conn = AsyncMock()
    conn.fetchrow = AsyncMock(
        side_effect=[
            {"id": PROJECT_A},
            {
                "id": JOB_ID,
                "project_id": PROJECT_A,
                "seed_keyword": "seo tips",
                "status": "complete",
                "error": None,
                "result": {
                    "status": "complete",
                    "seedKeyword": "seo tips",
                    "clusters": [
                        {
                            "label": "Beginner SEO",
                            "keywords": [
                                {
                                    "keyword": "seo for beginners",
                                    "searchVolume": 1000,
                                    "difficulty": 20,
                                }
                            ],
                        }
                    ],
                    "error": None,
                },
            },
        ]
    )

    async def override_db():
        yield conn

    app.dependency_overrides[get_db] = override_db

    with patch(
        "apps.api.auth._decode_token",
        return_value={"sub": USER_A, "email": "a@example.com"},
    ):
        client = TestClient(app)
        res = client.get(
            f"/api/projects/{PROJECT_A}/keywords/cluster/{JOB_ID}",
            headers=_auth_headers(),
        )

    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "complete"
    assert body["clusters"][0]["label"] == "Beginner SEO"
