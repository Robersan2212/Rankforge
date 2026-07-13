"""Weekly keyword ranking checks (APScheduler equivalent to BullMQ cron)."""

from __future__ import annotations

import logging
import os

import asyncpg
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from apps.api.services.keyword_rankings import run_weekly_keyword_ranking_checks

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


async def _connect_db():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured")
    return await asyncpg.connect(
        database_url,
        ssl="require",
        statement_cache_size=0,
    )


async def weekly_keyword_ranking_job() -> None:
    logger.info("Starting weekly keyword ranking job")
    conn = await _connect_db()
    try:
        result = await run_weekly_keyword_ranking_checks(conn)
        logger.info("Weekly keyword ranking job finished: %s", result)
    except Exception:
        logger.exception("Weekly keyword ranking job failed")
    finally:
        await conn.close()


def start_keyword_ranking_scheduler() -> AsyncIOScheduler | None:
    """Start Monday 14:00 UTC weekly job if enabled. Returns scheduler or None."""
    global _scheduler
    enabled = os.environ.get("ENABLE_KEYWORD_RANKING_SCHEDULER", "true").lower()
    if enabled in ("0", "false", "no", "off"):
        logger.info("Keyword ranking scheduler disabled")
        return None

    if _scheduler is not None:
        return _scheduler

    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(
        weekly_keyword_ranking_job,
        CronTrigger(day_of_week="mon", hour=14, minute=0),
        id="weekly_keyword_rankings",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    _scheduler = scheduler
    logger.info("Keyword ranking scheduler started (Mon 14:00 UTC)")
    return scheduler


def shutdown_keyword_ranking_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("Keyword ranking scheduler stopped")
