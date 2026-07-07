# Rankforge API

FastAPI backend for Rankforge. Handles business logic, Postgres access, MCP service orchestration, and AI-powered content gap analysis and brief generation.

## Role in the stack

The Next.js frontend (`apps/web`) proxies authenticated requests to this FastAPI backend. The API verifies JWTs, enforces project ownership, coordinates MCP microservices, and reads and writes Postgres.

## Entry point

[`main.py`](main.py) creates the FastAPI app, configures CORS for `http://localhost:3000`, and mounts the projects router.

[`routers/projects.py`](routers/projects.py) defines all `/api/projects/*` endpoints.

## Folder structure

```
apps/api/
├── main.py              # App entry, CORS, health check
├── auth.py              # JWT validation, dev auth bypass
├── env.py               # Loads apps/api/.env
├── rate_limit.py        # Per-user rate limits
├── routers/
│   └── projects.py      # All REST endpoints
├── services/
│   ├── page_auditor.py       # Calls page-auditor MCP
│   ├── serp.py                 # Calls serp MCP
│   ├── competitor_analysis.py  # Calls competitor-analysis MCP
│   ├── competitor_pipeline.py  # SERP → scrape → gap → DB
│   ├── content_gap.py          # Claude/OpenAI gap analysis
│   ├── brief_generator.py      # Claude brief generation
│   └── brief_pipeline.py       # Loads sources, persists brief
├── models/
│   └── brief_schema.py  # Pydantic ContentBrief output schema
├── agents/              # Anthropic agent policy docs
├── scripts/             # DB seeds, dev utilities
└── tests/               # pytest suite
```

## Authentication

All `/api/projects/*` routes require `Authorization: Bearer <token>`.

| Method | Details |
|--------|---------|
| **Production** | Supabase JWT verified via JWKS (`SUPABASE_URL`) or legacy HS256 (`SUPABASE_JWT_SECRET`) |
| **Dev bypass** | `DEV_AUTH_BYPASS=true` + `DEV_AUTH_TOKEN` — local only, never production |

See [`auth.py`](auth.py) and [`instructions/local-setup.md`](../../instructions/local-setup.md) for dev bypass setup.

## API endpoints

All routes are prefixed with `/api/projects`. Every resource is scoped to a project the authenticated user owns.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/stats` | User-wide artifact counts |
| GET | `/` | List projects |
| POST | `/` | Create project |
| GET | `/{project_id}` | Get project |
| DELETE | `/{project_id}` | Delete project |
| GET | `/{project_id}/stats` | Per-project counts |
| GET | `/{project_id}/audits` | List audits |
| POST | `/{project_id}/audits` | Run page audit (calls page-auditor MCP) |
| GET | `/{project_id}/audits/{audit_id}` | Get audit |
| DELETE | `/{project_id}/audits/{audit_id}` | Delete audit |
| GET | `/{project_id}/briefs` | List briefs |
| POST | `/{project_id}/briefs` | Create brief manually |
| POST | `/{project_id}/briefs/generate` | AI-generate brief from audit + competitor analysis |
| GET | `/{project_id}/briefs/{brief_id}` | Get brief |
| DELETE | `/{project_id}/briefs/{brief_id}` | Delete brief |
| GET | `/{project_id}/drafts` | List drafts |
| POST | `/{project_id}/drafts` | Create draft |
| GET | `/{project_id}/keywords` | List tracked keywords |
| POST | `/{project_id}/keywords` | Add tracked keyword |
| GET | `/{project_id}/competitor-analyses` | List competitor analyses |
| POST | `/{project_id}/competitor-analyses` | Start analysis (background job) |
| GET | `/{project_id}/competitor-analyses/{analysis_id}` | Poll analysis status/report |
| DELETE | `/{project_id}/competitor-analyses/{analysis_id}` | Delete analysis |

Interactive API docs: [http://localhost:8000/docs](http://localhost:8000/docs) (when running locally).

## Key services

| Service | Calls | Purpose |
|---------|-------|---------|
| `page_auditor.py` | page-auditor MCP (`PAGE_AUDITOR_URL`) | Crawl URL, return SEO report |
| `serp.py` | serp MCP (`SERP_URL`) | Fetch top SERP results for a keyword |
| `competitor_analysis.py` | competitor-analysis MCP (`COMPETITOR_ANALYSIS_URL`) | Extract content from competitor pages |
| `competitor_pipeline.py` | serp + competitor-analysis + content_gap | Full async competitor analysis job |
| `content_gap.py` | Anthropic/OpenAI API | Compare user page vs. competitors |
| `brief_generator.py` | Anthropic API | Generate structured `ContentBrief` |
| `brief_pipeline.py` | DB + brief_generator | Load audit/analysis, persist brief |

## Rate limits

In-memory per-user limits (see [`rate_limit.py`](rate_limit.py)):

- Audits: 10 per minute
- Brief generation: 5 per hour
- Competitor analyses: 5 per hour

## Environment variables

Copy [`apps/api/.env.example`](.env.example) to `apps/api/.env`. Key variables:

| Variable | Required | Purpose |
|----------|----------|---------|
| `SUPABASE_URL` | Yes | JWT verification (JWKS) |
| `DATABASE_URL` | Yes | Postgres connection (transaction pooler) |
| `PAGE_AUDITOR_URL` | For audits | page-auditor MCP HTTP endpoint |
| `SERP_URL` | For competitor analysis | serp MCP HTTP endpoint |
| `COMPETITOR_ANALYSIS_URL` | For competitor analysis | competitor-analysis MCP HTTP endpoint |
| `ANTHROPIC_API_KEY` | For briefs/gap | Claude API for gap analysis and brief generation |
| `ANTHROPIC_BRIEF_MODEL` | No | Brief model override |
| `ANTHROPIC_GAP_MODEL` | No | Gap analysis model override |
| `OPENAI_API_KEY` | No | Fallback for gap analysis if Claude unavailable |
| `SUPABASE_JWT_SECRET` | No | Legacy HS256 JWT verification only |
| `DEV_AUTH_*` | Local only | Dev auth bypass (never production) |
| `SUPABASE_SERVICE_ROLE_KEY` | Local only | For `seed_dev_user.py` only |

## Run locally

From the **repository root** (so `apps.api` imports resolve):

```bash
cd apps/api
python -m venv venv
# Windows: venv\Scripts\activate
pip install -r requirements.txt
# Ensure apps/api/.env is configured
uvicorn apps.api.main:app --reload --port 8000
```

Health check: `GET http://localhost:8000/health` → `{"status":"ok"}`

## Tests

From the repository root:

```bash
pytest apps/api/tests -q
```

Test modules cover auth, audits, competitor analyses, brief generation, content gap, and project isolation.

## Related docs

- [README.md](../../README.md) — project overview
- [apps/web/README.md](../web/README.md) — frontend that proxies to this API
- [mcp/README.md](../../mcp/README.md) — MCP services this API calls
- [supabase/README.md](../../supabase/README.md) — database schema
- [agents/README.md](agents/README.md) — Anthropic agent policies
