export interface AuditMeta {
  title: string;
  title_length: number;
  description: string;
  description_length: number;
}

export interface AuditHeading {
  level: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  text: string;
}

export interface AuditLinks {
  internal: number;
  external: number;
}

export interface AuditImages {
  total: number;
  with_alt: number;
  missing_alt: number;
}

export interface AuditIssue {
  severity: "critical" | "warning" | "info";
  check: string;
  message: string;
  fix: string;
}

export interface AuditResult {
  url: string;
  crawled_at: string;
  meta: AuditMeta;
  headings: AuditHeading[];
  word_count: number;
  links: AuditLinks;
  images: AuditImages;
  seo_score: number;
  issues: AuditIssue[];
  ai_summary: string;
}
