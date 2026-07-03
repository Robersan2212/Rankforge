# Rankforge MCP servers

Three independent MCP microservices built with [`@modelcontextprotocol/sdk`](https://www.npmjs.com/package/@modelcontextprotocol/sdk). Each exposes tools over **Streamable HTTP** (for deployment / Claude API connector) and **stdio** (for Cursor).

| Server | Port | Tools |
|--------|------|-------|
| `page-auditor` | 3001 | `audit_page` |
| `serp` | 3002 | `get_top_results`, `fetch_serp` |
| `competitor-analysis` | 3003 | `extract_page`, `analyze_competitors` |
| `content-db` | 3004 | `save_brief`, `list_briefs` |

## Prerequisites

- Node.js 18+
- Playwright Chromium (`page-auditor` runs `playwright install chromium` on `npm install`)
- `SERP_API_KEY` for live SERP (SerpAPI) — optional for `serp`
- `DATABASE_URL` (Supabase Postgres) for `content-db`

## Run locally (HTTP)

```bash
cd mcp/page-auditor && npm install && npm start
cd mcp/serp && npm install && npm start
cd mcp/competitor-analysis && npm install && npm start
cd mcp/content-db && npm install && npm start
```

Health: `GET http://127.0.0.1:3001/health`  
REST audit: `POST http://127.0.0.1:3001/audit` with body `{ "url": "https://..." }` (used by FastAPI)  
REST SERP: `POST http://127.0.0.1:3002/serp` with body `{ "keyword": "seo tips", "count": 10 }`  
REST extract: `POST http://127.0.0.1:3003/extract` with body `{ "url": "https://..." }`  
REST batch: `POST http://127.0.0.1:3003/analyze-batch` with body `{ "urls": [{ "url": "...", "rank_position": 1 }] }`  
MCP endpoint: `POST http://127.0.0.1:3001/mcp`

## Run in Cursor (stdio)

Add to Cursor MCP settings (`.cursor/mcp.json` in your project or global config):

```json
{
  "mcpServers": {
    "rankforge-page-auditor": {
      "command": "npx",
      "args": ["tsx", "c:/developer/senior-project/Rankforge/mcp/page-auditor/src/stdio.ts"],
      "cwd": "c:/developer/senior-project/Rankforge/mcp/page-auditor"
    },
    "rankforge-serp": {
      "command": "npx",
      "args": ["tsx", "c:/developer/senior-project/Rankforge/mcp/serp/src/stdio.ts"],
      "cwd": "c:/developer/senior-project/Rankforge/mcp/serp",
      "env": { "SERP_API_KEY": "your-serpapi-key" }
    },
    "rankforge-content-db": {
      "command": "npx",
      "args": ["tsx", "c:/developer/senior-project/Rankforge/mcp/content-db/src/stdio.ts"],
      "cwd": "c:/developer/senior-project/Rankforge/mcp/content-db",
      "env": { "DATABASE_URL": "postgresql://..." }
    }
  }
}
```

## Claude API (remote connector)

The Claude API MCP connector requires **HTTPS** URLs. Deploy a server (Railway, Render, Docker) or tunnel localhost, then call:

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const response = await client.beta.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 4096,
  betas: ["mcp-client-2025-11-20"],
  messages: [
    {
      role: "user",
      content:
        "Audit https://example.com and summarize the top SEO issues.",
    },
  ],
  mcp_servers: [
    {
      type: "url",
      name: "page-auditor",
      url: "https://your-deployed-host.example/mcp",
    },
    {
      type: "url",
      name: "serp",
      url: "https://your-serp-host.example/mcp",
      authorization_token: process.env.MCP_AUTH_TOKEN, // if you add auth
    },
  ],
  tools: [
    { type: "mcp_toolset", mcp_server_name: "page-auditor" },
    { type: "mcp_toolset", mcp_server_name: "serp" },
  ],
});
```

See `mcp/examples/claude-mcp-request.mjs` for a runnable template.

## Environment variables

| Variable | Server | Purpose |
|----------|--------|---------|
| `PORT` | all | HTTP port (defaults 3001 / 3002 / 3003 / 3004) |
| `SERP_API_KEY` | serp | SerpAPI key |
| `DATABASE_URL` | content-db | Postgres connection string |

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
