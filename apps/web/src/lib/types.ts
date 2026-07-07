export interface Project {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface UserStats {
  projects: number;
  audits: number;
  briefs: number;
  drafts: number;
  keywords: number;
}

export interface ProjectStats {
  audits: number;
  briefs: number;
  drafts: number;
  keywords: number;
  competitors: number;
}

export interface Brief {
  id: string;
  project_id: string;
  keyword: string;
  content: import("@/lib/brief-types").ContentBriefPayload | { title?: string } | Record<string, unknown> | null;
  source_audit_id?: string | null;
  source_competitor_analysis_id?: string | null;
  created_by?: string | null;
  status?: string | null;
  created_at: string;
}

export interface Draft {
  id: string;
  project_id: string;
  brief_id: string | null;
  title: string | null;
  content: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrackedKeyword {
  id: string;
  project_id: string;
  keyword: string;
  created_at: string;
}

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
  audit_id?: string;
  project_id?: string;
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

export interface Audit {
  id: string;
  project_id: string;
  url: string;
  report: AuditReport | Record<string, unknown>;
  /** Legacy column name from older migrations */
  results?: AuditReport | Record<string, unknown>;
  seo_score: number;
  fetched_at?: string | null;
  created_at: string;
}

export function getAuditPayload(
  audit: Pick<Audit, "report" | "results">
): AuditReport | Record<string, unknown> | undefined {
  return audit.report ?? audit.results;
}

export interface ContentGap {
  topics_missing_from_user_page: string[];
  topics_user_page_shares: string[];
}

export interface CompetitorPage {
  url: string;
  rank_position?: number;
  status: "ok" | "skipped" | "failed";
  reason?: string;
  headings?: HeadingsByLevel;
  word_count?: number;
  topics_covered?: string[];
  faq_questions?: string[];
  scraped_at?: string;
}

export interface CompetitorAnalysisReport {
  keyword: string;
  user_page_url: string;
  requested_at: string;
  results_requested: number;
  results_returned: number;
  competitors: CompetitorPage[];
  content_gap: ContentGap;
  user_page?: CompetitorPage;
}

export interface CompetitorAnalysis {
  id: string;
  project_id: string;
  keyword: string;
  user_page_url: string;
  status: "pending" | "running" | "completed" | "partial" | "failed";
  report: CompetitorAnalysisReport | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export function isCompetitorAnalysisReport(
  value: unknown
): value is CompetitorAnalysisReport {
  return (
    typeof value === "object" &&
    value !== null &&
    "competitors" in value &&
    "content_gap" in value
  );
}
