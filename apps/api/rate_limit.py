import time
from collections import defaultdict
from threading import Lock

from fastapi import HTTPException

_WINDOW_SECONDS = 60
_MAX_REQUESTS = 10

_buckets: dict[str, list[float]] = defaultdict(list)
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


def reset_rate_limits_for_tests() -> None:
    """Clear in-memory buckets (test helper only)."""
    with _lock:
        _buckets.clear()
