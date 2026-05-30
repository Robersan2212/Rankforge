-- Enable extensions
create extension if not exists "uuid-ossp";

-- Users table (mirrors auth.users — populated by trigger on signup)
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  created_at timestamptz default now()
);

-- Projects
create table public.projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null,
  name text not null,
  slug text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, slug)
);

-- Placeholder tables so foreign keys exist for later phases
create table public.audits (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade not null,
  url text not null,
  results jsonb,
  seo_score integer,
  created_at timestamptz default now()
);

create table public.briefs (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade not null,
  keyword text not null,
  content jsonb,
  created_at timestamptz default now()
);

create table public.drafts (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade not null,
  brief_id uuid references public.briefs(id) on delete set null,
  title text,
  content text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.tracked_keywords (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade not null,
  keyword text not null,
  created_at timestamptz default now()
);

-- Row-level security
alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.audits enable row level security;
alter table public.briefs enable row level security;
alter table public.drafts enable row level security;
alter table public.tracked_keywords enable row level security;

-- RLS policies
create policy "users_own_row" on public.users
  for all using (id = auth.uid());

create policy "users_own_projects" on public.projects
  for all using (user_id = auth.uid());

create policy "project_member_audits" on public.audits
  for all using (
    project_id in (select id from public.projects where user_id = auth.uid())
  );

create policy "project_member_briefs" on public.briefs
  for all using (
    project_id in (select id from public.projects where user_id = auth.uid())
  );

create policy "project_member_drafts" on public.drafts
  for all using (
    project_id in (select id from public.projects where user_id = auth.uid())
  );

create policy "project_member_tracked_keywords" on public.tracked_keywords
  for all using (
    project_id in (select id from public.projects where user_id = auth.uid())
  );

-- Auto-create user profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
