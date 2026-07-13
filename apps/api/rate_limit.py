import time
from collections import defaultdict
from threading import Lock

from fastapi import HTTPException

_WINDOW_SECONDS = 60
_MAX_REQUESTS = 10
_BRIEF_WINDOW_SECONDS = 3600
_BRIEF_MAX_REQUESTS = 5
_COMPETITOR_WINDOW_SECONDS = 3600
_COMPETITOR_MAX_REQUESTS = 5
_DRAFT_WINDOW_SECONDS = 3600
_DRAFT_MAX_REQUESTS = 5
_KEYWORD_REFRESH_WINDOW_SECONDS = 300  # 5 minutes per keyword
_KEYWORD_REFRESH_MAX_REQUESTS = 1

_buckets: dict[str, list[float]] = defaultdict(list)
_brief_buckets: dict[str, list[float]] = defaultdict(list)
_competitor_buckets: dict[str, list[float]] = defaultdict(list)
_draft_buckets: dict[str, list[float]] = defaultdict(list)
_keyword_refresh_buckets: dict[str, list[float]] = defaultdict(list)
_active_generations: set[tuple[str, str]] = set()
_lock = Lock()


def check_rate_limit(user_id: str, *, max_requests: int = _MAX_REQUESTS) -> None:
    """Sliding-window rate limit per user (in-memory, suitable for MVP)."""
    now = time.monotonic()
    cutoff = now - _WINDOW_SECONDS

    with _lock:
        timestamps = _buckets[user_id]
        _buckets[user_id] = [t for t in timestamps if t > cutoff]
        if len(_buckets[user_id]) >= max_requests:
            raise HTTPException(
                status_code=429,
                detail="Audit rate limit exceeded (10 per minute). Try again shortly.",
            )
        _buckets[user_id].append(now)


def check_brief_rate_limit(
    user_id: str,
    *,
    max_requests: int = _BRIEF_MAX_REQUESTS,
    window_seconds: int = _BRIEF_WINDOW_SECONDS,
) -> None:
    """Sliding-window rate limit for brief generation (5 per hour)."""
    now = time.monotonic()
    cutoff = now - window_seconds

    with _lock:
        timestamps = _brief_buckets[user_id]
        _brief_buckets[user_id] = [t for t in timestamps if t > cutoff]
        if len(_brief_buckets[user_id]) >= max_requests:
            raise HTTPException(
                status_code=429,
                detail="Brief generation rate limit exceeded (5 per hour). Try again shortly.",
            )
        _brief_buckets[user_id].append(now)


def check_competitor_rate_limit(
    user_id: str, *, max_requests: int = _COMPETITOR_MAX_REQUESTS
) -> None:
    """Sliding-window rate limit for competitor analysis (5 per hour)."""
    now = time.monotonic()
    cutoff = now - _COMPETITOR_WINDOW_SECONDS

    with _lock:
        timestamps = _competitor_buckets[user_id]
        _competitor_buckets[user_id] = [t for t in timestamps if t > cutoff]
        if len(_competitor_buckets[user_id]) >= max_requests:
            raise HTTPException(
                status_code=429,
                detail=(
                    "Competitor analysis rate limit exceeded "
                    "(5 per hour). Try again later."
                ),
            )
        _competitor_buckets[user_id].append(now)


def check_draft_rate_limit(
    user_id: str,
    *,
    max_requests: int = _DRAFT_MAX_REQUESTS,
    window_seconds: int = _DRAFT_WINDOW_SECONDS,
) -> None:
    """Sliding-window rate limit for draft generation (5 per hour)."""
    now = time.monotonic()
    cutoff = now - window_seconds

    with _lock:
        timestamps = _draft_buckets[user_id]
        _draft_buckets[user_id] = [t for t in timestamps if t > cutoff]
        if len(_draft_buckets[user_id]) >= max_requests:
            raise HTTPException(
                status_code=429,
                detail=(
                    "Draft generation rate limit exceeded "
                    "(5 per hour). Try again shortly."
                ),
            )
        _draft_buckets[user_id].append(now)


def check_keyword_refresh_rate_limit(keyword_id: str) -> None:
    """Debounce manual ranking refresh (at most once per 5 minutes per keyword)."""
    now = time.monotonic()
    cutoff = now - _KEYWORD_REFRESH_WINDOW_SECONDS

    with _lock:
        timestamps = _keyword_refresh_buckets[keyword_id]
        _keyword_refresh_buckets[keyword_id] = [t for t in timestamps if t > cutoff]
        if len(_keyword_refresh_buckets[keyword_id]) >= _KEYWORD_REFRESH_MAX_REQUESTS:
            raise HTTPException(
                status_code=429,
                detail=(
                    "Keyword refresh rate limit exceeded "
                    "(once per 5 minutes). Try again shortly."
                ),
            )
        _keyword_refresh_buckets[keyword_id].append(now)


def try_acquire_generation_lock(user_id: str, brief_id: str) -> bool:
    """Return False if the same user+brief generation is already in flight."""
    key = (user_id, brief_id)
    with _lock:
        if key in _active_generations:
            return False
        _active_generations.add(key)
        return True


def release_generation_lock(user_id: str, brief_id: str) -> None:
    key = (user_id, brief_id)
    with _lock:
        _active_generations.discard(key)


def reset_rate_limits_for_tests() -> None:
    """Clear in-memory buckets (test helper only)."""
    with _lock:
        _buckets.clear()
        _brief_buckets.clear()
        _competitor_buckets.clear()
        _draft_buckets.clear()
        _keyword_refresh_buckets.clear()
        _active_generations.clear()
