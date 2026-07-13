import os

# Disable APScheduler during the whole pytest session (must run before app import).
os.environ.setdefault("ENABLE_KEYWORD_RANKING_SCHEDULER", "false")
os.environ.setdefault("SUPABASE_URL", "https://test-project.supabase.co")
