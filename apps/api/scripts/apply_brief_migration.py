"""Apply FR-04 brief generation migrations (0004 + 0005)."""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

import asyncpg

REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS = [
    REPO_ROOT / "supabase" / "migrations" / "0004_competitor_analyses.sql",
    REPO_ROOT / "supabase" / "migrations" / "0005_brief_generation.sql",
]


def load_env_file() -> None:
    env_path = REPO_ROOT / "apps" / "api" / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def read_sql(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig")


async def main() -> None:
    load_env_file()
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL is not set in apps/api/.env")

    conn = await asyncpg.connect(database_url, ssl="require", statement_cache_size=0)
    try:
        for migration in MIGRATIONS:
            if not migration.exists():
                print(f"Skipping missing migration: {migration.name}")
                continue
            await conn.execute(read_sql(migration))
            print(f"Applied {migration.name} successfully")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
