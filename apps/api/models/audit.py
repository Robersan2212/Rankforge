from typing import Any

from pydantic import BaseModel, Field


class ScoreCategory(BaseModel):
    score: int
    max: int
    notes: str


class ScoreBreakdown(BaseModel):
    title: ScoreCategory
    description: ScoreCategory
    headings: ScoreCategory
    content_length: ScoreCategory
    links: ScoreCategory
    images: ScoreCategory


class HeadingsByLevel(BaseModel):
    h1: list[str] = Field(default_factory=list)
    h2: list[str] = Field(default_factory=list)
    h3: list[str] = Field(default_factory=list)
    h4: list[str] = Field(default_factory=list)
    h5: list[str] = Field(default_factory=list)
    h6: list[str] = Field(default_factory=list)


class AuditReport(BaseModel):
    url: str
    fetched_at: str
    meta_title: str | None = None
    meta_title_length: int = 0
    meta_description: str | None = None
    meta_description_length: int = 0
    headings: HeadingsByLevel = Field(default_factory=HeadingsByLevel)
    word_count: int = 0
    links: dict[str, int] = Field(default_factory=dict)
    images: dict[str, Any] = Field(default_factory=dict)
    seo_score: int = 0
    score_breakdown: ScoreBreakdown | None = None
    errors: list[str] = Field(default_factory=list)
