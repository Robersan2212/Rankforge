export interface HeadingsByLevel {
  h1: string[];
  h2: string[];
  h3: string[];
  h4: string[];
  h5: string[];
  h6: string[];
}

export type CompetitorPageStatus = "ok" | "skipped" | "failed";

export interface CompetitorPageResult {
  url: string;
  rank_position?: number;
  status: CompetitorPageStatus;
  reason?: string;
  headings?: HeadingsByLevel;
  word_count?: number;
  topics_covered?: string[];
  faq_questions?: string[];
  scraped_at?: string;
}

export const USER_AGENT =
  "RankforgeBot/1.0 (+https://rankforge.app/bot-info)";

export const MAX_URL_LENGTH = 2048;
export const CONNECT_TIMEOUT_MS = 5_000;
export const CRAWL_TIMEOUT_MS = 15_000;
export const MAX_HTML_BYTES = 10 * 1024 * 1024;
export const MAX_REDIRECTS = 10;
export const BATCH_CONCURRENCY = 3;
