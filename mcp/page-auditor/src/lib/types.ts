export interface ScoreCategory {
  score: number;
  max: number;
  notes: string;
}

export interface ScoreBreakdown {
  title: ScoreCategory;
  description: ScoreCategory;
  headings: ScoreCategory;
  content_length: ScoreCategory;
  links: ScoreCategory;
  images: ScoreCategory;
}

export interface HeadingsByLevel {
  h1: string[];
  h2: string[];
  h3: string[];
  h4: string[];
  h5: string[];
  h6: string[];
}

export interface AuditReport {
  url: string;
  fetched_at: string;
  meta_title: string | null;
  meta_title_length: number;
  meta_description: string | null;
  meta_description_length: number;
  headings: HeadingsByLevel;
  word_count: number;
  links: {
    internal_count: number;
    external_count: number;
  };
  images: {
    total: number;
    missing_alt_count: number;
    missing_alt_examples: string[];
  };
  seo_score: number;
  score_breakdown: ScoreBreakdown;
  errors: string[];
}

export interface ParsedPageData {
  meta_title: string | null;
  meta_title_length: number;
  meta_description: string | null;
  meta_description_length: number;
  headings: HeadingsByLevel;
  heading_levels_in_order: number[];
  word_count: number;
  links: {
    internal_count: number;
    external_count: number;
  };
  images: {
    total: number;
    missing_alt_count: number;
    missing_alt_examples: string[];
  };
}

export const USER_AGENT =
  "RankforgeAuditBot/1.0 (+https://rankforge.app/bot)";

export const MAX_URL_LENGTH = 2048;
export const CRAWL_TIMEOUT_MS = 15_000;
export const MAX_HTML_BYTES = 10 * 1024 * 1024;
