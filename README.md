# Rankforge

Monorepo for Rankforge — user auth, project workspaces (FR-01), and SEO tooling (FR-02+).

## Structure

```
rankforge/
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
SUPABASE_URL=
SUPABASE_JWT_SECRET=
DATABASE_URL=postgresql://...
```

Use only the **anon** key in the frontend. The **JWT secret** and **service role** key stay on the backend only; never expose the service role key in client code.

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
