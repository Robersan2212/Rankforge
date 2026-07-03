# Local setup — Rankforge

How to run Rankforge on your machine: normal auth (Supabase login) or **dev bypass** (skip login during development).

## Prerequisites

- **Node.js** 18+
- **Python** 3.11+
- A **Supabase** project ([supabase.com/dashboard](https://supabase.com/dashboard))
- Optional: [Supabase CLI](https://supabase.com/docs/guides/cli) for migrations

## 1. Clone and open the repo

```powershell
git clone https://github.com/Robersan2212/Rankforge.git
cd Rankforge
```

Use whichever branch your team works on (for example `main` or `workspace`).

## 2. Apply the database schema

If the schema is not applied yet:

```powershell
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

Or run `supabase/migrations/0001_initial_schema.sql` in the Supabase SQL editor.

## 3. Environment files

Copy the templates and fill in your project values. **Never commit** real `.env` files.

### `apps/web/.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable-key>
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Where to find keys:** Supabase Dashboard → **Project Settings** → **API**

- Use the **Publishable** key (`sb_publishable_...`) for `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### `apps/api/.env`

```env
SUPABASE_URL=https://<project-ref>.supabase.co
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-1-us-east-1.pooler.supabase.com:6543/postgres
PAGE_AUDITOR_URL=http://127.0.0.1:3001
```

**Database URL:** Supabase Dashboard → **Project Settings** → **Database** → **Connection string** → **Transaction pooler** (port `6543`). On some networks the session pooler (`5432`) may time out; use transaction mode for local dev if needed.

Templates with comments: `apps/web/.env.example` and `apps/api/.env.example`.

## 4. Install dependencies

### API (Python)

From the repo root:

```powershell
cd apps\api
python -m venv venv
.\venv\Scripts\pip.exe install -r requirements.txt
cd ..\..
```

### Web (Node)

```powershell
cd apps\web
npm install
cd ..\..
```

On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

### Page auditor MCP (port 3001, required for audits)

```powershell
cd mcp\page-auditor
npm install
npm.cmd start
```

Health check: [http://127.0.0.1:3001/health](http://127.0.0.1:3001/health) → `{"status":"ok"}`

Add `PAGE_AUDITOR_URL=http://127.0.0.1:3001` to `apps/api/.env` (see `apps/api/.env.example`).

Apply migrations if not already applied (`supabase db push` or SQL editor):

- `supabase/migrations/0002_audits_fetched_at.sql`
- `supabase/migrations/0003_audits_report_column.sql` (renames `results` → `report`, enforces `seo_score NOT NULL`)

## 5. Run the app (normal auth)

You need **three terminals** for full audit functionality (API, web, page-auditor). API and web are required; page-auditor is required to run SEO audits.

### Terminal 1 — API (port 8000)

From the **repository root**:

```powershell
apps\api\venv\Scripts\python.exe -m uvicorn apps.api.main:app --reload --port 8000
```

You should see `Uvicorn running on http://127.0.0.1:8000`.

Health check: [http://localhost:8000/health](http://localhost:8000/health) → `{"status":"ok"}`

### Terminal 2 — Web (port 3000)

```powershell
cd apps\web
npm.cmd run dev
```

Wait for `Ready` and `Local: http://localhost:3000`.

Open [http://localhost:3000](http://localhost:3000).

### Terminal 3 — Page auditor (port 3001)

```powershell
cd mcp\page-auditor
npm.cmd start
```

### Normal login flow

1. Register or sign in at `/login` (email/password or Google OAuth if configured).
2. You are redirected to `/dashboard`.
3. Create projects from the dashboard.

Google OAuth (optional): configure in Supabase Auth and Google Cloud Console with redirect URI `http://localhost:3000/auth/callback`.

---

## Dev bypass (skip login locally)

Use this only on your machine for faster development. **Never enable in production.**

### What it does

- `/`, `/login`, and `/register` redirect to `/dashboard` without Supabase login.
- The API accepts a shared dev token instead of a real JWT.
- Default dev account: `dev@example.com` / `rankforge-dev-password`

### Setup (one time)

**1.** Add the **Secret** key to `apps/api/.env`:

Supabase Dashboard → **Project Settings** → **API** → **Secret keys** → copy the **default** secret (`sb_secret_...`).

```env
SUPABASE_SERVICE_ROLE_KEY=sb_secret_<your-full-secret-key>
```

Do **not** put this key in the web app or commit it to git.

**2.** Run the seed script from the **repo root**:

```powershell
apps\api\venv\Scripts\python.exe apps\api\scripts\seed_dev_user.py
```

Expected output:

- `OK: dev user ready via service role (dev@example.com)`
- `OK: updated apps\api\.env`
- `OK: updated apps\web\.env.local`

The script creates the dev user and writes these lines to **both** env files:

```env
DEV_AUTH_BYPASS=true
DEV_AUTH_USER_ID=<uuid>
DEV_AUTH_EMAIL=dev@example.com
DEV_AUTH_TOKEN=rankforge-dev-local
```

**3.** Restart both dev servers (API and web) so they reload env vars.

**4.** Open [http://localhost:3000](http://localhost:3000) — you should land on the dashboard immediately.

### Turn dev bypass off

Remove or comment out `DEV_AUTH_BYPASS=true` in both `apps/api/.env` and `apps/web/.env.local`, then restart both servers.

---

## Troubleshooting

| Problem | Fix |
|--------|-----|
| `uvicorn` not recognized | Use `apps\api\venv\Scripts\python.exe -m uvicorn ...` from repo root |
| Browser can’t reach localhost | Use **http://localhost:3000** for the UI, not port 8000 |
| Port 3000 not responding | Start `npm.cmd run dev` in `apps/web` and wait for `Ready` |
| API errors / empty dashboard | Start the API on port 8000; check `/health` |
| Seed script fails | Ensure full `SUPABASE_SERVICE_ROLE_KEY` is saved in `apps/api/.env` (not a placeholder) |
| DB connection fails | Use the **Session pooler** URL, not the direct `db.*.supabase.co` host |
| Changes to `.env` ignored | Restart both servers after editing env files |

## Quick reference

| URL | Service |
|-----|---------|
| http://localhost:3000 | Next.js web app |
| http://localhost:8000/health | FastAPI health check |
| http://localhost:8000/api/projects | Projects API (requires auth or dev bypass) |
| http://127.0.0.1:3001/health | Page auditor MCP health |
| http://127.0.0.1:3001/audit | Page auditor REST endpoint (POST `{ "url": "..." }`) |

### FR-02 demo: run an audit

1. Open a project → **Audits** tab.
2. Enter a public URL (e.g. `https://example.com`) and click **Run audit**.
3. Wait up to ~15s; the list shows the SEO score. Click a row to view the full report.
4. Re-run after editing a local HTML fixture to confirm the score changes.

## Related docs

- [README.md](../README.md) — project overview
- [mcp/README.md](../mcp/README.md) — MCP servers
- `apps/api/.env.example` / `apps/web/.env.example` — env variable templates
