import asyncio
import os
import sys

import asyncpg

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))
from apps.api.env import load_env_file

load_env_file()

MIGRATION_SQL = """
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
"""


async def main() -> None:
    conn = await asyncpg.connect(
        os.environ["DATABASE_URL"],
        ssl="require",
        statement_cache_size=0,
    )
    try:
        await conn.execute(MIGRATION_SQL)
        print("OK: applied 0003_audits_report_column migration")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
