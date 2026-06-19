"""Create a local dev Supabase user and print env vars for auth bypass.

Uses SUPABASE_SERVICE_ROLE_KEY from apps/api/.env when set; otherwise falls back
to anon signup via NEXT_PUBLIC_SUPABASE_ANON_KEY from apps/web/.env.local.

Run from repo root:
  python apps/api/scripts/seed_dev_user.py
"""
from __future__ import annotations

import base64
import json
import os
import sys
from pathlib import Path

import httpx

DEV_EMAIL = "dev@example.com"
DEV_PASSWORD = "rankforge-dev-password"
DEV_TOKEN = "rankforge-dev-local"


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def load_env_files() -> None:
    api_dir = Path(__file__).resolve().parents[1]
    repo_root = api_dir.parents[1]
    load_env_file(api_dir / ".env")
    load_env_file(repo_root / "apps" / "web" / ".env.local")


def _jwt_sub(access_token: str) -> str:
    payload = access_token.split(".")[1]
    padding = "=" * ((4 - len(payload) % 4) % 4)
    data = json.loads(base64.urlsafe_b64decode(payload + padding))
    return data["sub"]


def _ensure_user_via_anon(client: httpx.Client, base: str, anon_key: str) -> str:
    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Content-Type": "application/json",
    }
    body = {"email": DEV_EMAIL, "password": DEV_PASSWORD}
    create_res = client.post(f"{base}/auth/v1/signup", headers=headers, json=body)
    if create_res.status_code in (200, 201):
        return create_res.json()["user"]["id"]

    signin_res = client.post(
        f"{base}/auth/v1/token?grant_type=password",
        headers=headers,
        json=body,
    )
    if signin_res.status_code == 200:
        return _jwt_sub(signin_res.json()["access_token"])

    raise RuntimeError(
        "Could not create or sign in dev user via anon key. "
        f"Signup: {create_res.text}. Signin: {signin_res.text}"
    )


def _ensure_user_via_service_role(client: httpx.Client, base: str, service_key: str) -> str:
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }
    create_res = client.post(
        f"{base}/auth/v1/admin/users",
        headers=headers,
        json={
            "email": DEV_EMAIL,
            "password": DEV_PASSWORD,
            "email_confirm": True,
            "user_metadata": {"full_name": "Local Developer"},
        },
    )
    if create_res.status_code in (200, 201):
        return create_res.json()["id"]

    list_res = client.get(
        f"{base}/auth/v1/admin/users",
        headers=headers,
        params={"per_page": 200},
    )
    list_res.raise_for_status()
    users = list_res.json().get("users", [])
    match = next((u for u in users if u.get("email") == DEV_EMAIL), None)
    if match is None:
        raise RuntimeError(f"Could not create or find dev user: {create_res.text}")
    return match["id"]


def _append_env_lines(path: Path, user_id: str) -> None:
    lines = [
        "DEV_AUTH_BYPASS=true",
        f"DEV_AUTH_USER_ID={user_id}",
        f"DEV_AUTH_EMAIL={DEV_EMAIL}",
        f"DEV_AUTH_TOKEN={DEV_TOKEN}",
    ]
    existing = path.read_text(encoding="utf-8") if path.exists() else ""
    if "DEV_AUTH_BYPASS=" in existing:
        updated = existing
        for line in lines:
            key = line.split("=", 1)[0]
            if f"{key}=" in updated:
                updated = "\n".join(
                    ln if not ln.startswith(f"{key}=") else line
                    for ln in updated.splitlines()
                )
            else:
                updated = updated.rstrip() + "\n" + line + "\n"
    else:
        updated = existing.rstrip() + "\n\n# Local dev auth bypass\n" + "\n".join(lines) + "\n"
    path.write_text(updated, encoding="utf-8")


def main() -> int:
    load_env_files()

    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    if not base:
        base = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
    if not base:
        print("FAIL: set SUPABASE_URL in apps/api/.env")
        return 1

    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    anon_key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "").strip()
    api_dir = Path(__file__).resolve().parents[1]
    web_env = api_dir.parents[1] / "apps" / "web" / ".env.local"

    try:
        with httpx.Client(timeout=30) as client:
            if service_key and not service_key.endswith("..."):
                user_id = _ensure_user_via_service_role(client, base, service_key)
                print(f"OK: dev user ready via service role ({DEV_EMAIL})")
            elif anon_key:
                user_id = _ensure_user_via_anon(client, base, anon_key)
                print(f"OK: dev user ready via anon signup ({DEV_EMAIL})")
            else:
                print(
                    "FAIL: set SUPABASE_SERVICE_ROLE_KEY in apps/api/.env "
                    "or NEXT_PUBLIC_SUPABASE_ANON_KEY in apps/web/.env.local"
                )
                return 1
    except Exception as exc:
        print(f"FAIL: {exc}")
        return 1

    _append_env_lines(api_dir / ".env", user_id)
    _append_env_lines(web_env, user_id)
    print(f"OK: updated {api_dir / '.env'}")
    print(f"OK: updated {web_env}")
    print()
    print(f"Dev login (if bypass is off): {DEV_EMAIL} / {DEV_PASSWORD}")
    print("Restart the API and web dev servers.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
