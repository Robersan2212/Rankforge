"""Apply supabase/migrations/0006_draft_generation.sql to the configured database."""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from apps.api.env import load_env_file

MIGRATION = (
    Path(__file__).resolve().parents[3] / "supabase" / "migrations" / "0006_draft_generation.sql"
)
EXPECTED_COLUMNS = ("status", "generation_model", "word_count", "generated_at")


async def main() -> int:
    load_env_file()
    database_url = os.environ.get("DATABASE_URL", "").strip()
    if not database_url:
        print("FAIL: DATABASE_URL is not set in apps/api/.env")
        return 1

    if not MIGRATION.exists():
        print(f"FAIL: migration file not found: {MIGRATION}")
        return 1

    sql = MIGRATION.read_text(encoding="utf-8")

    import asyncpg

    conn = await asyncpg.connect(database_url, ssl="require", statement_cache_size=0)
    try:
        await conn.execute(sql)
        rows = await conn.fetch(
            """
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'drafts'
              AND column_name = ANY($1::text[])
            ORDER BY column_name
            """,
            list(EXPECTED_COLUMNS),
        )
        found = {row["column_name"] for row in rows}
        missing = set(EXPECTED_COLUMNS) - found
        if missing:
            print(f"FAIL: missing columns after migration: {', '.join(sorted(missing))}")
            return 1

        print("OK: migration 0006_draft_generation applied")
        for row in rows:
            print(f"  - {row['column_name']} ({row['data_type']})")
        return 0
    finally:
        await conn.close()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
