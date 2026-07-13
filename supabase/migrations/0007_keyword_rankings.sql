-- FR-07: Keyword ranking tracker — extend tracked_keywords, add keyword_rankings

alter table public.tracked_keywords
  add column if not exists target_url text;

alter table public.tracked_keywords
  add column if not exists is_active boolean not null default true;

-- One active keyword string per project (allows re-add after soft-delete)
create unique index if not exists tracked_keywords_project_keyword_active_uidx
  on public.tracked_keywords (project_id, keyword)
  where is_active = true;

create table if not exists public.keyword_rankings (
  id uuid primary key default gen_random_uuid(),
  tracked_keyword_id uuid not null
    references public.tracked_keywords(id) on delete cascade,
  position integer,
  checked_at timestamptz not null default now(),
  source text not null default 'scheduled'
    check (source in ('scheduled', 'manual'))
);

create index if not exists idx_keyword_rankings_lookup
  on public.keyword_rankings (tracked_keyword_id, checked_at desc);

alter table public.keyword_rankings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'keyword_rankings'
      and policyname = 'project_member_keyword_rankings'
  ) then
    create policy project_member_keyword_rankings on public.keyword_rankings
      for all using (
        tracked_keyword_id in (
          select tk.id
          from public.tracked_keywords tk
          join public.projects p on p.id = tk.project_id
          where p.user_id = auth.uid()
        )
      );
  end if;
end $$;
