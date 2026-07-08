"""Capture SSE output from draft generate endpoint."""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from fastapi.testclient import TestClient

from apps.api.env import load_env_file
from apps.api.main import app

PROJECT = "5104a74d-91ca-48fb-8074-24e4520a58de"


async def _lookup_ids() -> tuple[str, str, str]:
    import asyncpg

    load_env_file()
    conn = await asyncpg.connect(
        os.environ["DATABASE_URL"], ssl="require", statement_cache_size=0
    )
    try:
        project = await conn.fetchrow(
            "SELECT user_id FROM public.projects WHERE id = $1", PROJECT
        )
        brief = await conn.fetchrow(
            "SELECT id FROM public.briefs WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1",
            PROJECT,
        )
        draft = await conn.fetchrow(
            "SELECT id FROM public.drafts WHERE project_id = $1 ORDER BY updated_at DESC LIMIT 1",
            PROJECT,
        )
        if not project or not brief or not draft:
            raise RuntimeError("missing project/brief/draft rows")
        return str(project["user_id"]), str(brief["id"]), str(draft["id"])
    finally:
        await conn.close()


def main() -> int:
    user_id, brief_id, draft_id = asyncio.run(_lookup_ids())
    print(f"user_id={user_id} brief_id={brief_id} draft_id={draft_id}")

    fake = {"sub": user_id, "email": "test@example.com"}
    client = TestClient(app)

    with patch("apps.api.auth._decode_token", return_value=fake):
        with client.stream(
            "POST",
            f"/api/projects/{PROJECT}/drafts/generate",
            json={"brief_id": brief_id, "draft_id": draft_id},
            headers={"Authorization": "Bearer x"},
        ) as res:
            print("status", res.status_code)
            body = res.read().decode("utf-8", errors="replace")
            print("body length", len(body))
            print("token events", body.count("event: token"))
            print("has done", "event: done" in body)
            print("has error", "event: error" in body)
            if "event: error" in body:
                idx = body.index("event: error")
                print(body[idx : idx + 250])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
