import base64
import os
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("ENABLE_KEYWORD_RANKING_SCHEDULER", "false")
os.environ.setdefault("SUPABASE_URL", "https://test-project.supabase.co")
os.environ["TOKEN_ENCRYPTION_KEY"] = base64.urlsafe_b64encode(os.urandom(32)).decode()
os.environ["GSC_CLIENT_ID"] = "test-client-id"
os.environ["GSC_CLIENT_SECRET"] = "test-client-secret"
os.environ["GSC_REDIRECT_URI"] = "http://localhost:3000/api/auth/gsc/callback"
os.environ["FRONTEND_URL"] = "http://localhost:3000"

from apps.api.main import app
from apps.api.rate_limit import reset_rate_limits_for_tests
from apps.api.routers.projects import get_db
from apps.api.services.gsc_oauth import pick_property_for_url
from apps.api.services.token_crypto import decrypt_token, encrypt_token

client = TestClient(app)
USER_A = "user-a-uuid"
PROJECT_A = "project-a-id"
PROJECT_B = "project-b-id"


@pytest.fixture(autouse=True)
def clear_state():
    reset_rate_limits_for_tests()
    yield
    app.dependency_overrides.clear()
    reset_rate_limits_for_tests()


def test_token_crypto_roundtrip():
    original = "refresh-token-secret-value"
    encrypted = encrypt_token(original)
    assert encrypted != original
    assert decrypt_token(encrypted) == original


def test_pick_property_for_url_matches_domain_and_prefix():
    sites = ["sc-domain:example.com", "https://www.example.com/"]
    assert pick_property_for_url(sites, "https://example.com/blog/post") == "sc-domain:example.com"
    assert pick_property_for_url(sites, "https://other.com/") is None


def _mock_db_gsc():
    oauth_states: dict[str, dict] = {}
    connections: dict[str, dict] = {}

    async def mock_get_db():
        mock_conn = AsyncMock()

        async def fetchrow(query, *args):
            if "FROM public.projects WHERE id" in query and args[0] == PROJECT_A:
                return {"id": PROJECT_A}
            if "INSERT INTO public.gsc_oauth_states" in query:
                oauth_states[args[0]] = {
                    "state": args[0],
                    "project_id": args[1],
                    "user_id": args[2],
                    "code_verifier": args[3],
                    "expires_at": datetime.now(timezone.utc),
                }
                return None
            if "FROM public.gsc_oauth_states WHERE state" in query:
                return oauth_states.get(args[0])
            if "FROM public.gsc_connections" in query:
                return connections.get(args[0])
            return None

        async def execute(query, *args):
            if "DELETE FROM public.gsc_oauth_states" in query:
                oauth_states.pop(args[0], None)
                return "DELETE 1"
            if "INSERT INTO public.gsc_connections" in query:
                connections[args[0]] = {
                    "project_id": args[0],
                    "gsc_property_url": args[1],
                    "status": "connected",
                    "connected_at": datetime.now(timezone.utc),
                }
                return "INSERT 1"
            if "DELETE FROM public.gsc_connections" in query:
                connections.pop(args[0], None)
                return "DELETE 1"
            return "UPDATE 1"

        mock_conn.fetchrow = fetchrow
        mock_conn.execute = execute
        mock_conn.fetch = AsyncMock(return_value=[])
        mock_conn.fetchval = AsyncMock(return_value=None)
        try:
            yield mock_conn
        finally:
            pass

    return mock_get_db


def test_gsc_status_not_connected():
    app.dependency_overrides[get_db] = _mock_db_gsc()
    fake = {"sub": USER_A, "email": "a@example.com"}
    with patch("apps.api.auth._decode_token", return_value=fake):
        res = client.get(
            f"/api/auth/gsc/status?project_id={PROJECT_A}",
            headers={"Authorization": "Bearer token"},
        )
    assert res.status_code == 200
    assert res.json()["connected"] is False


def test_gsc_start_redirects_to_google():
    app.dependency_overrides[get_db] = _mock_db_gsc()
    fake = {"sub": USER_A, "email": "a@example.com"}
    with patch("apps.api.auth._decode_token", return_value=fake):
        res = client.get(
            f"/api/auth/gsc/start?project_id={PROJECT_A}",
            headers={"Authorization": "Bearer token"},
            follow_redirects=False,
        )
    assert res.status_code == 302
    location = res.headers["location"]
    assert "accounts.google.com" in location
    assert "webmasters.readonly" in location
    assert "code_challenge=" in location


def test_gsc_status_isolated_by_project():
    app.dependency_overrides[get_db] = _mock_db_gsc()
    fake = {"sub": USER_A, "email": "a@example.com"}
    with patch("apps.api.auth._decode_token", return_value=fake):
        res = client.get(
            f"/api/auth/gsc/status?project_id={PROJECT_B}",
            headers={"Authorization": "Bearer token"},
        )
    assert res.status_code == 404


def test_augment_audit_report_without_connection():
    from apps.api.services.gsc_metrics import augment_audit_report
    import asyncio

    async def run():
        mock_conn = AsyncMock()
        mock_conn.fetchrow = AsyncMock(return_value=None)
        report = {"url": "https://example.com", "seo_score": 80}
        result = await augment_audit_report(
            mock_conn,
            project_id=PROJECT_A,
            audited_url="https://example.com",
            report=report,
        )
        assert result["gsc_metrics"] is None
        assert result["gsc_connection"]["connected"] is False

    asyncio.run(run())
