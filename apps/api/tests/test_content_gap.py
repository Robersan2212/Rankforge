import asyncio
import os
from unittest.mock import AsyncMock, MagicMock, patch

from apps.api.services.content_gap import compute_content_gap


def _without_ai_keys():
    return patch.dict(
        os.environ,
        {"ANTHROPIC_API_KEY": "", "OPENAI_API_KEY": ""},
        clear=False,
    )


def test_gap_finds_missing_topics_with_jaccard():
    with _without_ai_keys():
        gap = asyncio.run(
            compute_content_gap(
                user_topics=["keyword research"],
                competitor_topics=[
                    "keyword research",
                    "link building strategies",
                    "technical seo audit",
                ],
            )
        )
    assert "link building strategies" in gap["topics_missing_from_user_page"]
    assert "keyword research" in gap["topics_user_page_shares"] or any(
        "keyword" in t for t in gap["topics_user_page_shares"]
    )


def test_gap_empty_competitor_topics():
    with _without_ai_keys():
        gap = asyncio.run(
            compute_content_gap(
                user_topics=["seo basics"],
                competitor_topics=[],
            )
        )
    assert gap["topics_missing_from_user_page"] == []
    assert gap["topics_user_page_shares"] == ["seo basics"]


def test_gap_empty_user_topics():
    with _without_ai_keys():
        gap = asyncio.run(
            compute_content_gap(
                user_topics=[],
                competitor_topics=["content marketing", "backlinks"],
            )
        )
    assert "content marketing" in gap["topics_missing_from_user_page"]
    assert gap["topics_user_page_shares"] == []


def test_gap_uses_claude_when_anthropic_key_set():
    text_block = MagicMock()
    text_block.type = "text"
    text_block.text = (
        '{"topics_missing_from_user_page": ["link building"], '
        '"topics_user_page_shares": ["keyword research"]}'
    )
    mock_response = MagicMock()
    mock_response.content = [text_block]

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_response)

    with patch.dict(
        os.environ,
        {"ANTHROPIC_API_KEY": "sk-ant-test", "OPENAI_API_KEY": "sk-openai-test"},
        clear=False,
    ):
        with patch(
            "anthropic.AsyncAnthropic",
            return_value=mock_client,
        ):
            gap = asyncio.run(
                compute_content_gap(
                    user_topics=["keyword research"],
                    competitor_topics=["keyword research", "link building"],
                )
            )

    assert gap["topics_missing_from_user_page"] == ["link building"]
    assert gap["topics_user_page_shares"] == ["keyword research"]
    mock_client.messages.create.assert_awaited_once()


def test_gap_falls_back_to_jaccard_when_claude_fails():
    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(side_effect=RuntimeError("API down"))

    with patch.dict(
        os.environ,
        {"ANTHROPIC_API_KEY": "sk-ant-test", "OPENAI_API_KEY": ""},
        clear=False,
    ):
        with patch("anthropic.AsyncAnthropic", return_value=mock_client):
            gap = asyncio.run(
                compute_content_gap(
                    user_topics=["keyword research"],
                    competitor_topics=[
                        "keyword research",
                        "link building strategies",
                    ],
                )
            )

    assert "link building strategies" in gap["topics_missing_from_user_page"]
