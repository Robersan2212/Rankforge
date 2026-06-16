"""Validate DATABASE_URL shape without printing secrets."""
import os
import sys
from urllib.parse import urlparse


def main() -> int:
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        print("FAIL: DATABASE_URL missing")
        return 1

    parsed = urlparse(url)
    print("scheme:", parsed.scheme or "(missing)")
    print("hostname:", parsed.hostname or "(missing)")
    print("port:", parsed.port or "(default)")
    print("username:", parsed.username or "(missing)")
    print("password_set:", bool(parsed.password))
    print("database:", (parsed.path or "").lstrip("/") or "(missing)")

    if parsed.scheme not in ("postgresql", "postgres"):
        print("FAIL: scheme should be postgresql or postgres")
        return 1
    if not parsed.hostname or not parsed.hostname.endswith(".supabase.co"):
        print("FAIL: hostname looks wrong — password may need URL-encoding")
        return 1
    if not parsed.password:
        print("FAIL: no password detected in connection string")
        return 1
    print("URL_SHAPE_OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
