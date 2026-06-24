import os
from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from apps.api.env import load_env_file

load_env_file()

bearer_scheme = HTTPBearer()


def _dev_auth_enabled() -> bool:
    """Local development only — never set DEV_AUTH_BYPASS in production."""
    return (
        os.environ.get("DEV_AUTH_BYPASS", "").lower() == "true"
        and bool(os.environ.get("DEV_AUTH_USER_ID", "").strip())
    )


def _dev_auth_user() -> dict[str, str]:
    return {
        "id": os.environ["DEV_AUTH_USER_ID"].strip(),
        "email": os.environ.get("DEV_AUTH_EMAIL", "dev@example.com").strip(),
    }


def _dev_auth_token() -> str:
    return os.environ.get("DEV_AUTH_TOKEN", "rankforge-dev-local").strip()


@lru_cache
def _jwks_client() -> PyJWKClient:
    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    if not base:
        raise RuntimeError("SUPABASE_URL environment variable is required")
    return PyJWKClient(
        f"{base}/auth/v1/.well-known/jwks.json",
        cache_keys=True,
    )


def _decode_token(token: str) -> dict:
    """Verify Supabase access tokens (ECC JWKS or legacy HS256 secret)."""
    errors: list[str] = []

    # New Supabase projects: ECC / RS256 signing keys via JWKS
    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError as exc:
        errors.append(f"JWKS: {exc}")

    # Older projects: legacy HS256 shared secret (optional)
    legacy_secret = os.environ.get("SUPABASE_JWT_SECRET")
    if legacy_secret:
        try:
            return jwt.decode(
                token,
                legacy_secret,
                algorithms=["HS256"],
                audience="authenticated",
                options={"verify_aud": False},
            )
        except jwt.PyJWTError as exc:
            errors.append(f"legacy: {exc}")

    raise jwt.InvalidTokenError("; ".join(errors) or "invalid token")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    token = credentials.credentials
    if _dev_auth_enabled() and token == _dev_auth_token():
        return _dev_auth_user()

    try:
        payload = _decode_token(token)
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"id": user_id, "email": payload.get("email")}
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
