import os

import httpx
from fastapi import HTTPException

DEFAULT_PAGE_AUDITOR_URL = "http://127.0.0.1:3001"
CLIENT_TIMEOUT_SECONDS = 35.0


def _page_auditor_url() -> str:
    return os.environ.get("PAGE_AUDITOR_URL", DEFAULT_PAGE_AUDITOR_URL).rstrip("/")


async def run_audit(url: str) -> dict:
    """Call the page-auditor MCP REST endpoint and return the audit report."""
    endpoint = f"{_page_auditor_url()}/audit"

    try:
        async with httpx.AsyncClient(timeout=CLIENT_TIMEOUT_SECONDS) as client:
            response = await client.post(endpoint, json={"url": url})
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Page auditor service is unavailable. Start mcp/page-auditor on port 3001.",
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="Page auditor timed out while crawling the URL (max 35s)",
        )

    if response.status_code >= 400:
        try:
            payload = response.json()
            message = payload.get("message") or payload.get("detail") or response.text
        except Exception:
            message = response.text or "Audit request failed"
        raise HTTPException(status_code=response.status_code, detail=message)

    return response.json()
