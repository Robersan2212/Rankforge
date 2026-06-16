"""One-off DB connectivity check. Run from repo root."""
import asyncio
import os
import sys
from pathlib import Path

import asyncpg


def load_env_file() -> None:
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ[key.strip()] = value.strip()


async def main() -> int:
    load_env_file()
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        print("FAIL: DATABASE_URL missing")
        return 1
    try:
        conn = await asyncpg.connect(url, timeout=15)
        tables = await conn.fetch(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public' ORDER BY table_name"
        )
        await conn.close()
        names = [r["table_name"] for r in tables]
        print("DB_OK: connected")
        print("TABLES:", ", ".join(names) if names else "(none)")
        required = {"users", "projects", "audits"}
        missing = required - set(names)
        if missing:
            print("WARN: missing tables:", ", ".join(sorted(missing)))
            return 1
        print("SCHEMA_OK")
        return 0
    except Exception as e:
        print("DB_FAIL:", type(e).__name__, str(e)[:200])
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
