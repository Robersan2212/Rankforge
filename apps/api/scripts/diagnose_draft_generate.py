"""Diagnose FR-06 draft generation failures."""
from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from apps.api.env import load_env_file


async def main() -> int:
    load_env_file()
    database_url = os.environ.get("DATABASE_URL", "").strip()
    if not database_url:
        print("FAIL: DATABASE_URL not set")
        return 1

    import asyncpg

    conn = await asyncpg.connect(database_url, ssl="require", statement_cache_size=0)
    try:
        cols = await conn.fetch(
            """
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'drafts'
            ORDER BY column_name
            """
        )
        print("drafts columns:", [r["column_name"] for r in cols])

        brief = await conn.fetchrow(
            "SELECT id, project_id, keyword, content FROM public.briefs "
            "WHERE keyword ILIKE '%janitorial%' ORDER BY created_at DESC LIMIT 1"
        )
        if not brief:
            print("FAIL: no janitorial brief found")
            return 1

        print("brief id:", brief["id"])
        content = brief["content"]
        if isinstance(content, str):
            content = json.loads(content)

        from apps.api.prompts.full_draft import parse_brief_payload

        try:
            parsed = parse_brief_payload(content)
            print("brief parse OK, headings:", len(parsed.suggested_headings))
        except Exception as exc:
            print("FAIL brief parse:", exc)
            return 1

        from apps.api.services.draft_service import create_or_get_draft

        try:
            row = await create_or_get_draft(
                conn,
                project_id=str(brief["project_id"]),
                brief_id=str(brief["id"]),
                draft_id=None,
                title="diagnostic test",
            )
            print("create_or_get_draft OK, draft id:", row["id"])
            await conn.execute(
                "DELETE FROM public.drafts WHERE id = $1", row["id"]
            )
        except Exception as exc:
            print("FAIL create_or_get_draft:", type(exc).__name__, exc)
            return 1

        from apps.api.services.draft_generator import stream_full_draft

        try:
            n = 0
            async for chunk in stream_full_draft(parsed):
                n += 1
                if n == 1:
                    print("stream first chunk:", repr(chunk[:40]))
                if n >= 2:
                    break
            print("stream OK")
        except Exception as exc:
            print("FAIL stream:", type(exc).__name__, getattr(exc, "user_message", str(exc)))
            return 1

        print("All checks passed")
        return 0
    finally:
        await conn.close()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
