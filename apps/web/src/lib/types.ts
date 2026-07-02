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
}

export interface Brief {
  id: string;
  project_id: string;
  keyword: string;
  content: { title?: string } | Record<string, unknown> | null;
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
  results: AuditReport | Record<string, unknown>;
  seo_score: number;
  fetched_at?: string | null;
  created_at: string;
}
