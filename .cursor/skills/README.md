# Cursor agent skills (Rankforge)

Project-scoped skills for AI assistants working in this repo.

| Skill | Purpose |
|-------|---------|
| [supabase](./supabase/) | Supabase setup, auth, migrations, client usage |
| [supabase-postgres-best-practices](./supabase-postgres-best-practices/) | Postgres performance, RLS, schema patterns |

## Source

Installed from [supabase/agent-skills](https://github.com/supabase/agent-skills). Version lock: [`../../skills-lock.json`](../../skills-lock.json).

## Update skills

```bash
npx skills add supabase/agent-skills
```

That command may recreate `.agents/` (installer default). Copy updated skills into `.cursor/skills/` or re-run the move step. `.agents/` is gitignored.

## Related Cursor config

- [MCP servers](../mcp.json) — page auditor, SERP, content DB tools
