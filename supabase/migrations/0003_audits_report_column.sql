-- Align audits table with FR-02 spec: report column + NOT NULL seo_score

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audits'
      AND column_name = 'results'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audits'
      AND column_name = 'report'
  ) THEN
    ALTER TABLE public.audits RENAME COLUMN results TO report;
  END IF;
END $$;

UPDATE public.audits SET seo_score = 0 WHERE seo_score IS NULL;
ALTER TABLE public.audits ALTER COLUMN seo_score SET DEFAULT 0;
ALTER TABLE public.audits ALTER COLUMN seo_score SET NOT NULL;

UPDATE public.audits SET report = '{}'::jsonb WHERE report IS NULL;
ALTER TABLE public.audits ALTER COLUMN report SET NOT NULL;
