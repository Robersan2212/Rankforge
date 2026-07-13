"""FR-07: resolve and persist keyword SERP positions via shared SERP module."""

from __future__ import annotations

import logging
from typing import Any
from urllib.parse import urlparse

from fastapi import HTTPException

from apps.api.services.serp import get_top_results

logger = logging.getLogger(__name__)

SERP_RESULT_COUNT = 10


def normalize_url_for_match(url: str) -> str:
    """Normalize a URL for host+path comparison (ignore scheme, www, trailing slash)."""
    raw = url.strip()
    if not raw:
        return ""
    if "://" not in raw:
        raw = f"https://{raw}"
    parsed = urlparse(raw)
    host = (parsed.hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    path = parsed.path.rstrip("/") or ""
    return f"{host}{path}"


def find_position_in_results(
    results: list[dict[str, Any]], target_url: str | None
) -> int | None:
    """Return rank_position of target_url in SERP results, or None if not found / no URL."""
    if not target_url or not target_url.strip():
        return None

    needle = normalize_url_for_match(target_url)
    if not needle:
        return None

    for item in results:
        result_url = item.get("url")
        if not isinstance(result_url, str):
            continue
        candidate = normalize_url_for_match(result_url)
        if candidate == needle or candidate.startswith(needle) or needle.startswith(candidate):
            pos = item.get("rank_position")
            if isinstance(pos, int) and pos > 0:
                return pos
            return None
    return None


async def lookup_keyword_position(
    keyword: str, target_url: str | None
) -> int | None:
    """Call shared SERP service and resolve position. Raises on provider hard failures."""
    payload = await get_top_results(keyword, count=SERP_RESULT_COUNT)
    results = payload.get("results") or []
    if not isinstance(results, list):
        results = []
    return find_position_in_results(results, target_url)


async def check_and_persist_ranking(
    db,
    *,
    tracked_keyword_id: str,
    keyword: str,
    target_url: str | None,
    source: str,
) -> Any | None:
    """
    Look up one keyword and append a keyword_rankings row.
    On provider failure returns None (caller logs); does not fabricate a position.
    """
    try:
        position = await lookup_keyword_position(keyword, target_url)
    except HTTPException as exc:
        logger.warning(
            "SERP lookup failed for keyword_id=%s keyword=%r: %s",
            tracked_keyword_id,
            keyword,
            exc.detail,
        )
        return None
    except Exception:
        logger.exception(
            "Unexpected SERP failure for keyword_id=%s keyword=%r",
            tracked_keyword_id,
            keyword,
        )
        return None

    row = await db.fetchrow(
        """INSERT INTO public.keyword_rankings
           (tracked_keyword_id, position, source)
           VALUES ($1, $2, $3)
           RETURNING *""",
        tracked_keyword_id,
        position,
        source,
    )
    return row


async def run_weekly_keyword_ranking_checks(db) -> dict[str, int]:
    """Iterate all active tracked keywords; one failure must not abort the batch."""
    rows = await db.fetch(
        """SELECT id, keyword, target_url
           FROM public.tracked_keywords
           WHERE is_active = true
           ORDER BY created_at ASC"""
    )

    checked = 0
    failed = 0
    for row in rows:
        result = await check_and_persist_ranking(
            db,
            tracked_keyword_id=str(row["id"]),
            keyword=row["keyword"],
            target_url=row["target_url"],
            source="scheduled",
        )
        if result is None:
            failed += 1
        else:
            checked += 1

    return {"checked": checked, "failed": failed, "total": len(rows)}
