"""Background job pipeline for SR-02 semantic keyword clustering."""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

import asyncpg
from fastapi import HTTPException

from apps.api.services.keyword_cluster_labels import label_clusters
from apps.api.services.keyword_clustering import cluster_embeddings
from apps.api.services.keyword_embeddings import (
    embed_keywords_cached,
    embedding_to_pgvector,
)
from apps.api.services.keyword_research import (
    MAX_CANDIDATES,
    MIN_CANDIDATES,
    fetch_related_keywords,
)

logger = logging.getLogger(__name__)


async def _get_db_connection() -> asyncpg.Connection:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured")
    return await asyncpg.connect(
        database_url,
        ssl="require",
        statement_cache_size=0,
    )


def _normalize_research_keywords(raw: list[Any]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        keyword = str(item.get("keyword") or "").strip()
        if not keyword:
            continue
        key = keyword.lower()
        if key in seen:
            continue
        seen.add(key)
        volume = item.get("searchVolume", item.get("search_volume"))
        difficulty = item.get("difficulty", item.get("difficulty_score"))
        try:
            volume_i = int(volume) if volume is not None else None
        except (TypeError, ValueError):
            volume_i = None
        try:
            difficulty_f = float(difficulty) if difficulty is not None else None
        except (TypeError, ValueError):
            difficulty_f = None
        out.append(
            {
                "keyword": keyword,
                "searchVolume": volume_i,
                "difficulty": difficulty_f,
            }
        )
        if len(out) >= MAX_CANDIDATES:
            break
    return out


def _job_result_payload(
    *,
    seed_keyword: str,
    status: str,
    clusters: list[dict[str, Any]],
    error: str | None = None,
) -> dict[str, Any]:
    return {
        "status": status,
        "seedKeyword": seed_keyword,
        "clusters": clusters,
        "error": error,
    }


async def run_keyword_cluster_job(job_id: str) -> None:
    db = await _get_db_connection()
    try:
        row = await db.fetchrow(
            "SELECT * FROM public.keyword_cluster_jobs WHERE id = $1",
            job_id,
        )
        if row is None:
            return

        seed_keyword = row["seed_keyword"]
        project_id = str(row["project_id"])

        await db.execute(
            """UPDATE public.keyword_cluster_jobs
               SET status = 'running', error = NULL
               WHERE id = $1""",
            job_id,
        )

        try:
            research = await fetch_related_keywords(
                seed_keyword, limit=MAX_CANDIDATES
            )
            candidates = _normalize_research_keywords(research.get("keywords") or [])
            if len(candidates) < MIN_CANDIDATES:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        f"Keyword research returned only {len(candidates)} usable "
                        f"keywords (need at least {MIN_CANDIDATES})."
                    ),
                )

            texts = [c["keyword"] for c in candidates]
            embeddings = await embed_keywords_cached(db, texts)
            assignments = cluster_embeddings(embeddings)

            cluster_keyword_lists = [
                [texts[i] for i in assignment.keyword_indices]
                for assignment in assignments
            ]
            labels = await label_clusters(
                seed_keyword=seed_keyword,
                clusters=cluster_keyword_lists,
            )

            # Persist relational rows
            await db.execute(
                "DELETE FROM public.keyword_candidates WHERE job_id = $1",
                job_id,
            )
            await db.execute(
                "DELETE FROM public.keyword_clusters WHERE job_id = $1",
                job_id,
            )

            response_clusters: list[dict[str, Any]] = []
            for assignment, label in zip(assignments, labels):
                cluster_row = await db.fetchrow(
                    """INSERT INTO public.keyword_clusters
                       (project_id, job_id, seed_keyword, label)
                       VALUES ($1, $2, $3, $4)
                       RETURNING id""",
                    project_id,
                    job_id,
                    seed_keyword,
                    label,
                )
                cluster_id = str(cluster_row["id"])
                keyword_payload: list[dict[str, Any]] = []
                for index in assignment.keyword_indices:
                    cand = candidates[index]
                    await db.execute(
                        """INSERT INTO public.keyword_candidates
                           (project_id, job_id, cluster_id, seed_keyword, keyword,
                            search_volume, difficulty_score, embedding)
                           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector)""",
                        project_id,
                        job_id,
                        cluster_id,
                        seed_keyword,
                        cand["keyword"],
                        cand["searchVolume"],
                        cand["difficulty"],
                        embedding_to_pgvector(embeddings[index]),
                    )
                    keyword_payload.append(
                        {
                            "keyword": cand["keyword"],
                            "searchVolume": cand["searchVolume"],
                            "difficulty": cand["difficulty"],
                        }
                    )
                response_clusters.append(
                    {"label": label, "keywords": keyword_payload}
                )

            total_keywords = sum(len(c["keywords"]) for c in response_clusters)
            status = "complete"
            error = None
            if len(response_clusters) < 3:
                status = "partial"
                error = (
                    f"Only {len(response_clusters)} clusters produced "
                    "(expected at least 3)."
                )
            elif total_keywords < MIN_CANDIDATES:
                status = "partial"
                error = (
                    f"Only {total_keywords} keywords remained after clustering "
                    f"(expected at least {MIN_CANDIDATES})."
                )

            result = _job_result_payload(
                seed_keyword=seed_keyword,
                status=status,
                clusters=response_clusters,
                error=error,
            )
            await db.execute(
                """UPDATE public.keyword_cluster_jobs
                   SET status = $2,
                       result = $3::jsonb,
                       error = $4,
                       completed_at = $5
                   WHERE id = $1""",
                job_id,
                status,
                json.dumps(result),
                error,
                datetime.now(timezone.utc),
            )
            logger.info(
                "Keyword cluster job %s finished status=%s keywords=%s clusters=%s",
                job_id,
                status,
                total_keywords,
                len(response_clusters),
            )
        except Exception as exc:
            detail = (
                str(exc.detail)
                if isinstance(exc, HTTPException)
                else (str(exc) or "Clustering failed")
            )
            logger.exception("Keyword cluster job %s failed: %s", job_id, detail)
            result = _job_result_payload(
                seed_keyword=seed_keyword,
                status="failed",
                clusters=[],
                error=detail,
            )
            await db.execute(
                """UPDATE public.keyword_cluster_jobs
                   SET status = 'failed',
                       result = $2::jsonb,
                       error = $3,
                       completed_at = $4
                   WHERE id = $1""",
                job_id,
                json.dumps(result),
                detail,
                datetime.now(timezone.utc),
            )
    finally:
        await db.close()
