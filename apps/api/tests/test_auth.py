import os
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from apps.api.main import app
from apps.api.routers.projects import get_db

os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret-for-unit-tests")

client = TestClient(app)


async def _mock_get_db():
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(return_value=[])
    try:
        yield mock_conn
    finally:
        pass


@pytest.fixture(autouse=True)
def clear_dependency_overrides():
    yield
    app.dependency_overrides.clear()


def test_missing_token_returns_401_or_403():
    response = client.get("/api/projects")
    assert response.status_code in (401, 403)


def test_invalid_token_returns_401():
    response = client.get(
        "/api/projects",
        headers={"Authorization": "Bearer not-a-real-token"},
    )
    assert response.status_code == 401


def test_valid_token_reaches_handler():
    fake_payload = {"sub": "user-uuid-123", "email": "test@example.com"}
    app.dependency_overrides[get_db] = _mock_get_db
    with patch("apps.api.auth.jwt.decode", return_value=fake_payload):
        response = client.get(
            "/api/projects",
            headers={"Authorization": "Bearer fake-but-mocked"},
        )
    assert response.status_code == 200
    assert response.json() == []
