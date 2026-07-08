-- FR-06: draft generation metadata (status, model, word count, timestamp)
ALTER TABLE public.drafts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS generation_model text,
  ADD COLUMN IF NOT EXISTS word_count integer,
  ADD COLUMN IF NOT EXISTS generated_at timestamptz;
