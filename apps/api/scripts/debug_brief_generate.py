"""Debug brief generation for a project."""

from __future__ import annotations

import asyncio
import json
import os
import traceback
from pathlib import Path

import asyncpg

REPO = Path(__file__).resolve().parents[3]
PROJECT_ID = "5104a74d-91ca-48fb-8074-24e4520a58de"


def load_env() -> None:
    env_path = REPO / "apps" / "api" / ".env"
    for line in env_path.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


async def main() -> None:
    load_env()
    conn = await asyncpg.connect(
        os.environ["DATABASE_URL"], ssl="require", statement_cache_size=0
    )
    try:
        audits = await conn.fetch(
            "SELECT id, url FROM public.audits WHERE project_id = $1",
            PROJECT_ID,
        )
        comps = await conn.fetch(
            "SELECT id, keyword, status FROM public.competitor_analyses WHERE project_id = $1",
            PROJECT_ID,
        )
        print("audits:", [(str(a["id"]), a["url"]) for a in audits])
        print("comps:", [(str(c["id"]), c["keyword"], c["status"]) for c in comps])

        if not audits or not comps:
            return

        audit_id = str(audits[0]["id"])
        comp_id = str(comps[0]["id"])

        from apps.api.services.brief_pipeline import generate_and_persist_brief

        try:
            row = await generate_and_persist_brief(
                conn,
                project_id=PROJECT_ID,
                user_id="c0fa6790-c5be-48d6-bbcc-007395c2fb1e",
                audit_id=audit_id,
                competitor_analysis_id=comp_id,
            )
            print("SUCCESS", json.dumps(row, default=str)[:500])
        except Exception as exc:
            print("ERROR", type(exc).__name__, exc)
            traceback.print_exc()
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
