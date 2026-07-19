"""HTTP client for the Keyword Research MCP (port 3007)."""

from __future__ import annotations

import os
from typing import Any

import httpx
from fastapi import HTTPException

DEFAULT_KEYWORD_RESEARCH_URL = "http://127.0.0.1:3007"
CLIENT_TIMEOUT_SECONDS = 45.0
MIN_CANDIDATES = 20
MAX_CANDIDATES = 50


def _keyword_research_url() -> str:
    return os.environ.get("KEYWORD_RESEARCH_URL", DEFAULT_KEYWORD_RESEARCH_URL).rstrip(
        "/"
    )


async def fetch_related_keywords(
    seed: str, *, limit: int = MAX_CANDIDATES
) -> dict[str, Any]:
    capped = max(MIN_CANDIDATES, min(MAX_CANDIDATES, int(limit)))
    endpoint = f"{_keyword_research_url()}/research"
    try:
        async with httpx.AsyncClient(timeout=CLIENT_TIMEOUT_SECONDS) as client:
            response = await client.post(
                endpoint,
                json={"seed": seed, "limit": capped},
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=502,
            detail="Keyword research service is unavailable",
        ) from exc

    if response.status_code >= 400:
        detail = "Keyword research request failed"
        try:
            body = response.json()
            if isinstance(body.get("message"), str):
                detail = body["message"]
        except Exception:
            pass
        raise HTTPException(status_code=502, detail=detail)

    data = response.json()
    keywords = data.get("keywords") or []
    if not isinstance(keywords, list):
        raise HTTPException(
            status_code=502, detail="Keyword research returned invalid payload"
        )
    return data
