import json
import logging
import math
import os
import re
from typing import Any, Protocol

import httpx

logger = logging.getLogger(__name__)

SIMILARITY_THRESHOLD = 0.75
MAX_TOPICS_PER_LIST = 40
DEFAULT_CLAUDE_GAP_MODEL = "claude-3-5-haiku-latest"


class EmbeddingProvider(Protocol):
    async def embed_texts(self, texts: list[str]) -> list[list[float]]: ...


def _tokenize(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", text.lower()))


def _jaccard_similarity(a: str, b: str) -> float:
    tokens_a = _tokenize(a)
    tokens_b = _tokenize(b)
    if not tokens_a or not tokens_b:
        return 0.0
    intersection = tokens_a & tokens_b
    union = tokens_a | tokens_b
    return len(intersection) / len(union)


def _cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(x * x for x in vec_a))
    norm_b = math.sqrt(sum(y * y for y in vec_b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _normalize_topics(topics: list[str]) -> list[str]:
    seen: set[str] = set()
    normalized: list[str] = []
    for topic in topics:
        cleaned = topic.strip()
        if not cleaned:
            continue
        key = cleaned.lower()
        if key in seen:
            continue
        seen.add(key)
        normalized.append(cleaned)
        if len(normalized) >= MAX_TOPICS_PER_LIST:
            break
    return normalized


def _parse_json_object(text: str) -> dict[str, Any]:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*", "", stripped)
        stripped = re.sub(r"\s*```$", "", stripped)
    return json.loads(stripped)


def _coerce_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    result: list[str] = []
    for item in value:
        if isinstance(item, str) and item.strip():
            result.append(item.strip())
    return result


def _validate_gap_result(payload: dict[str, Any]) -> dict[str, list[str]]:
    missing = _coerce_string_list(payload.get("topics_missing_from_user_page"))
    shared = _coerce_string_list(payload.get("topics_user_page_shares"))
    return {
        "topics_missing_from_user_page": missing,
        "topics_user_page_shares": shared,
    }


class OpenAIEmbeddingProvider:
    def __init__(self, api_key: str, model: str = "text-embedding-3-small"):
        self.api_key = api_key
        self.model = model

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/embeddings",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={"model": self.model, "input": texts},
            )
        if response.status_code >= 400:
            raise RuntimeError(
                f"OpenAI embeddings failed: HTTP {response.status_code}"
            )
        data = response.json()
        items = sorted(data["data"], key=lambda row: row["index"])
        return [row["embedding"] for row in items]


def _claude_gap_model() -> str:
    return os.environ.get("ANTHROPIC_GAP_MODEL", DEFAULT_CLAUDE_GAP_MODEL)


async def _compute_gap_with_claude(
    user_topics: list[str],
    competitor_topics: list[str],
) -> dict[str, list[str]]:
    from anthropic import AsyncAnthropic

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set")

    client = AsyncAnthropic(api_key=api_key)
    prompt = f"""You are an SEO content analyst. Compare topic coverage between a user's page and their SERP competitors.

User page topics:
{json.dumps(user_topics, ensure_ascii=False)}

Competitor topics (aggregated from top-ranking pages):
{json.dumps(competitor_topics, ensure_ascii=False)}

Identify:
1. topics_missing_from_user_page — competitor topics the user's page does NOT adequately cover (use semantic matching; "backlink building" matches "link building strategies").
2. topics_user_page_shares — user topics that ARE covered on the user's page and align with what competitors also discuss.

Rules:
- Only use topics from the lists above (exact wording or close paraphrase from competitor list for missing items).
- Do not invent new topics.
- Return ONLY valid JSON with exactly these two keys and string array values.
"""

    response = await client.messages.create(
        model=_claude_gap_model(),
        max_tokens=1024,
        temperature=0,
        messages=[{"role": "user", "content": prompt}],
    )

    text_blocks = [
        block.text
        for block in response.content
        if hasattr(block, "text") and block.type == "text"
    ]
    if not text_blocks:
        raise RuntimeError("Claude returned no text content for gap analysis")

    parsed = _parse_json_object("".join(text_blocks))
    return _validate_gap_result(parsed)


async def _compute_gap_with_embeddings(
    user_topics: list[str],
    competitor_topics: list[str],
    *,
    threshold: float,
) -> dict[str, list[str]]:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")

    provider = OpenAIEmbeddingProvider(api_key)
    missing: list[str] = []
    shared: list[str] = []

    all_texts = user_topics + competitor_topics
    embeddings = await provider.embed_texts(all_texts)
    user_embeddings = embeddings[: len(user_topics)]
    competitor_embeddings = embeddings[len(user_topics) :]

    for topic, comp_vec in zip(competitor_topics, competitor_embeddings):
        best = max(
            (_cosine_similarity(comp_vec, user_vec) for user_vec in user_embeddings),
            default=0.0,
        )
        if best >= threshold:
            shared.append(topic)
        else:
            missing.append(topic)

    user_shared = [
        u
        for u in user_topics
        if any(_jaccard_similarity(u, c) >= threshold for c in shared)
    ]

    return {
        "topics_missing_from_user_page": missing,
        "topics_user_page_shares": user_shared,
    }


def _compute_gap_with_jaccard(
    user_topics: list[str],
    competitor_topics: list[str],
    *,
    threshold: float,
) -> dict[str, list[str]]:
    missing: list[str] = []
    shared: list[str] = []

    for topic in competitor_topics:
        best = max(
            (_jaccard_similarity(topic, u) for u in user_topics),
            default=0.0,
        )
        if best >= threshold:
            shared.append(topic)
        else:
            missing.append(topic)

    user_shared = [
        u
        for u in user_topics
        if any(_jaccard_similarity(u, c) >= threshold for c in shared)
    ]

    return {
        "topics_missing_from_user_page": missing,
        "topics_user_page_shares": user_shared,
    }


async def compute_content_gap(
    user_topics: list[str],
    competitor_topics: list[str],
    *,
    threshold: float = SIMILARITY_THRESHOLD,
) -> dict[str, list[str]]:
    unique_user = _normalize_topics(user_topics)
    unique_competitor = _normalize_topics(competitor_topics)

    if not unique_competitor:
        return {
            "topics_missing_from_user_page": [],
            "topics_user_page_shares": unique_user,
        }

    if not unique_user:
        return {
            "topics_missing_from_user_page": unique_competitor,
            "topics_user_page_shares": [],
        }

    if os.environ.get("ANTHROPIC_API_KEY"):
        try:
            result = await _compute_gap_with_claude(unique_user, unique_competitor)
            logger.info("Content gap computed via Claude (%s)", _claude_gap_model())
            return result
        except Exception as exc:
            logger.warning(
                "Claude gap analysis failed (%s); trying fallback provider",
                exc,
            )

    if os.environ.get("OPENAI_API_KEY"):
        try:
            result = await _compute_gap_with_embeddings(
                unique_user,
                unique_competitor,
                threshold=threshold,
            )
            logger.info("Content gap computed via OpenAI embeddings")
            return result
        except Exception as exc:
            logger.warning(
                "OpenAI embedding gap analysis failed (%s); using Jaccard fallback",
                exc,
            )

    logger.warning(
        "No ANTHROPIC_API_KEY or OPENAI_API_KEY; using Jaccard fallback for content gap"
    )
    return _compute_gap_with_jaccard(
        unique_user,
        unique_competitor,
        threshold=threshold,
    )
