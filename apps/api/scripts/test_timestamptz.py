import asyncio
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
        value = "2026-07-02T03:40:24.834Z"
        row = await conn.fetchrow("SELECT $1::timestamptz AS ts", value)
        print("ok", row["ts"])
    except Exception as exc:
        print("fail", exc)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
