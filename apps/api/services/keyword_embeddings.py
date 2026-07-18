"""OpenAI embeddings with Postgres cache for SR-02 clustering."""

from __future__ import annotations

import hashlib
import logging
import os
import re
from typing import Any

from apps.api.services.content_gap import OpenAIEmbeddingProvider

logger = logging.getLogger(__name__)

DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small"


def _embedding_model() -> str:
    return os.environ.get("OPENAI_EMBEDDING_MODEL", DEFAULT_EMBEDDING_MODEL).strip()


def normalize_keyword(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def keyword_hash(normalized: str, model: str) -> str:
    payload = f"{model}:{normalized}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def embedding_to_pgvector(values: list[float]) -> str:
    """Format float list for asyncpg `$1::vector` bind."""
    return "[" + ",".join(str(float(v)) for v in values) + "]"


def embedding_from_pg(value: Any) -> list[float]:
    if value is None:
        return []
    if isinstance(value, list):
        return [float(v) for v in value]
    text = str(value).strip()
    if text.startswith("[") and text.endswith("]"):
        text = text[1:-1]
    if not text:
        return []
    return [float(part) for part in text.split(",") if part.strip()]


async def embed_keywords_cached(
    db,
    keywords: list[str],
) -> list[list[float]]:
    """Return embeddings aligned with `keywords`, using DB cache when possible."""
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")

    model = _embedding_model()
    provider = OpenAIEmbeddingProvider(api_key=api_key, model=model)

    normalized = [normalize_keyword(k) for k in keywords]
    hashes = [keyword_hash(n, model) for n in normalized]

    cached: dict[str, list[float]] = {}
    if hashes:
        rows = await db.fetch(
            """SELECT keyword_hash, embedding
               FROM public.keyword_embedding_cache
               WHERE keyword_hash = ANY($1::text[])""",
            hashes,
        )
        for row in rows:
            cached[row["keyword_hash"]] = embedding_from_pg(row["embedding"])

    missing_indices: list[int] = []
    missing_texts: list[str] = []
    for index, (norm, h) in enumerate(zip(normalized, hashes)):
        if h not in cached:
            missing_indices.append(index)
            missing_texts.append(norm)

    if missing_texts:
        logger.info(
            "Embedding %s keywords via OpenAI (%s cached)",
            len(missing_texts),
            len(keywords) - len(missing_texts),
        )
        # Retry failed items only (whole missing batch first; callers may retry)
        new_vectors = await provider.embed_texts(missing_texts)
        for index, vector, norm, h in zip(
            missing_indices, new_vectors, missing_texts, [hashes[i] for i in missing_indices]
        ):
            cached[h] = vector
            await db.execute(
                """INSERT INTO public.keyword_embedding_cache
                   (keyword_hash, keyword_normalized, embedding, model)
                   VALUES ($1, $2, $3::vector, $4)
                   ON CONFLICT (keyword_hash) DO UPDATE
                   SET embedding = EXCLUDED.embedding,
                       keyword_normalized = EXCLUDED.keyword_normalized,
                       model = EXCLUDED.model""",
                h,
                norm,
                embedding_to_pgvector(vector),
                model,
            )

    return [cached[h] for h in hashes]
