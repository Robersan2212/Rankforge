import os
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from apps.api.main import app
from apps.api.routers.projects import MAX_DRAFT_CONTENT_LENGTH, get_db

os.environ.setdefault("SUPABASE_URL", "https://test-project.supabase.co")

client = TestClient(app)
USER_A = "user-a-uuid"
PROJECT_A = "project-a-id"
PROJECT_B = "project-b-id"
DRAFT_A = "draft-a-id"
BRIEF_A = "brief-a-id"
BRIEF_B = "brief-b-id"

fake_payload = {"sub": USER_A, "email": "a@example.com"}
AUTH_HEADERS = {"Authorization": "Bearer token"}


@pytest.fixture(autouse=True)
def clear_dependency_overrides():
    yield
    app.dependency_overrides.clear()


def _mock_db_for_drafts():
    drafts = {
        DRAFT_A: {
            "id": DRAFT_A,
            "project_id": PROJECT_A,
            "brief_id": None,
            "title": "My draft",
            "content": "Hello world",
            "created_at": None,
            "updated_at": None,
        }
    }
    briefs = {
        (BRIEF_A, PROJECT_A): True,
        (BRIEF_B, PROJECT_B): True,
    }

    async def mock_get_db():
        mock_conn = AsyncMock()

        async def fetchrow(query, *args):
            if "FROM public.projects WHERE id" in query:
                if args[0] == PROJECT_A and args[1] == USER_A:
                    return {"id": PROJECT_A}
                return None
            if "FROM public.drafts" in query and "WHERE id" in query:
                draft = drafts.get(args[0])
                if draft and draft["project_id"] == args[1]:
                    return dict(draft)
                return None
            if "FROM public.briefs WHERE id" in query:
                if briefs.get((args[0], args[1])):
                    return {"id": args[0]}
                return None
            if "UPDATE public.drafts" in query:
                draft_id = args[-2]
                project_id = args[-1]
                draft = drafts.get(draft_id)
                if draft is None or draft["project_id"] != project_id:
                    return None
                for clause, value in zip(query.split("SET")[1].split("WHERE")[0].split(","), args[:-2]):
                    clause = clause.strip()
                    if clause.startswith("title ="):
                        draft["title"] = value
                    elif clause.startswith("content ="):
                        draft["content"] = value
                    elif clause.startswith("brief_id ="):
                        draft["brief_id"] = value
                return dict(draft)
            return None

        async def fetch(query, *args):
            if "FROM public.drafts WHERE project_id" in query:
                return [d for d in drafts.values() if d["project_id"] == args[0]]
            return []

        mock_conn.fetchrow = fetchrow
        mock_conn.fetch = fetch
        yield mock_conn

    return mock_get_db


def test_get_draft_success():
    app.dependency_overrides[get_db] = _mock_db_for_drafts()
    with patch("apps.api.auth._decode_token", return_value=fake_payload):
        response = client.get(
            f"/api/projects/{PROJECT_A}/drafts/{DRAFT_A}",
            headers=AUTH_HEADERS,
        )
    assert response.status_code == 200
    assert response.json()["id"] == DRAFT_A


def test_get_draft_wrong_project_returns_404():
    app.dependency_overrides[get_db] = _mock_db_for_drafts()
    with patch("apps.api.auth._decode_token", return_value=fake_payload):
        response = client.get(
            f"/api/projects/{PROJECT_B}/drafts/{DRAFT_A}",
            headers=AUTH_HEADERS,
        )
    assert response.status_code == 404


def test_patch_draft_success():
    app.dependency_overrides[get_db] = _mock_db_for_drafts()
    with patch("apps.api.auth._decode_token", return_value=fake_payload):
        response = client.patch(
            f"/api/projects/{PROJECT_A}/drafts/{DRAFT_A}",
            headers=AUTH_HEADERS,
            json={"title": "Updated title", "content": "Updated content"},
        )
    assert response.status_code == 200
    assert response.json()["title"] == "Updated title"


def test_patch_draft_rejects_oversized_content():
    app.dependency_overrides[get_db] = _mock_db_for_drafts()
    with patch("apps.api.auth._decode_token", return_value=fake_payload):
        response = client.patch(
            f"/api/projects/{PROJECT_A}/drafts/{DRAFT_A}",
            headers=AUTH_HEADERS,
            json={"content": "x" * (MAX_DRAFT_CONTENT_LENGTH + 1)},
        )
    assert response.status_code == 400


def test_patch_draft_rejects_cross_project_brief():
    app.dependency_overrides[get_db] = _mock_db_for_drafts()
    with patch("apps.api.auth._decode_token", return_value=fake_payload):
        response = client.patch(
            f"/api/projects/{PROJECT_A}/drafts/{DRAFT_A}",
            headers=AUTH_HEADERS,
            json={"brief_id": BRIEF_B},
        )
    assert response.status_code == 400
