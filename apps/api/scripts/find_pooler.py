"""Try Supavisor pooler if direct db.* host fails (IPv6-only)."""
import asyncio
import os
import sys
from pathlib import Path
from urllib.parse import quote, urlparse

import asyncpg

REGIONS = [
    "us-east-1",
    "us-east-2",
    "us-west-1",
    "us-west-2",
    "eu-west-1",
    "eu-west-2",
    "eu-central-1",
    "ap-southeast-1",
]


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


def project_ref_from_direct_host(host: str) -> str | None:
    if host.startswith("db.") and host.endswith(".supabase.co"):
        return host.removeprefix("db.").removesuffix(".supabase.co")
    return None


def pooler_url(direct_url: str, region: str, mode: str = "session") -> str | None:
    parsed = urlparse(direct_url)
    ref = project_ref_from_direct_host(parsed.hostname or "")
    if not ref or not parsed.password:
        return None
    port = 5432 if mode == "session" else 6543
    user = f"postgres.{ref}"
    password = quote(parsed.password, safe="")
    db = (parsed.path or "/postgres").lstrip("/") or "postgres"
    host = f"aws-0-{region}.pooler.supabase.com"
    return f"postgresql://{user}:{password}@{host}:{port}/{db}"


async def try_connect(url: str) -> bool:
    try:
        conn = await asyncpg.connect(url, timeout=12)
        await conn.execute("SELECT 1")
        await conn.close()
        return True
    except Exception:
        return False


async def main() -> int:
    load_env_file()
    direct = os.environ.get("DATABASE_URL", "")
    if not direct:
        print("FAIL: DATABASE_URL missing")
        return 1

    parsed = urlparse(direct)
    print("testing direct host:", parsed.hostname)

    try:
        conn = await asyncpg.connect(direct, timeout=12)
        await conn.execute("SELECT 1")
        await conn.close()
        print("DIRECT_OK")
        return 0
    except Exception as e:
        print("direct failed:", type(e).__name__)

    ref = project_ref_from_direct_host(parsed.hostname or "")
    if not ref:
        print("FAIL: not a direct Supabase host and direct connection failed")
        return 1

    for region in REGIONS:
        for mode in ("session", "transaction"):
            url = pooler_url(direct, region, mode)
            if not url:
                continue
            if await try_connect(url):
                port = 5432 if mode == "session" else 6543
                print(f"POOLER_OK region={region} mode={mode} port={port}")
                print("UPDATE apps/api/.env DATABASE_URL to the Session pooler URI from")
                print("Supabase Dashboard -> Settings -> Database -> Connection string")
                return 0

    print("FAIL: no pooler region worked; copy Session pooler URI from dashboard")
    return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
