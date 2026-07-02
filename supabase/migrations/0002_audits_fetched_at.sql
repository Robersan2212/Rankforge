ALTER TABLE public.audits
  ADD COLUMN IF NOT EXISTS fetched_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_audits_project_id ON public.audits(project_id);
