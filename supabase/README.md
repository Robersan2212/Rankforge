# Rankforge Database (Supabase)

Postgres schema, Row Level Security policies, and migrations for Rankforge. Auth is handled by Supabase Auth; application tables mirror and extend `auth.users`.

## Role in the stack

Supabase Auth manages `auth.users`. A signup trigger creates a matching row in `public.users`. Users own `projects`, and each project contains audits, briefs, drafts, tracked keywords, and competitor analyses.

The FastAPI backend connects directly to Postgres via `DATABASE_URL`. The Next.js frontend uses Supabase Auth for sessions but does not query application tables directly.

## Migrations

Migrations live in [`migrations/`](migrations/) and are applied in numeric order via `supabase db push`.

| File | Adds |
|------|------|
| `0001_initial_schema.sql` | `users`, `projects`, `audits`, `briefs`, `drafts`, `tracked_keywords` + RLS policies |
| `0002_audits_fetched_at.sql` | `fetched_at` timestamp on `audits` |
| `0003_audits_report_column.sql` | Renames `results` → `report`; enforces `seo_score NOT NULL` |
| `0004_competitor_analyses.sql` | `competitor_analyses` table, `scraped_pages` URL cache |
| `0005_brief_generation.sql` | Brief traceability columns (`source_audit_id`, `source_competitor_analysis_id`, `status`) |
| `0006_draft_generation.sql` | Draft generation fields (`status`, `generation_model`, `word_count`, `generated_at`) |
| `0007_keyword_rankings.sql` | Keyword tracker: `target_url`/`is_active` on `tracked_keywords`, `keyword_rankings` history |

## Tables

| Table | Purpose |
|-------|---------|
| `users` | Profile mirror of `auth.users` (populated by signup trigger) |
| `projects` | User-owned workspaces (`name`, `slug` unique per user) |
| `audits` | On-page SEO reports (`url`, `report` jsonb, `seo_score`, `fetched_at`) |
| `briefs` | Content briefs (`keyword`, `content` jsonb, source traceability, `status`) |
| `drafts` | Editor content (`title`, `content`, optional `brief_id`) |
| `tracked_keywords` | Keywords tracked per project (`target_url`, `is_active`) |
| `keyword_rankings` | Append-only ranking history (`position`, `checked_at`, `source`) |
| `competitor_analyses` | Async competitor jobs (`keyword`, `user_page_url`, `status`, `report`, `error`) |
| `scraped_pages` | Shared URL scrape cache (`result` jsonb, `scraped_at`) — 24h TTL |

## Data model

All SEO artifacts are **project-scoped**. A user owns projects; every audit, brief, draft, keyword, and competitor analysis belongs to exactly one project.

| Parent | Child tables | Notes |
|--------|--------------|-------|
| `users` | `projects` | One user, many projects |
| `projects` | `audits` | On-page SEO reports |
| `projects` | `briefs` | May reference `source_audit_id`, `source_competitor_analysis_id` |
| `projects` | `drafts` | May reference `brief_id` |
| `projects` | `tracked_keywords` | Keyword list per project |
| `tracked_keywords` | `keyword_rankings` | Append-only weekly/manual position history |
| `projects` | `competitor_analyses` | Async SERP + gap jobs |

`scraped_pages` is a shared cache keyed by URL, not scoped to a project. It avoids re-scraping the same URL within a 24-hour window.

## Row Level Security

RLS is enabled on all application tables. Policies ensure users can only read and write rows belonging to their own projects:

- `users` — users see only their own profile
- `projects` — filtered by `user_id`
- All child tables — filtered via `project_id` join to `projects.user_id`

The FastAPI backend also checks project ownership in application code (defense in depth).

## Apply schema

### Using Supabase CLI (recommended)

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

### Manual (SQL editor)

Run each migration file in numeric order in the Supabase Dashboard SQL editor.

## Auth configuration

- **Email/password** — enabled by default in Supabase Auth
- **Google OAuth** — configure in Supabase Dashboard → Authentication → Providers, and in Google Cloud Console with your app's redirect URI (e.g. `http://localhost:3000/auth/callback` for local dev)

Local Supabase CLI settings are in [`config.toml`](config.toml). For hosted projects, configure providers in the Supabase Dashboard.

## Connection strings

The FastAPI backend uses the **transaction pooler** connection string (port `6543`):

```
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@<pooler-host>:6543/postgres
```

Find this in Supabase Dashboard → **Project Settings** → **Database** → **Connection string** → **Transaction pooler**.

**Never commit** real connection strings or passwords.

## Related docs

- [README.md](../README.md) — project overview
- [apps/api/README.md](../apps/api/README.md) — how the API uses these tables
- [instructions/local-setup.md](../instructions/local-setup.md) — local setup including schema apply
- [mcp/README.md](../mcp/README.md) — content-db MCP also writes to `briefs`
