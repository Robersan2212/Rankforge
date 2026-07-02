import asyncio
import os
import sys

import asyncpg

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))
from apps.api.env import load_env_file

load_env_file()

MIGRATION_SQL = """
ALTER TABLE public.audits
  ADD COLUMN IF NOT EXISTS fetched_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_audits_project_id ON public.audits(project_id);
"""


async def main() -> None:
    conn = await asyncpg.connect(
        os.environ["DATABASE_URL"],
        ssl="require",
        statement_cache_size=0,
    )
    try:
        await conn.execute(MIGRATION_SQL)
        print("OK: applied 0002_audits_fetched_at migration")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
