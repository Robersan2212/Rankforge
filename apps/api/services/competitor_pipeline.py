import json
import logging
import os
from datetime import datetime, timedelta, timezone

import asyncpg

from apps.api.services.competitor_analysis import extract_page
from apps.api.services.content_gap import compute_content_gap
from apps.api.services.serp import get_top_results

logger = logging.getLogger(__name__)

SCRAPE_CACHE_TTL_HOURS = 24
MIN_SUCCESS_COUNT = 8


async def _get_db_connection() -> asyncpg.Connection:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured")
    return await asyncpg.connect(
        database_url,
        ssl="require",
        statement_cache_size=0,
    )


async def _get_cached_scrape(db: asyncpg.Connection, url: str) -> dict | None:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=SCRAPE_CACHE_TTL_HOURS)
    row = await db.fetchrow(
        """SELECT result FROM public.scraped_pages
           WHERE url = $1 AND scraped_at >= $2""",
        url,
        cutoff,
    )
    if row is None:
        return None
    result = row["result"]
    if isinstance(result, str):
        return json.loads(result)
    return dict(result)


async def _upsert_scrape_cache(
    db: asyncpg.Connection, url: str, result: dict
) -> None:
    await db.execute(
        """INSERT INTO public.scraped_pages (url, result, scraped_at)
           VALUES ($1, $2::jsonb, now())
           ON CONFLICT (url) DO UPDATE
           SET result = EXCLUDED.result, scraped_at = EXCLUDED.scraped_at""",
        url,
        json.dumps(result),
    )


async def _extract_with_cache(
    db: asyncpg.Connection,
    url: str,
    rank_position: int | None = None,
) -> dict:
    cached = await _get_cached_scrape(db, url)
    if cached is not None:
        if rank_position is not None:
            cached = {**cached, "rank_position": rank_position}
        return cached

    result = await extract_page(url, rank_position)
    if result.get("status") == "ok":
        await _upsert_scrape_cache(db, result.get("url", url), result)
    return result


async def run_competitor_analysis(analysis_id: str) -> None:
    db = await _get_db_connection()
    try:
        row = await db.fetchrow(
            "SELECT * FROM public.competitor_analyses WHERE id = $1",
            analysis_id,
        )
        if row is None:
            return

        keyword = row["keyword"]
        user_page_url = row["user_page_url"]

        await db.execute(
            """UPDATE public.competitor_analyses
               SET status = 'running'
               WHERE id = $1""",
            analysis_id,
        )

        serp_data = await get_top_results(keyword, count=10)
        serp_results = serp_data.get("results", [])

        batch_input = [
            {
                "url": item["url"],
                "rank_position": item.get("rank_position", index + 1),
            }
            for index, item in enumerate(serp_results)
            if item.get("url")
        ]

        competitors: list[dict] = []
        for item in batch_input:
            try:
                page = await _extract_with_cache(
                    db,
                    item["url"],
                    item.get("rank_position"),
                )
                competitors.append(page)
            except Exception as exc:
                logger.warning("Failed to extract %s: %s", item["url"], exc)
                competitors.append(
                    {
                        "url": item["url"],
                        "rank_position": item.get("rank_position"),
                        "status": "failed",
                        "reason": "fetch_failed",
                    }
                )

        user_page = await _extract_with_cache(db, user_page_url)

        all_competitor_topics: list[str] = []
        for comp in competitors:
            if comp.get("status") == "ok":
                all_competitor_topics.extend(comp.get("topics_covered") or [])

        user_topics = (
            user_page.get("topics_covered") or []
            if user_page.get("status") == "ok"
            else []
        )

        content_gap = await compute_content_gap(user_topics, all_competitor_topics)

        ok_count = sum(1 for c in competitors if c.get("status") == "ok")
        if ok_count >= MIN_SUCCESS_COUNT:
            job_status = "completed"
        elif ok_count > 0:
            job_status = "partial"
        else:
            job_status = "failed"

        report = {
            "keyword": keyword,
            "user_page_url": user_page_url,
            "requested_at": row["created_at"].isoformat()
            if row["created_at"]
            else datetime.now(timezone.utc).isoformat(),
            "results_requested": len(batch_input),
            "results_returned": ok_count,
            "competitors": competitors,
            "content_gap": content_gap,
            "user_page": user_page,
        }

        await db.execute(
            """UPDATE public.competitor_analyses
               SET status = $2, report = $3::jsonb, completed_at = now(), error = NULL
               WHERE id = $1""",
            analysis_id,
            job_status,
            json.dumps(report),
        )
    except Exception as exc:
        logger.exception("Competitor analysis %s failed", analysis_id)
        await db.execute(
            """UPDATE public.competitor_analyses
               SET status = 'failed', error = $2, completed_at = now()
               WHERE id = $1""",
            analysis_id,
            str(exc)[:500],
        )
    finally:
        await db.close()
