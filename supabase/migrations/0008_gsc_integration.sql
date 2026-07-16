-- SR-01: Google Search Console OAuth connections, metrics cache, OAuth state

create table if not exists public.gsc_connections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  gsc_property_url text not null,
  encrypted_access_token text not null,
  encrypted_refresh_token text not null,
  token_expires_at timestamptz not null,
  status text not null default 'connected'
    check (status in ('connected', 'disconnected', 'error')),
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id)
);

create table if not exists public.gsc_metrics_cache (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  audited_url text not null,
  impressions integer not null,
  clicks integer not null,
  ctr numeric(6,4) not null,
  avg_position numeric(6,2) not null,
  date_range_start date not null,
  date_range_end date not null,
  fetched_at timestamptz not null default now(),
  unique (project_id, audited_url, date_range_start, date_range_end)
);

create index if not exists idx_gsc_metrics_cache_lookup
  on public.gsc_metrics_cache (project_id, audited_url, fetched_at desc);

create table if not exists public.gsc_oauth_states (
  state text primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  code_verifier text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_gsc_oauth_states_expires
  on public.gsc_oauth_states (expires_at);

alter table public.gsc_connections enable row level security;
alter table public.gsc_metrics_cache enable row level security;
alter table public.gsc_oauth_states enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gsc_connections'
      and policyname = 'project_member_gsc_connections'
  ) then
    create policy project_member_gsc_connections on public.gsc_connections
      for all using (
        project_id in (select id from public.projects where user_id = auth.uid())
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gsc_metrics_cache'
      and policyname = 'project_member_gsc_metrics_cache'
  ) then
    create policy project_member_gsc_metrics_cache on public.gsc_metrics_cache
      for all using (
        project_id in (select id from public.projects where user_id = auth.uid())
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gsc_oauth_states'
      and policyname = 'user_own_gsc_oauth_states'
  ) then
    create policy user_own_gsc_oauth_states on public.gsc_oauth_states
      for all using (user_id = auth.uid());
  end if;
end $$;
