# Rankforge Web

Next.js 14 frontend for Rankforge. Provides authentication, the project dashboard, and the project workspace UI for audits, competitor analysis, briefs, drafts, and keyword tracking.

## Stack

- **Next.js 14** (App Router)
- **React 18** + **TypeScript**
- **Tailwind CSS** + **shadcn/ui** components
- **Supabase Auth** via `@supabase/ssr` (cookie-based sessions)
- **Lucide** icons

## Role in the stack

The browser talks to this Next.js app for UI and authentication. Authenticated requests are proxied to FastAPI (`apps/api`), which coordinates MCP services and Postgres. Supabase Auth manages sign-in and session cookies independently of the API layer.

## Folder structure

```
apps/web/src/
├── app/
│   ├── layout.tsx                    # Root layout, fonts, providers
│   ├── page.tsx                      # Landing (redirects authed users)
│   ├── login/                        # Sign in
│   ├── register/                     # Sign up
│   ├── auth/callback/route.ts        # OAuth code exchange
│   ├── (workspace)/
│   │   ├── layout.tsx                # Auth guard + sidebar shell
│   │   ├── dashboard/page.tsx        # Project list
│   │   └── project/[id]/[[...section]]/page.tsx  # Workspace sections
│   └── api/projects/                 # Route Handlers (proxy to FastAPI)
├── components/
│   ├── ui/                           # shadcn primitives
│   └── workspace/                    # Product UI (atomic design)
│       ├── atoms/
│       ├── molecules/
│       ├── organisms/
│       └── templates/
├── contexts/                         # React context (user email)
├── hooks/                            # Client hooks
└── lib/
    ├── supabase/                     # Client + server Supabase helpers
    ├── api-proxy.ts                # Route Handler proxy utilities
    ├── api-server.ts               # Server Component fetch helpers
    ├── api-client.ts               # Client-side fetch helpers
    ├── workspace.ts                # Section config and routing
    └── types.ts                    # Shared TypeScript types
```

## Workspace sections

Each project has five workspace tabs, defined in [`src/lib/workspace.ts`](src/lib/workspace.ts):

| Section | Route | API path | Description |
|---------|-------|----------|-------------|
| Audits | `/project/{id}/audits` | `audits` | Run and view on-page SEO audits |
| Competitors | `/project/{id}/competitors` | `competitor-analyses` | SERP competitor analysis and content gap |
| Briefs | `/project/{id}/briefs` | `briefs` | AI-generated and manual content briefs |
| Editor | `/project/{id}/editor` | `drafts` | Content drafts |
| Keywords | `/project/{id}/keywords` | `keywords` | Tracked keywords per project |

## Request flow

There are **no Server Actions**. All API mutations go through Next.js Route Handlers that proxy to FastAPI.

1. User signs in → Supabase sets a session cookie.
2. Server Components or Route Handlers call `getApiAuthorizationHeader()` to get `Bearer <access_token>`.
3. Requests are sent to FastAPI at `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`).
4. Client components call `/api/projects/...` Route Handlers, which forward the JWT to FastAPI.

Key files:

- [`src/lib/api-proxy.ts`](src/lib/api-proxy.ts) — proxy utilities for Route Handlers
- [`src/lib/api-server.ts`](src/lib/api-server.ts) — direct FastAPI fetch for Server Components
- [`src/lib/supabase/server.ts`](src/lib/supabase/server.ts) — server-side Supabase client

## Authentication

| Flow | Details |
|------|---------|
| Email/password | `/login`, `/register` via Supabase Auth |
| Google OAuth | Configured in Supabase Dashboard; callback at `/auth/callback` |
| Dev bypass | `DEV_AUTH_BYPASS=true` in `.env.local` — local only, redirects to dashboard without login |

Protected routes live under `(workspace)/` and require a valid session (or dev bypass).

## Environment variables

Copy [`.env.example`](.env.example) to `.env.local`:

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase publishable (anon) key |
| `NEXT_PUBLIC_API_URL` | No | FastAPI URL (default: `http://localhost:8000`) |
| `DEV_AUTH_BYPASS` | Local only | Skip login during development |
| `DEV_AUTH_USER_ID` | Local only | Dev user UUID from seed script |
| `DEV_AUTH_EMAIL` | Local only | Dev user email |
| `DEV_AUTH_TOKEN` | Local only | Shared dev token |

**Never** put `SUPABASE_SERVICE_ROLE_KEY` or other secret keys in the web app.

## Run locally

```bash
cd apps/web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The FastAPI backend must be running on port 8000. See [instructions/local-setup.md](../../instructions/local-setup.md) for the full multi-service setup.

## Related docs

- [README.md](../../README.md) — project overview
- [apps/api/README.md](../api/README.md) — backend API this app proxies to
- [instructions/local-setup.md](../../instructions/local-setup.md) — local development setup
- [supabase/README.md](../../supabase/README.md) — database and auth schema
