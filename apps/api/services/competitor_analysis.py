import os

import httpx
from fastapi import HTTPException

DEFAULT_COMPETITOR_ANALYSIS_URL = "http://127.0.0.1:3003"
CLIENT_TIMEOUT_SECONDS = 60.0


def _competitor_analysis_url() -> str:
    return os.environ.get(
        "COMPETITOR_ANALYSIS_URL", DEFAULT_COMPETITOR_ANALYSIS_URL
    ).rstrip("/")


async def extract_page(url: str, rank_position: int | None = None) -> dict:
    endpoint = f"{_competitor_analysis_url()}/extract"
    payload: dict = {"url": url}
    if rank_position is not None:
        payload["rank_position"] = rank_position

    try:
        async with httpx.AsyncClient(timeout=CLIENT_TIMEOUT_SECONDS) as client:
            response = await client.post(endpoint, json=payload)
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail=(
                "Competitor analysis service is unavailable. "
                "Start mcp/competitor-analysis on port 3003."
            ),
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="Competitor analysis timed out while scraping the URL",
        )

    if response.status_code >= 400:
        try:
            body = response.json()
            message = body.get("message") or body.get("detail") or response.text
        except Exception:
            message = response.text or "Extract request failed"
        raise HTTPException(status_code=response.status_code, detail=message)

    return response.json()


async def analyze_batch(urls: list[dict]) -> list[dict]:
    endpoint = f"{_competitor_analysis_url()}/analyze-batch"
    try:
        async with httpx.AsyncClient(timeout=CLIENT_TIMEOUT_SECONDS * 4) as client:
            response = await client.post(endpoint, json={"urls": urls})
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail=(
                "Competitor analysis service is unavailable. "
                "Start mcp/competitor-analysis on port 3003."
            ),
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="Competitor batch analysis timed out",
        )

    if response.status_code >= 400:
        try:
            body = response.json()
            message = body.get("message") or body.get("detail") or response.text
        except Exception:
            message = response.text or "Batch analyze request failed"
        raise HTTPException(status_code=response.status_code, detail=message)

    data = response.json()
    return data.get("results", [])
