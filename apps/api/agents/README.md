# Rankforge Anthropic agents

Policy and configuration for **runtime** agents that call the Anthropic API (`anthropic` Python SDK) from `apps/api`.

This is **not** for Cursor IDE rules. Cursor uses `.cursor/rules/` separately.

## Policy file

The active policy document is:

```
apps/api/agents/policies/rankforge-token-cost-guidelines.md
```

That file defines:

- Which Claude models to use (and when)
- `max_tokens`, temperature, and other generation limits
- Token/cost guardrails
- What agents must not do

## How agents should follow it

Every Anthropic call in this repo should:

1. **Load** `policies/rankforge-token-cost-guidelines.md` (or a module that reads it once at startup).
2. **Prepend** it to the API `system` prompt for every `messages.create` / `AsyncAnthropic` request.
3. **Read model and token limits** from shared config derived from that policy (not hard-coded per route).

Example pattern (when you implement a shared policy loader):

```python
from apps.api.agents.policy import get_agent_system_prompt, get_model_config

system = get_agent_system_prompt(agent_name="brief-writer")
config = get_model_config(task="brief-generation")

await client.messages.create(
    model=config.model,
    max_tokens=config.max_tokens,
    system=system,
    messages=[...],
)
```

Until `apps/api/agents/policy.py` exists, treat the markdown file as the contract and wire agents to it as you add them.

## Layout

```
apps/api/agents/
  README.md                                    ← this file
  policies/
    rankforge-token-cost-guidelines.md         ← active policy
  policy.py                                    ← (future) load policy + expose helpers
  config.py                                    ← (future) model IDs, max_tokens per task
```

## Related (different systems)

| Location | For |
|----------|-----|
| `apps/api/agents/policies/` | **Anthropic API agents** in FastAPI |
| `mcp/examples/` | Node `@anthropic-ai/sdk` + MCP connector examples |
| `.cursor/rules/` | Cursor IDE assistant only |

## Environment

Set in `apps/api/.env` (never commit):

```
ANTHROPIC_API_KEY=<your-anthropic-api-key>
```

Optional model overrides: `ANTHROPIC_BRIEF_MODEL`, `ANTHROPIC_GAP_MODEL`. See [`apps/api/.env.example`](../.env.example).
