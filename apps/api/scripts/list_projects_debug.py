"""List projects in DB (debug). Run from repo root with PYTHONPATH set."""
import asyncio
import json
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
        users = await conn.fetch(
            "SELECT id, email, created_at FROM public.users ORDER BY created_at"
        )
        print("=== users ===")
        for u in users:
            print(dict(u))

        projects = await conn.fetch(
            """SELECT p.id, p.name, p.slug, p.user_id, u.email, p.created_at
               FROM public.projects p
               LEFT JOIN public.users u ON u.id = p.user_id
               ORDER BY p.created_at DESC"""
        )
        print("\n=== projects ===")
        for p in projects:
            print(dict(p))
        print(f"\nTotal projects: {len(projects)}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
