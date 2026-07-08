"""Seed project, brief, and draft fixtures for manual requirement testing (FR-05 / FR-06).

Creates or updates a dedicated workspace with a generated-style brief so the
editor sidebar and full draft generation can be exercised without running the
full audit/brief pipeline.

Run from repo root:
  apps\\api\\venv\\Scripts\\python.exe apps/api/scripts/seed_requirement_test_data.py
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from apps.api.env import load_env_file

PROJECT_NAME = "FR-05 / FR-06 Requirement Testing"
PROJECT_SLUG = "fr-05-requirement-testing"
BRIEF_KEYWORD = "best running shoes"
PRIMARY_KEYWORD = "best running shoes"
TARGET_WORD_COUNT = 800
SEMANTIC_KEYWORDS = [
    "trail running",
    "marathon training",
    "running shoes",
    "cushioned running shoes",
    "neutral running shoes",
]
DRAFT_TITLE = "FR-05 / FR-06 acceptance draft"


def _load_web_env() -> None:
    web_env = Path(__file__).resolve().parents[2] / "web" / ".env.local"
    if not web_env.exists():
        return
    for line in web_env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def _brief_payload() -> dict:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "primary_keyword": PRIMARY_KEYWORD,
        "target_word_count": TARGET_WORD_COUNT,
        "recommended_structure": [
            {
                "section_title": "Introduction",
                "purpose": "Hook the reader and introduce the topic.",
            },
            {
                "section_title": "Key features",
                "purpose": "Cover the main points for the target keyword.",
            },
        ],
        "semantic_keywords": SEMANTIC_KEYWORDS,
        "suggested_headings": [
            "Introduction",
            "What to Look For in Running Shoes",
            "Top Picks by Category",
            "How to Choose the Right Fit",
            "Frequently Asked Questions",
        ],
        "faq_questions": [
            "How often should I replace running shoes?",
            "What is the difference between neutral and stability shoes?",
            "Can I use trail shoes on pavement?",
        ],
        "source_audit_id": "00000000-0000-4000-8000-000000000001",
        "source_competitor_analysis_id": "00000000-0000-4000-8000-000000000002",
        "generated_at": now,
        "title": "Requirement testing brief",
    }


async def main() -> int:
    load_env_file()
    _load_web_env()

    database_url = os.environ.get("DATABASE_URL", "").strip()
    if not database_url:
        print("FAIL: DATABASE_URL is not set in apps/api/.env")
        return 1

    dev_user_id = os.environ.get("DEV_AUTH_USER_ID", "").strip()

    import asyncpg

    conn = await asyncpg.connect(database_url, ssl="require", statement_cache_size=0)
    try:
        user_id = dev_user_id
        if not user_id:
            row = await conn.fetchrow(
                "SELECT id FROM public.users WHERE email = $1",
                os.environ.get("DEV_AUTH_EMAIL", "dev@example.com"),
            )
            user_id = str(row["id"]) if row else None
        if not user_id:
            row = await conn.fetchrow(
                "SELECT id FROM public.users ORDER BY created_at LIMIT 1"
            )
            user_id = str(row["id"]) if row else None
        if not user_id:
            print(
                "FAIL: no users found. Run apps/api/scripts/seed_dev_user.py first "
                "or sign in via the web app."
            )
            return 1

        await conn.execute(
            """INSERT INTO public.users (id, email)
               VALUES ($1::uuid, $2)
               ON CONFLICT (id) DO NOTHING""",
            user_id,
            os.environ.get("DEV_AUTH_EMAIL", "dev@example.com"),
        )

        project = await conn.fetchrow(
            """SELECT id FROM public.projects
               WHERE user_id = $1::uuid AND slug = $2""",
            user_id,
            PROJECT_SLUG,
        )

        if project:
            project_id = str(project["id"])
            await conn.execute(
                """UPDATE public.projects
                   SET name = $1, updated_at = now()
                   WHERE id = $2::uuid""",
                PROJECT_NAME,
                project_id,
            )
            print(f"OK: reusing project {PROJECT_NAME}")
        else:
            project = await conn.fetchrow(
                """INSERT INTO public.projects (user_id, name, slug)
                   VALUES ($1::uuid, $2, $3)
                   RETURNING id""",
                user_id,
                PROJECT_NAME,
                PROJECT_SLUG,
            )
            project_id = str(project["id"])
            print(f"OK: created project {PROJECT_NAME}")

        brief = await conn.fetchrow(
            """SELECT id FROM public.briefs
               WHERE project_id = $1::uuid AND keyword = $2
               ORDER BY created_at DESC
               LIMIT 1""",
            project_id,
            BRIEF_KEYWORD,
        )

        payload = _brief_payload()
        if brief:
            brief_id = str(brief["id"])
            await conn.execute(
                """UPDATE public.briefs
                   SET content = $1::jsonb
                   WHERE id = $2::uuid""",
                json.dumps(payload),
                brief_id,
            )
            print("OK: updated requirement-testing brief")
        else:
            brief = await conn.fetchrow(
                """INSERT INTO public.briefs (project_id, keyword, content, status)
                   VALUES ($1::uuid, $2, $3::jsonb, 'completed')
                   RETURNING id""",
                project_id,
                BRIEF_KEYWORD,
                json.dumps(payload),
            )
            brief_id = str(brief["id"])
            print("OK: created requirement-testing brief")

        draft = await conn.fetchrow(
            """SELECT id FROM public.drafts
               WHERE project_id = $1::uuid AND title = $2
               ORDER BY updated_at DESC
               LIMIT 1""",
            project_id,
            DRAFT_TITLE,
        )

        if draft:
            draft_id = str(draft["id"])
            await conn.execute(
                """UPDATE public.drafts
                   SET brief_id = $1::uuid, updated_at = now()
                   WHERE id = $2::uuid""",
                brief_id,
                draft_id,
            )
            print("OK: reusing requirement-testing draft")
        else:
            draft = await conn.fetchrow(
                """INSERT INTO public.drafts (project_id, brief_id, title, content)
                   VALUES ($1::uuid, $2::uuid, $3, '')
                   RETURNING id""",
                project_id,
                brief_id,
                DRAFT_TITLE,
            )
            draft_id = str(draft["id"])
            print("OK: created requirement-testing draft")

        print()
        print("Requirement testing workspace is ready:")
        print(f"  Project:  /project/{project_id}/editor")
        print(f"  Draft:    /project/{project_id}/editor/{draft_id}")
        print(f"  Brief:    /project/{project_id}/briefs/{brief_id}")
        print()
        print("FR-05 acceptance inputs:")
        print(f"  Primary keyword:   {PRIMARY_KEYWORD}")
        print(f"  Target word count: {TARGET_WORD_COUNT}")
        print(f"  Semantic keywords: {', '.join(SEMANTIC_KEYWORDS)}")
        print()
        print("FR-06 manual checks:")
        print("  1. Open the draft URL above")
        print("  2. Confirm the brief is linked in the editor")
        print("  3. Click Generate Full Draft and confirm first token < 5s")
        print("  4. Watch incremental streaming into the editor")
        print("  5. Confirm final word count >= 600 and headings match the brief")
        print("  6. Refresh and confirm the draft persisted")
        print()
        print("FR-05 manual checks:")
        print("  1. Type a passage containing the primary keyword")
        print("  2. Verify all four sidebar metrics update without refresh")
        print("  3. Add a second heading and confirm heading validation updates")
        return 0
    finally:
        await conn.close()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
