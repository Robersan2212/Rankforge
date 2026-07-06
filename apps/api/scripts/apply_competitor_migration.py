"""Apply FR-03 migration 0004 if tables are missing. Run from repo root."""
import asyncio
import os
import sys
from pathlib import Path

from apps.api.env import load_env_file

load_env_file()

MIGRATION = Path(__file__).resolve().parents[3] / "supabase" / "migrations" / "0004_competitor_analyses.sql"


async def main() -> None:
    import asyncpg

    url = os.environ.get("DATABASE_URL")
    if not url:
        print("DATABASE_URL not set", file=sys.stderr)
        sys.exit(1)

    if not MIGRATION.exists():
        print(f"Migration file not found: {MIGRATION}", file=sys.stderr)
        sys.exit(1)

    sql = MIGRATION.read_text(encoding="utf-8")

    conn = await asyncpg.connect(url, ssl="require", statement_cache_size=0)
    try:
        exists = await conn.fetchval(
            "SELECT to_regclass('public.competitor_analyses')"
        )
        if exists:
            print("competitor_analyses already exists — skipping")
            return

        await conn.execute(sql)
        print("Applied 0004_competitor_analyses.sql successfully")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
