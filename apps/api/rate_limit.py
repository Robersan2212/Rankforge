import time
from collections import defaultdict
from threading import Lock

from fastapi import HTTPException

_WINDOW_SECONDS = 60
_MAX_REQUESTS = 10

_buckets: dict[str, list[float]] = defaultdict(list)
_competitor_buckets: dict[str, list[float]] = defaultdict(list)
_lock = Lock()

_COMPETITOR_WINDOW_SECONDS = 3600
_COMPETITOR_MAX_REQUESTS = 5


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


def reset_rate_limits_for_tests() -> None:
    """Clear in-memory buckets (test helper only)."""
    with _lock:
        _buckets.clear()
        _competitor_buckets.clear()


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
