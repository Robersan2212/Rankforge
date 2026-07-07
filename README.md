# Rankforge

Rankforge is an AI-assisted **SEO content intelligence platform**. Signed-in users create **project workspaces** and run an end-to-end SEO workflow: page audits, competitor analysis, AI-generated content briefs, drafts, and keyword tracking — all scoped to a single project.

## What it solves

- **Fragmented SEO tooling** — on-page auditing, SERP research, content gap analysis, and brief writing live in one workspace instead of separate tools.
- **Lost context** — audits, competitor analyses, and briefs are linked per project so developers and content teams can trace how a brief was produced.
- **Repeatable pipeline** — crawl a page, compare it to SERP competitors, and generate a structured writing brief from the combined data.

## Architecture

| Layer | Location | Responsibility |
|-------|----------|----------------|
| Frontend | `apps/web` | Workspace UI, Supabase Auth sessions, API route proxies |
| Backend | `apps/api` | `/api/projects/*` routes, orchestration, Postgres access |
| MCP services | `mcp/*` | Page crawl, SERP, competitor extraction, brief tools (ports 3001–3005) |
| Data | `supabase/` | Postgres schema, RLS, auth integration |

**Request flow:** The browser loads the Next.js app, which authenticates via Supabase and proxies API calls to FastAPI with the user's JWT. FastAPI validates the token, reads and writes Postgres, and calls MCP microservices over HTTP for crawls, SERP, and competitor extraction.

## Key concepts

| Concept | Description |
|---------|-------------|
| **Project** | Isolated workspace; all SEO artifacts belong to one project |
| **Audit** | On-page SEO report for a URL (score + structured report JSON) |
| **Competitor analysis** | Async job: fetch SERP results, scrape top competitors, compute content gap |
| **Content gap** | Topics competitors cover that the user's page does not |
| **Brief** | AI-generated structured content plan, linked to source audit and competitor analysis |
| **Draft** | Stored editor content, optionally linked to a brief |
| **Tracked keyword** | Keyword string stored per project for future SERP workflows |
| **MCP server** | Independently runnable Node tool service (HTTP for FastAPI, stdio for Cursor) |

## Repository structure

```
rankforge/
├── apps/
│   ├── web/                  # Next.js 14 frontend
│   └── api/                  # FastAPI backend
├── mcp/
│   ├── page-auditor/         # On-page SEO crawl (port 3001)
│   ├── serp/                 # SerpAPI integration (port 3002)
│   ├── competitor-analysis/  # Competitor page extraction (port 3003)
│   ├── content-db/           # Brief persistence tools (port 3004)
│   └── content-brief/        # Standalone brief generation (port 3005)
├── supabase/
│   ├── config.toml
│   └── migrations/           # 0001–0005
├── instructions/             # Local development guide
└── .cursor/                  # Cursor MCP config and agent skills
```

The legacy root-level `backend/` folder is deprecated; all active code lives under `apps/` and `mcp/`.

## Prerequisites

- **Node.js** 18+
- **Python** 3.11+
- **[Supabase CLI](https://supabase.com/docs/guides/cli)** (for migrations)
- A **Supabase** project (hosted or local)
- Optional: **SerpAPI** key (competitor analysis), **Anthropic** API key (content gap + brief generation)

## Environment files

Create these locally from the `.env.example` templates — **never commit** real values.

| File | Used by | Template |
|------|---------|----------|
| `apps/web/.env.local` | Next.js frontend | [`apps/web/.env.example`](apps/web/.env.example) |
| `apps/api/.env` | FastAPI backend | [`apps/api/.env.example`](apps/api/.env.example) |
| `mcp/serp/.env` | SERP MCP server | [`mcp/serp/.env.example`](mcp/serp/.env.example) |

**Web (`apps/web/.env.local`):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`

**API (`apps/api/.env`):** `SUPABASE_URL`, `DATABASE_URL`, MCP service URLs (`PAGE_AUDITOR_URL`, `SERP_URL`, `COMPETITOR_ANALYSIS_URL`), optional `ANTHROPIC_API_KEY`

**Local dev only (never production):** `DEV_AUTH_*` bypass variables and `SUPABASE_SERVICE_ROLE_KEY` (for `seed_dev_user.py` only). See [instructions/local-setup.md](instructions/local-setup.md).

## Quick start

1. **Apply database schema**
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```

2. **Configure environment** — copy `.env.example` files and fill in your Supabase project values.

3. **Install and run** (from repo root):
   ```bash
   # API (port 8000)
   cd apps/api && python -m venv venv && pip install -r requirements.txt
   uvicorn apps.api.main:app --reload --port 8000

   # Web (port 3000)
   cd apps/web && npm install && npm run dev

   # Page auditor MCP (port 3001) — required for audits
   cd mcp/page-auditor && npm install && npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000).

For the full setup guide (dev auth bypass, optional MCP services, troubleshooting), see **[instructions/local-setup.md](instructions/local-setup.md)**.

## Tests

From the repository root:

```bash
cd apps/api && pip install -r requirements.txt
cd ../..
pytest apps/api/tests -q
```

## Documentation

| Document | Description |
|----------|-------------|
| [instructions/local-setup.md](instructions/local-setup.md) | Detailed local development setup |
| [apps/web/README.md](apps/web/README.md) | Next.js frontend guide |
| [apps/api/README.md](apps/api/README.md) | FastAPI backend guide |
| [supabase/README.md](supabase/README.md) | Database schema and migrations |
| [mcp/README.md](mcp/README.md) | MCP microservices (ports, tools, Cursor config) |
| [apps/api/agents/README.md](apps/api/agents/README.md) | Anthropic agent policies for API services |

## MCP servers

Five independent Node microservices expose SEO tools over **HTTP** (used by FastAPI) and **stdio** (used by Cursor). See [mcp/README.md](mcp/README.md) for ports, tools, and configuration.

## Agent skills (Cursor)

Supabase skills for Cursor live in [`.cursor/skills/`](.cursor/skills/). To refresh from upstream:

```bash
npx skills add supabase/agent-skills
```
