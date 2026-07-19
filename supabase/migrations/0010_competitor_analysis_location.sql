-- FR-03 extension: optional location filter for competitor analysis

alter table public.competitor_analyses
  add column if not exists location text;
