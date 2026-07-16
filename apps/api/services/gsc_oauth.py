"""Google Search Console OAuth (Authorization Code + PKCE)."""

from __future__ import annotations

import base64
import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException

from apps.api.services.token_crypto import decrypt_token, encrypt_token

GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
GOOGLE_SITES_URL = "https://www.googleapis.com/webmasters/v3/sites"

_DEFAULT_STATE_TTL_SECONDS = 600


def _client_id() -> str:
    value = os.environ.get("GSC_CLIENT_ID", "").strip()
    if not value:
        raise HTTPException(status_code=500, detail="GSC_CLIENT_ID is not configured")
    return value


def _client_secret() -> str:
    value = os.environ.get("GSC_CLIENT_SECRET", "").strip()
    if not value:
        raise HTTPException(status_code=500, detail="GSC_CLIENT_SECRET is not configured")
    return value


def _redirect_uri() -> str:
    value = os.environ.get("GSC_REDIRECT_URI", "").strip()
    if not value:
        raise HTTPException(status_code=500, detail="GSC_REDIRECT_URI is not configured")
    return value


def _state_ttl_seconds() -> int:
    raw = os.environ.get("GSC_OAUTH_STATE_TTL_SECONDS", str(_DEFAULT_STATE_TTL_SECONDS))
    try:
        return max(60, int(raw))
    except ValueError:
        return _DEFAULT_STATE_TTL_SECONDS


def _pkce_pair() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(64)[:96]
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return verifier, challenge


async def create_oauth_state(db, *, project_id: str, user_id: str) -> tuple[str, str]:
    """Persist PKCE verifier + CSRF state; return (state, auth_url)."""
    state = secrets.token_urlsafe(32)
    verifier, challenge = _pkce_pair()
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=_state_ttl_seconds())

    await db.execute(
        """INSERT INTO public.gsc_oauth_states
           (state, project_id, user_id, code_verifier, expires_at)
           VALUES ($1, $2, $3, $4, $5)""",
        state,
        project_id,
        user_id,
        verifier,
        expires_at,
    )

    params = {
        "client_id": _client_id(),
        "redirect_uri": _redirect_uri(),
        "response_type": "code",
        "scope": GSC_SCOPE,
        "state": state,
        "access_type": "offline",
        "prompt": "consent",
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    }
    auth_url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    return state, auth_url


async def consume_oauth_state(db, state: str) -> dict[str, Any]:
    row = await db.fetchrow(
        """SELECT state, project_id, user_id, code_verifier, expires_at
           FROM public.gsc_oauth_states WHERE state = $1""",
        state,
    )
    await db.execute("DELETE FROM public.gsc_oauth_states WHERE state = $1", state)

    if row is None:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

    expires_at = row["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OAuth state expired")

    return dict(row)


async def exchange_code_for_tokens(code: str, code_verifier: str) -> dict[str, Any]:
    payload = {
        "client_id": _client_id(),
        "client_secret": _client_secret(),
        "code": code,
        "code_verifier": code_verifier,
        "grant_type": "authorization_code",
        "redirect_uri": _redirect_uri(),
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(GOOGLE_TOKEN_URL, data=payload)

    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail="Google token exchange failed",
        )

    data = response.json()
    if not data.get("refresh_token"):
        raise HTTPException(
            status_code=502,
            detail="Google did not return a refresh token; revoke app access and reconnect",
        )
    return data


async def refresh_access_token(refresh_token: str) -> dict[str, Any]:
    payload = {
        "client_id": _client_id(),
        "client_secret": _client_secret(),
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(GOOGLE_TOKEN_URL, data=payload)

    if response.status_code >= 400:
        body = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
        if body.get("error") == "invalid_grant":
            raise HTTPException(status_code=401, detail="GSC connection revoked; reconnect required")
        raise HTTPException(status_code=502, detail="Failed to refresh GSC access token")

    return response.json()


async def revoke_token(token: str) -> None:
    async with httpx.AsyncClient(timeout=30.0) as client:
        await client.post(
            GOOGLE_REVOKE_URL,
            data={"token": token},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )


async def list_accessible_sites(access_token: str) -> list[str]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            GOOGLE_SITES_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="Failed to list Search Console properties")

    data = response.json()
    entries = data.get("siteEntry") or []
    return [entry.get("siteUrl", "") for entry in entries if entry.get("siteUrl")]


def pick_property_for_url(sites: list[str], audited_url: str) -> str | None:
    """Return the best-matching GSC property URL for an audited page URL."""
    from urllib.parse import urlparse

    parsed = urlparse(audited_url.strip())
    if not parsed.scheme or not parsed.netloc:
        return None

    host = parsed.hostname or ""
    host = host.lower()
    if host.startswith("www."):
        host = host[4:]

    candidates: list[tuple[int, str]] = []
    for site in sites:
        site = site.strip()
        if not site:
            continue
        if site.startswith("sc-domain:"):
            domain = site.removeprefix("sc-domain:").lower()
            if host == domain or host.endswith(f".{domain}"):
                candidates.append((len(domain), site))
            continue

        site_parsed = urlparse(site if "://" in site else f"https://{site}")
        site_host = (site_parsed.hostname or "").lower()
        if site_host.startswith("www."):
            site_host = site_host[4:]
        if host == site_host or host.endswith(f".{site_host}"):
            candidates.append((len(site_host), site))

    if not candidates:
        return None
    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1]


async def upsert_connection(
    db,
    *,
    project_id: str,
    property_url: str,
    access_token: str,
    refresh_token: str,
    expires_in: int,
) -> None:
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=max(60, int(expires_in)))
    await db.execute(
        """INSERT INTO public.gsc_connections
           (project_id, gsc_property_url, encrypted_access_token,
            encrypted_refresh_token, token_expires_at, status, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'connected', now())
           ON CONFLICT (project_id) DO UPDATE SET
             gsc_property_url = EXCLUDED.gsc_property_url,
             encrypted_access_token = EXCLUDED.encrypted_access_token,
             encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
             token_expires_at = EXCLUDED.token_expires_at,
             status = 'connected',
             updated_at = now()""",
        project_id,
        property_url,
        encrypt_token(access_token),
        encrypt_token(refresh_token),
        expires_at,
    )


async def get_connection_row(db, project_id: str) -> dict[str, Any] | None:
    try:
        row = await db.fetchrow(
            """SELECT id, project_id, gsc_property_url, encrypted_access_token,
                      encrypted_refresh_token, token_expires_at, status,
                      connected_at, updated_at
               FROM public.gsc_connections
               WHERE project_id = $1 AND status = 'connected'""",
            project_id,
        )
    except Exception:
        return None
    return dict(row) if row else None


async def mark_connection_disconnected(db, project_id: str) -> None:
    await db.execute(
        """UPDATE public.gsc_connections
           SET status = 'disconnected', updated_at = now()
           WHERE project_id = $1""",
        project_id,
    )


async def delete_connection(db, project_id: str) -> bool:
    result = await db.execute(
        "DELETE FROM public.gsc_connections WHERE project_id = $1",
        project_id,
    )
    return not result.endswith("0")


async def get_valid_access_token(db, project_id: str) -> tuple[str, str]:
    """Return (access_token, property_url), refreshing if needed."""
    row = await get_connection_row(db, project_id)
    if row is None:
        raise HTTPException(status_code=404, detail="GSC not connected for this project")

    refresh_token = decrypt_token(row["encrypted_refresh_token"])
    expires_at = row["token_expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at <= datetime.now(timezone.utc) + timedelta(minutes=2):
        try:
            refreshed = await refresh_access_token(refresh_token)
        except HTTPException as exc:
            if exc.status_code == 401:
                await mark_connection_disconnected(db, project_id)
            raise
        access_token = refreshed["access_token"]
        expires_in = int(refreshed.get("expires_in", 3600))
        new_expires = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
        await db.execute(
            """UPDATE public.gsc_connections
               SET encrypted_access_token = $1,
                   token_expires_at = $2,
                   updated_at = now()
               WHERE project_id = $3""",
            encrypt_token(access_token),
            new_expires,
            project_id,
        )
        return access_token, row["gsc_property_url"]

    return decrypt_token(row["encrypted_access_token"]), row["gsc_property_url"]
