# Rankforge

Monorepo for Rankforge — user auth, project workspaces (FR-01), and SEO tooling (FR-02+).

## Structure

```
rankforge/
├── .cursor/
│   ├── mcp.json              # MCP server config (stdio)
│   └── skills/               # Supabase agent skills for Cursor
├── apps/
│   ├── web/                  # Next.js 14 frontend
│   └── api/                  # FastAPI backend
├── mcp/
│   ├── page-auditor/         # audit_page tool (port 3001)
│   ├── serp/                 # fetch_serp tool (port 3002)
│   └── content-db/         # save_brief / list_briefs (port 3004)
├── supabase/
│   ├── config.toml
│   └── migrations/
│       └── 0001_initial_schema.sql
└── .gitignore
```

## Prerequisites

- Node.js 18+
- Python 3.11+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Supabase project (hosted or local)

## Environment variables

Create these locally — **never commit** them (see `.gitignore`).

### `apps/web/.env.local`

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### `apps/api/.env`

```
SUPABASE_URL=https://<project-ref>.supabase.co
DATABASE_URL=postgresql://...
```

`SUPABASE_JWT_SECRET` is **optional** — only needed if your project still uses the legacy HS256 secret. New Supabase projects with **ECC signing keys** verify tokens automatically via JWKS using `SUPABASE_URL`.

### Local dev auth bypass (optional)

Skip the login page during local development:

1. Add `SUPABASE_SERVICE_ROLE_KEY` to `apps/api/.env` (Supabase Dashboard → Project Settings → API).
2. From the repo root, create the dev user and print env lines:

```bash
python apps/api/scripts/seed_dev_user.py
```

3. Copy the printed `DEV_AUTH_*` variables into **both** `apps/api/.env` and `apps/web/.env.local`.
4. Restart the API and web dev servers. Visiting `/` or `/login` redirects straight to `/dashboard`.

Default dev credentials (if you sign in manually instead): `dev@example.com` / `rankforge-dev-password`.

**Never set `DEV_AUTH_BYPASS=true` in production.**

See `apps/api/.env.example` and `apps/web/.env.example` for all variables.

## Supabase

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

Configure Google OAuth in Supabase Auth and Google Cloud Console (redirect URIs for `/auth/callback`).

## Backend

```bash
cd apps/api
python -m venv venv
# Windows: venv\Scripts\activate
pip install -r requirements.txt
# Load apps/api/.env (SUPABASE_JWT_SECRET, DATABASE_URL)
uvicorn apps.api.main:app --reload --port 8000
```

Run from the **repository root** so `apps.api` imports resolve.

## Frontend

```bash
cd apps/web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tests

From the repository root:

```bash
cd apps/api
pip install -r requirements.txt
cd ../..
pytest apps/api/tests -q
```

## Agent skills (Cursor)

Supabase skills live in [`.cursor/skills/`](.cursor/skills/). To refresh from upstream:

```bash
npx skills add supabase/agent-skills
```

Then copy from `.agents/skills/` into `.cursor/skills/` if the installer recreates `.agents/`.

## MCP servers

See [mcp/README.md](mcp/README.md) for running page auditor, SERP, and content DB tools via stdio (Cursor) or HTTP (Claude API connector).

## FR-01 acceptance criteria

- [ ] Register / sign in (email + Google OAuth → `/dashboard`)
- [ ] Create two named projects from the dashboard
- [ ] Audits scoped per project (API: `POST/GET /api/projects/{id}/audits`)
- [ ] `/dashboard` without session → `/login`
- [ ] `GET /api/projects` without token → 403; invalid JWT → 401
- [ ] `supabase db push` applies `0001_initial_schema.sql` cleanly

## Legacy FR-02 prototype

The previous root-level `backend/` and `frontend/` SEO auditor prototype was replaced by this layout. FR-02 will be integrated under `apps/api` and the project **Audits** tab in a later phase.
