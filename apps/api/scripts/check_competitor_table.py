import asyncio
import os
import sys

from apps.api.env import load_env_file

load_env_file()


async def main() -> None:
    import asyncpg

    url = os.environ.get("DATABASE_URL")
    if not url:
        print("DATABASE_URL not set", file=sys.stderr)
        sys.exit(1)

    conn = await asyncpg.connect(url, ssl="require", statement_cache_size=0)
    try:
        table = await conn.fetchval(
            "SELECT to_regclass('public.competitor_analyses')"
        )
        scraped = await conn.fetchval(
            "SELECT to_regclass('public.scraped_pages')"
        )
        print(f"competitor_analyses: {table}")
        print(f"scraped_pages: {scraped}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
