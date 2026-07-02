import asyncio
import json
import os
import sys

import asyncpg

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))
from apps.api.env import load_env_file

load_env_file()


async def main() -> None:
    conn = await asyncpg.connect(
        os.environ["DATABASE_URL"],
        ssl="require",
        statement_cache_size=0,
    )
    try:
        cols = await conn.fetch(
            """
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'audits'
            ORDER BY ordinal_position
            """
        )
        print("Columns:", [r["column_name"] for r in cols])
        rows = await conn.fetch(
            """
            SELECT id, project_id, url, seo_score, fetched_at, created_at,
                   results::text AS results_preview
            FROM public.audits
            ORDER BY created_at DESC
            LIMIT 5
            """
        )
        for row in rows:
            print(json.dumps(dict(row), default=str))
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
