-- FR-04: brief generation traceability
alter table public.briefs
  add column if not exists source_audit_id uuid references public.audits(id) on delete set null,
  add column if not exists source_competitor_analysis_id uuid
    references public.competitor_analyses(id) on delete set null,
  add column if not exists created_by uuid references public.users(id) on delete set null,
  add column if not exists status text default 'manual';

create index if not exists briefs_project_created_idx
  on public.briefs (project_id, created_at desc);

create index if not exists briefs_source_audit_idx
  on public.briefs (source_audit_id);

create index if not exists briefs_source_competitor_idx
  on public.briefs (source_competitor_analysis_id);
