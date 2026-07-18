-- SR-02: Semantic keyword clustering (jobs, clusters, candidates, embedding cache)

create extension if not exists vector with schema extensions;

create table if not exists public.keyword_cluster_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  seed_keyword text not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'complete', 'partial', 'failed')),
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_keyword_cluster_jobs_project_created
  on public.keyword_cluster_jobs (project_id, created_at desc);

create table if not exists public.keyword_clusters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  job_id uuid not null references public.keyword_cluster_jobs(id) on delete cascade,
  seed_keyword text not null,
  label text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_keyword_clusters_job
  on public.keyword_clusters (job_id);

create table if not exists public.keyword_candidates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  job_id uuid not null references public.keyword_cluster_jobs(id) on delete cascade,
  cluster_id uuid references public.keyword_clusters(id) on delete set null,
  seed_keyword text not null,
  keyword text not null,
  search_volume integer,
  difficulty_score numeric(5,2),
  embedding extensions.vector(1536),
  created_at timestamptz not null default now()
);

create index if not exists idx_keyword_candidates_job
  on public.keyword_candidates (job_id);

create table if not exists public.keyword_embedding_cache (
  keyword_hash text primary key,
  keyword_normalized text not null,
  embedding extensions.vector(1536) not null,
  model text not null,
  created_at timestamptz not null default now()
);

alter table public.keyword_cluster_jobs enable row level security;
alter table public.keyword_clusters enable row level security;
alter table public.keyword_candidates enable row level security;
alter table public.keyword_embedding_cache enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'keyword_cluster_jobs'
      and policyname = 'project_member_keyword_cluster_jobs'
  ) then
    create policy project_member_keyword_cluster_jobs on public.keyword_cluster_jobs
      for all
      using (
        project_id in (
          select id from public.projects where user_id = auth.uid()
        )
      )
      with check (
        project_id in (
          select id from public.projects where user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'keyword_clusters'
      and policyname = 'project_member_keyword_clusters'
  ) then
    create policy project_member_keyword_clusters on public.keyword_clusters
      for all
      using (
        project_id in (
          select id from public.projects where user_id = auth.uid()
        )
      )
      with check (
        project_id in (
          select id from public.projects where user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'keyword_candidates'
      and policyname = 'project_member_keyword_candidates'
  ) then
    create policy project_member_keyword_candidates on public.keyword_candidates
      for all
      using (
        project_id in (
          select id from public.projects where user_id = auth.uid()
        )
      )
      with check (
        project_id in (
          select id from public.projects where user_id = auth.uid()
        )
      );
  end if;

  -- Cache is shared lookup by hash; authenticated users may read/write rows
  -- they create during clustering (defense in depth; FastAPI uses service role).
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'keyword_embedding_cache'
      and policyname = 'authenticated_keyword_embedding_cache'
  ) then
    create policy authenticated_keyword_embedding_cache on public.keyword_embedding_cache
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;
