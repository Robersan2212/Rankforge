-- FR-03: competitor analysis results (upstream dependency for FR-04)
create table if not exists public.competitor_analyses (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade not null,
  keyword text not null,
  user_page_url text not null,
  status text not null default 'pending',
  report jsonb,
  error text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

create table if not exists public.scraped_pages (
  url text primary key,
  result jsonb not null,
  scraped_at timestamptz default now()
);

alter table public.competitor_analyses enable row level security;
alter table public.scraped_pages enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'competitor_analyses'
      and policyname = 'project_member_competitor_analyses'
  ) then
    create policy project_member_competitor_analyses on public.competitor_analyses
      for all using (
        exists (
          select 1 from public.projects p
          where p.id = competitor_analyses.project_id
            and p.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'scraped_pages'
      and policyname = 'service_role_scraped_pages'
  ) then
    create policy service_role_scraped_pages on public.scraped_pages
      for all using (true);
  end if;
end $$;

create index if not exists competitor_analyses_project_id_idx
  on public.competitor_analyses (project_id, created_at desc);
