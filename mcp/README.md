# Rankforge MCP servers

Five independent MCP microservices built with [`@modelcontextprotocol/sdk`](https://www.npmjs.com/package/@modelcontextprotocol/sdk). Each exposes tools over **Streamable HTTP** (for deployment / Claude API connector) and **stdio** (for Cursor).

| Server | Port | Tools |
|--------|------|-------|
| `page-auditor` | 3001 | `audit_page` |
| `serp` | 3002 | `get_top_results`, `fetch_serp` |
| `competitor-analysis` | 3003 | `extract_page`, `analyze_competitors` |
| `content-db` | 3004 | `save_brief`, `list_briefs` |
| `content-brief` | 3005 | `generate_content_brief` |

## Prerequisites

- Node.js 18+
- Playwright Chromium (`page-auditor` runs `playwright install chromium` on `npm install`)
- `SERP_API_KEY` for live SERP (SerpAPI) — set in `mcp/serp/.env` or shell env
- `DATABASE_URL` (Supabase Postgres) for `content-db`
- `ANTHROPIC_API_KEY` for `content-brief`

## Run locally (HTTP)

```bash
cd mcp/page-auditor && npm install && npm start
cd mcp/serp && npm install && npm start
cd mcp/competitor-analysis && npm install && npm start
cd mcp/content-db && npm install && npm start
cd mcp/content-brief && npm install && npm start
```

### Health and REST endpoints

| Server | Health | REST endpoint | Body |
|--------|--------|---------------|------|
| page-auditor | `GET /health` | `POST /audit` | `{ "url": "https://..." }` |
| serp | `GET /health` | `POST /serp` | `{ "keyword": "seo tips", "count": 10 }` |
| competitor-analysis | `GET /health` | `POST /extract` | `{ "url": "https://..." }` |
| competitor-analysis | — | `POST /analyze-batch` | `{ "urls": [{ "url": "...", "rank_position": 1 }] }` |
| content-db | `GET /health` | MCP only | — |
| content-brief | `GET /health` | MCP only | — |

MCP endpoint (all servers): `POST http://127.0.0.1:<port>/mcp`

The FastAPI backend calls the page-auditor, serp, and competitor-analysis REST endpoints directly. See **FastAPI integration** below.

## FastAPI integration

When running the full Rankforge app, configure these in `apps/api/.env`:

| Env var | Default | MCP server |
|---------|---------|------------|
| `PAGE_AUDITOR_URL` | `http://127.0.0.1:3001` | page-auditor |
| `SERP_URL` | `http://127.0.0.1:3002` | serp |
| `COMPETITOR_ANALYSIS_URL` | `http://127.0.0.1:3003` | competitor-analysis |

Brief generation and content gap analysis run inside FastAPI via the Anthropic API (`ANTHROPIC_API_KEY` in `apps/api/.env`). The `content-brief` and `content-db` MCP servers are available for standalone use or Cursor integration.

## Run in Cursor (stdio)

The project includes a preconfigured [`.cursor/mcp.json`](../.cursor/mcp.json) using workspace-relative paths:

```json
{
  "mcpServers": {
    "rankforge-page-auditor": {
      "command": "npx",
      "args": ["tsx", "src/stdio.ts"],
      "cwd": "${workspaceFolder}/mcp/page-auditor"
    },
    "rankforge-serp": {
      "command": "npx",
      "args": ["tsx", "src/stdio.ts"],
      "cwd": "${workspaceFolder}/mcp/serp"
    }
  }
}
```

For servers that require secrets, add an `env` block (never commit real values):

```json
{
  "rankforge-serp": {
    "command": "npx",
    "args": ["tsx", "src/stdio.ts"],
    "cwd": "${workspaceFolder}/mcp/serp",
    "env": { "SERP_API_KEY": "<your-serpapi-key>" }
  },
  "rankforge-content-db": {
    "command": "npx",
    "args": ["tsx", "src/stdio.ts"],
    "cwd": "${workspaceFolder}/mcp/content-db",
    "env": { "DATABASE_URL": "<your-database-url>" }
  }
}
```

## Claude API (remote connector)

The Claude API MCP connector requires **HTTPS** URLs. Deploy a server (Railway, Render, Docker) or tunnel localhost, then reference the deployed `/mcp` endpoint in your Anthropic API request.

See [`mcp/examples/claude-mcp-request.mjs`](examples/claude-mcp-request.mjs) for a runnable template. Set `PAGE_AUDITOR_MCP_URL` and `SERP_MCP_URL` in your shell environment before running.

## Environment variables

| Variable | Server | Purpose |
|----------|--------|---------|
| `PORT` | all | HTTP port (defaults: 3001 / 3002 / 3003 / 3004 / 3005) |
| `SERP_API_KEY` | serp | SerpAPI key (required for live SERP) |
| `DATABASE_URL` | content-db | Postgres connection string |
| `ANTHROPIC_API_KEY` | content-brief | Anthropic API key (required for brief tool) |
| `ANTHROPIC_BRIEF_MODEL` | content-brief | Optional model override (default: `claude-haiku-4-5`) |

Template: [`mcp/serp/.env.example`](serp/.env.example)

## Docker (page-auditor)

```bash
cd mcp/page-auditor
docker build -t rankforge-page-auditor .
docker run -p 3001:3001 rankforge-page-auditor
```

## Security notes

- Do not expose MCP servers to the public internet without authentication.
- `content-db` writes to `public.briefs`; use a DB role with least privilege.
- RLS on Supabase still applies when using the anon/service patterns from the app; MCP uses direct `DATABASE_URL` — prefer a restricted DB user for MCP only.
- Never commit API keys or database credentials. Use `.env` files (gitignored) or secure secret management in deployment.

## Related docs

- [README.md](../README.md) — project overview
- [apps/api/README.md](../apps/api/README.md) — how FastAPI calls these services
- [instructions/local-setup.md](../instructions/local-setup.md) — local development setup
