"""FR-04 content brief output schema and validation."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator


class RecommendedStructureSection(BaseModel):
    section_title: str
    purpose: str

    @field_validator("section_title", "purpose")
    @classmethod
    def non_empty(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("must be non-empty")
        return trimmed


class ContentBrief(BaseModel):
    primary_keyword: str
    target_word_count: int = Field(gt=0)
    recommended_structure: list[RecommendedStructureSection] = Field(min_length=1)
    semantic_keywords: list[str] = Field(min_length=5)
    suggested_headings: list[str] = Field(min_length=1)
    faq_questions: list[str] = Field(min_length=3)
    source_audit_id: str
    source_competitor_analysis_id: str
    generated_at: str

    @field_validator("primary_keyword", "source_audit_id", "source_competitor_analysis_id")
    @classmethod
    def non_empty_id(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("must be non-empty")
        return trimmed

    @field_validator("semantic_keywords", "suggested_headings", "faq_questions")
    @classmethod
    def non_empty_strings(cls, values: list[str]) -> list[str]:
        cleaned = [v.strip() for v in values if v and v.strip()]
        if len(cleaned) != len(values):
            raise ValueError("all items must be non-empty strings")
        return cleaned

    @field_validator("generated_at")
    @classmethod
    def valid_iso_timestamp(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("generated_at must be non-empty")
        datetime.fromisoformat(trimmed.replace("Z", "+00:00"))
        return trimmed

    @model_validator(mode="after")
    def validate_structure_not_empty(self) -> ContentBrief:
        if not self.recommended_structure:
            raise ValueError("recommended_structure must have at least one section")
        return self


class BriefValidationError(Exception):
    """Raised when brief output fails schema validation."""

    def __init__(self, message: str, errors: list[str] | None = None):
        super().__init__(message)
        self.errors = errors or [message]


def validate_content_brief(
    payload: dict[str, Any],
    *,
    source_audit_id: str,
    source_competitor_analysis_id: str,
) -> ContentBrief:
    """Validate and normalize a brief payload from the model."""
    data = {
        **payload,
        "source_audit_id": payload.get("source_audit_id") or source_audit_id,
        "source_competitor_analysis_id": payload.get("source_competitor_analysis_id")
        or source_competitor_analysis_id,
        "generated_at": payload.get("generated_at")
        or datetime.now(timezone.utc).isoformat(),
    }
    try:
        return ContentBrief.model_validate(data)
    except Exception as exc:
        raise BriefValidationError(
            f"Brief validation failed: {exc}",
            errors=[str(exc)],
        ) from exc


EMIT_CONTENT_BRIEF_TOOL: dict[str, Any] = {
    "name": "emit_content_brief",
    "description": (
        "Emit a validated SEO content brief synthesizing audit and competitor data."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "primary_keyword": {"type": "string"},
            "target_word_count": {"type": "integer", "minimum": 1},
            "recommended_structure": {
                "type": "array",
                "minItems": 1,
                "items": {
                    "type": "object",
                    "properties": {
                        "section_title": {"type": "string"},
                        "purpose": {"type": "string"},
                    },
                    "required": ["section_title", "purpose"],
                },
            },
            "semantic_keywords": {
                "type": "array",
                "minItems": 5,
                "items": {"type": "string"},
            },
            "suggested_headings": {
                "type": "array",
                "minItems": 1,
                "items": {"type": "string"},
            },
            "faq_questions": {
                "type": "array",
                "minItems": 3,
                "items": {"type": "string"},
            },
            "source_audit_id": {"type": "string"},
            "source_competitor_analysis_id": {"type": "string"},
            "generated_at": {"type": "string"},
        },
        "required": [
            "primary_keyword",
            "target_word_count",
            "recommended_structure",
            "semantic_keywords",
            "suggested_headings",
            "faq_questions",
            "source_audit_id",
            "source_competitor_analysis_id",
            "generated_at",
        ],
    },
}
