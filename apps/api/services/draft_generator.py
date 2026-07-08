"""Claude-powered full draft generation with SSE streaming (FR-06)."""

from __future__ import annotations

import logging
import os
from collections.abc import AsyncIterator

from anthropic import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AsyncAnthropic,
    RateLimitError,
)

from apps.api.agents.policy import get_agent_system_prompt, get_draft_model
from apps.api.prompts.full_draft import (
    DraftBriefInput,
    FULL_DRAFT_SYSTEM,
    build_user_prompt,
    compute_max_tokens,
)
from apps.api.services.brief_errors import ClaudeAPIError

logger = logging.getLogger(__name__)

TIMEOUT_SECONDS = 120.0


def _anthropic_client() -> AsyncAnthropic:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ClaudeAPIError(
            "ANTHROPIC_API_KEY is not configured",
            user_message="Draft generation is not configured on the server.",
        )
    return AsyncAnthropic(api_key=api_key, timeout=TIMEOUT_SECONDS)


async def stream_full_draft(brief: DraftBriefInput) -> AsyncIterator[str]:
    """Stream draft text tokens from Claude."""
    client = _anthropic_client()
    model = get_draft_model()
    max_tokens = compute_max_tokens(brief.target_word_count)
    system = get_agent_system_prompt("draft-writer", FULL_DRAFT_SYSTEM)

    try:
        async with client.messages.stream(
            model=model,
            max_tokens=max_tokens,
            temperature=0.3,
            system=system,
            messages=[{"role": "user", "content": build_user_prompt(brief)}],
        ) as stream:
            async for event in stream:
                if event.type == "content_block_delta":
                    delta = event.delta
                    if hasattr(delta, "text") and delta.text:
                        yield delta.text

            final_message = await stream.get_final_message()
            usage = final_message.usage
            logger.info(
                "draft_generation_tokens model=%s input=%s output=%s",
                model,
                usage.input_tokens,
                usage.output_tokens,
            )
    except RateLimitError as exc:
        raise ClaudeAPIError(
            str(exc),
            user_message="Draft generation rate limit reached. Please try again shortly.",
        ) from exc
    except APIStatusError as exc:
        if exc.status_code == 404:
            raise ClaudeAPIError(
                str(exc),
                user_message=(
                    f"Draft model '{model}' is unavailable. "
                    "Set ANTHROPIC_DRAFT_MODEL in apps/api/.env (e.g. claude-sonnet-4-5)."
                ),
            ) from exc
        raise ClaudeAPIError(
            str(exc),
            user_message="Draft generation failed. Please try again.",
        ) from exc
    except (APITimeoutError, APIConnectionError) as exc:
        raise ClaudeAPIError(
            str(exc),
            user_message="Draft generation timed out. Please try again.",
        ) from exc
    except ClaudeAPIError:
        raise
    except Exception as exc:
        raise ClaudeAPIError(
            str(exc),
            user_message="Draft generation failed. Please try again.",
        ) from exc
