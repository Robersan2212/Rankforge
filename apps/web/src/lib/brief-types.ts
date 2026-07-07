export interface ContentBriefPayload {
  primary_keyword: string;
  target_word_count: number;
  recommended_structure: Array<{ section_title: string; purpose: string }>;
  semantic_keywords: string[];
  suggested_headings: string[];
  faq_questions: string[];
  source_audit_id: string;
  source_competitor_analysis_id: string;
  generated_at: string;
  title?: string;
}

export function isGeneratedBriefContent(
  content: unknown
): content is ContentBriefPayload {
  if (!content || typeof content !== "object") return false;
  const c = content as Record<string, unknown>;
  return (
    typeof c.primary_keyword === "string" &&
    typeof c.target_word_count === "number" &&
    Array.isArray(c.semantic_keywords) &&
    Array.isArray(c.faq_questions)
  );
}
