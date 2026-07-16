"""Client for the Search Console MCP service."""

from __future__ import annotations

import os

import httpx
from fastapi import HTTPException

DEFAULT_SEARCH_CONSOLE_URL = "http://127.0.0.1:3006"
CLIENT_TIMEOUT_SECONDS = 45.0


def _search_console_url() -> str:
    return os.environ.get("SEARCH_CONSOLE_URL", DEFAULT_SEARCH_CONSOLE_URL).rstrip("/")


async def fetch_gsc_metrics(
    *,
    project_id: str,
    url: str,
    date_range_start: str | None = None,
    date_range_end: str | None = None,
    bypass_cache: bool = False,
) -> dict:
    endpoint = f"{_search_console_url()}/gsc-metrics"
    payload: dict = {
        "project_id": project_id,
        "url": url,
        "bypass_cache": bypass_cache,
    }
    if date_range_start:
        payload["date_range_start"] = date_range_start
    if date_range_end:
        payload["date_range_end"] = date_range_end

    try:
        async with httpx.AsyncClient(timeout=CLIENT_TIMEOUT_SECONDS) as client:
            response = await client.post(endpoint, json=payload)
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Search Console service is unavailable. Start mcp/search-console on port 3006.",
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="Search Console service timed out",
        )

    if response.status_code >= 400:
        try:
            body = response.json()
            message = body.get("message") or body.get("detail") or response.text
        except Exception:
            message = response.text or "Search Console request failed"
        raise HTTPException(status_code=response.status_code, detail=message)

    return response.json()
