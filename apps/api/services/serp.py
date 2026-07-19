import os

import httpx
from fastapi import HTTPException

DEFAULT_SERP_URL = "http://127.0.0.1:3002"
CLIENT_TIMEOUT_SECONDS = 30.0
LOCATION_MAX_LENGTH = 100


def _serp_url() -> str:
    return os.environ.get("SERP_URL", DEFAULT_SERP_URL).rstrip("/")


def sanitize_location(location: str | None) -> str | None:
    if location is None:
        return None
    cleaned = "".join(
        ch for ch in location if ord(ch) >= 32 and ch != "\x7f"
    ).strip()[:LOCATION_MAX_LENGTH]
    return cleaned or None


async def get_top_results(
    keyword: str, count: int = 10, location: str | None = None
) -> dict:
    """Call the SERP MCP REST endpoint and return organic results."""
    endpoint = f"{_serp_url()}/serp"
    payload: dict = {"keyword": keyword, "count": count}
    cleaned = sanitize_location(location)
    if cleaned:
        payload["location"] = cleaned

    try:
        async with httpx.AsyncClient(timeout=CLIENT_TIMEOUT_SECONDS) as client:
            response = await client.post(endpoint, json=payload)
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="SERP service is unavailable. Start mcp/serp on port 3002.",
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="SERP service timed out while fetching results",
        )

    if response.status_code >= 400:
        try:
            body = response.json()
            message = body.get("message") or body.get("detail") or response.text
        except Exception:
            message = response.text or "SERP request failed"
        raise HTTPException(status_code=response.status_code, detail=message)

    return response.json()
