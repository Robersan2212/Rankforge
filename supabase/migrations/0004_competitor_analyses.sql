-- FR-03: SERP competitor analysis jobs and scrape cache

create table public.competitor_analyses (
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

create table public.scraped_pages (
  url text primary key,
  result jsonb not null,
  scraped_at timestamptz not null default now()
);

create index competitor_analyses_project_id_idx
  on public.competitor_analyses (project_id, created_at desc);

create index scraped_pages_scraped_at_idx
  on public.scraped_pages (scraped_at desc);

alter table public.competitor_analyses enable row level security;
alter table public.scraped_pages enable row level security;

create policy "project_member_competitor_analyses" on public.competitor_analyses
  for all using (
    project_id in (select id from public.projects where user_id = auth.uid())
  );

-- Scraped pages are shared cache; only service role / API writes via direct connection
create policy "scraped_pages_read_authenticated" on public.scraped_pages
  for select using (auth.uid() is not null);

create policy "scraped_pages_write_service" on public.scraped_pages
  for all using (false);
