"""Load Anthropic agent policy and expose model/prompt helpers."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

_POLICY_PATH = (
    Path(__file__).resolve().parent / "policies" / "rankforge-token-cost-guidelines.md"
)

DEFAULT_DRAFT_MODEL = "claude-sonnet-4-5"


@lru_cache(maxsize=1)
def _load_policy_text() -> str:
    return _POLICY_PATH.read_text(encoding="utf-8")


def get_agent_system_prompt(agent_name: str, task_prompt: str) -> str:
    """Prepend shared cost/policy guidelines to a task-specific system prompt."""
    policy = _load_policy_text()
    return (
        f"{policy}\n\n"
        f"---\n\n"
        f"Agent: {agent_name}\n\n"
        f"{task_prompt}"
    )


def get_draft_model() -> str:
    return os.environ.get("ANTHROPIC_DRAFT_MODEL", DEFAULT_DRAFT_MODEL)
