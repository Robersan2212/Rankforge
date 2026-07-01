"""Try common Supabase DATABASE_URL variants (no secrets printed)."""
import asyncio
import os
import sys
from pathlib import Path
from urllib.parse import urlparse, urlunparse

import asyncpg

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from apps.api.env import load_env_file

load_env_file()


def variants(base: str) -> list[tuple[str, str]]:
    parsed = urlparse(base)
    host = parsed.hostname or ""
    user = parsed.username or "postgres"
    out: list[tuple[str, str]] = [("current", base)]

    if "pooler.supabase.com" in host and parsed.port == 5432:
        txn = parsed._replace(netloc=parsed.netloc.replace(":5432", ":6543"))
        out.append(("transaction-6543", urlunparse(txn)))

    for aws in ("aws-0-us-east-1", "aws-1-us-east-1"):
        if aws not in host:
            alt_host = host
            for old in ("aws-0-us-east-1", "aws-1-us-east-1"):
                if old in alt_host:
                    alt_host = alt_host.replace(old, aws)
            if alt_host != host:
                alt = parsed._replace(netloc=parsed.netloc.replace(host, alt_host))
                out.append((f"host-{aws}", urlunparse(alt)))

    ref = user.split(".")[-1] if "." in user else ""
    if ref:
        direct = parsed._replace(
            netloc=f"{parsed.username}:{parsed.password}@db.{ref}.supabase.co:5432"
        )
        out.append(("direct-db-host", urlunparse(direct)))

    return out


async def try_connect(label: str, url: str) -> None:
    try:
        conn = await asyncio.wait_for(
            asyncpg.connect(url, ssl="require"),
            timeout=10,
        )
        val = await conn.fetchval("select 1")
        await conn.close()
        print(f"OK  {label}: select 1 => {val}")
    except Exception as exc:
        print(f"FAIL {label}: {type(exc).__name__}: {str(exc)[:120]}")


async def main() -> None:
    base = os.environ.get("DATABASE_URL", "")
    if not base:
        print("DATABASE_URL missing")
        return
    seen: set[str] = set()
    for label, url in variants(base):
        if url in seen:
            continue
        seen.add(url)
        await try_connect(label, url)


asyncio.run(main())
