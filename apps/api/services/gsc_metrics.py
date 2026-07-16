"""GSC metrics cache + audit report augmentation."""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException

from apps.api.services.gsc_oauth import get_connection_row, pick_property_for_url
from apps.api.services.search_console import fetch_gsc_metrics

logger = logging.getLogger(__name__)

CACHE_TTL_HOURS = 24
DEFAULT_RANGE_DAYS = 28


def default_date_range() -> tuple[str, str]:
    end = date.today() - timedelta(days=3)
    start = end - timedelta(days=DEFAULT_RANGE_DAYS - 1)
    return start.isoformat(), end.isoformat()


def url_matches_property(audited_url: str, property_url: str) -> bool:
    return pick_property_for_url([property_url], audited_url) is not None


async def augment_audit_report(
    db,
    *,
    project_id: str,
    audited_url: str,
    report: dict[str, Any],
    bypass_cache: bool = False,
) -> dict[str, Any]:
    """Merge GSC metrics into audit report when a connection exists. Never blocks audit."""
    connection = await get_connection_row(db, project_id)
    if connection is None:
        report["gsc_metrics"] = None
        report["gsc_connection"] = {"connected": False}
        return report

    property_url = connection["gsc_property_url"]
    report["gsc_connection"] = {
        "connected": True,
        "property_url": property_url,
        "status": connection["status"],
    }

    if not url_matches_property(audited_url, property_url):
        report["gsc_metrics"] = {
            "status": "url_not_in_property",
            "message": "This URL isn't in your connected Search Console property.",
            "property_url": property_url,
        }
        return report

    start, end = default_date_range()
    try:
        metrics = await fetch_gsc_metrics(
            project_id=project_id,
            url=audited_url,
            date_range_start=start,
            date_range_end=end,
            bypass_cache=bypass_cache,
        )
        report["gsc_metrics"] = metrics
    except HTTPException as exc:
        logger.warning(
            "GSC metrics fetch failed for project=%s url=%r: %s",
            project_id,
            audited_url,
            exc.detail,
        )
        if exc.status_code == 401:
            report["gsc_metrics"] = {
                "status": "reconnect_required",
                "message": "Google Search Console access was revoked. Reconnect to refresh metrics.",
            }
            report["gsc_connection"]["status"] = "disconnected"
        elif exc.status_code == 429:
            report["gsc_metrics"] = {
                "status": "quota_exceeded",
                "message": "Search Console API quota exceeded. Try again later.",
            }
        else:
            report["gsc_metrics"] = {
                "status": "unavailable",
                "message": str(exc.detail),
            }
    except Exception:
        logger.exception("Unexpected GSC metrics failure for project=%s", project_id)
        report["gsc_metrics"] = {
            "status": "unavailable",
            "message": "Could not load Search Console metrics.",
        }

    return report


async def get_connection_status(db, project_id: str) -> dict[str, Any]:
    try:
        row = await get_connection_row(db, project_id)
    except Exception as exc:
        if "gsc_connections" in str(exc) or type(exc).__name__ == "UndefinedTableError":
            return {
                "connected": False,
                "status": "not_connected",
                "schema_missing": True,
            }
        raise

    if row is None:
        try:
            disconn = await db.fetchrow(
                """SELECT status, gsc_property_url, connected_at, updated_at
                   FROM public.gsc_connections WHERE project_id = $1""",
                project_id,
            )
        except Exception as exc:
            if "gsc_connections" in str(exc) or type(exc).__name__ == "UndefinedTableError":
                return {
                    "connected": False,
                    "status": "not_connected",
                    "schema_missing": True,
                }
            raise
        if disconn and disconn["status"] == "disconnected":
            return {
                "connected": False,
                "status": "disconnected",
                "property_url": disconn["gsc_property_url"],
                "connected_at": _iso(disconn["connected_at"]),
                "needs_reconnect": True,
            }
        return {"connected": False, "status": "not_connected"}

    return {
        "connected": True,
        "status": row["status"],
        "property_url": row["gsc_property_url"],
        "connected_at": _iso(row["connected_at"]),
        "needs_reconnect": row["status"] != "connected",
    }


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()
