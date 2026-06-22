export interface Project {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface Audit {
  id: string;
  project_id: string;
  url: string;
  results: Record<string, unknown>;
  seo_score: number;
  created_at: string;
}

export interface Brief {
  id: string;
  project_id: string;
  keyword: string;
  content: { title?: string } | null;
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
