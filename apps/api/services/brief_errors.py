"""Typed errors for brief generation (FR-04)."""

from __future__ import annotations


class BriefGenerationError(Exception):
    """Base error for brief generation."""

    user_message: str = "Brief generation failed. Please try again."

    def __init__(self, message: str, *, user_message: str | None = None):
        super().__init__(message)
        if user_message:
            self.user_message = user_message


class UpstreamDataMissing(BriefGenerationError):
    user_message = "Required audit or competitor analysis data is missing or incomplete."


class ModelValidationFailed(BriefGenerationError):
    user_message = "The AI brief did not pass validation. Please try again."


class ClaudeAPIError(BriefGenerationError):
    user_message = "Brief generation service is temporarily unavailable."


class BriefRateLimited(BriefGenerationError):
    user_message = "Brief generation rate limit exceeded. Try again shortly."
