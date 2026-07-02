import { assertRobotsAllowed } from "./robots.js";
import { fetchPageHtml } from "./fetcher.js";
import { parseHtml } from "./parser.js";
import { buildScoreBreakdown, totalScore } from "./scorer.js";
import { validateAuditUrl } from "./safety.js";
import type { AuditReport } from "./types.js";

export async function auditUrl(rawUrl: string): Promise<AuditReport> {
  const parsed = await validateAuditUrl(rawUrl);
  const url = parsed.href;

  await assertRobotsAllowed(parsed);

  const { html, finalUrl } = await fetchPageHtml(url);
  const data = parseHtml(html, finalUrl);
  const score_breakdown = buildScoreBreakdown(data);
  const seo_score = totalScore(score_breakdown);

  return {
    url: finalUrl,
    fetched_at: new Date().toISOString(),
    meta_title: data.meta_title,
    meta_title_length: data.meta_title_length,
    meta_description: data.meta_description,
    meta_description_length: data.meta_description_length,
    headings: data.headings,
    word_count: data.word_count,
    links: data.links,
    images: data.images,
    seo_score,
    score_breakdown,
    errors: [],
  };
}

/** @deprecated Use auditUrl — kept for backward compatibility */
export const auditPage = auditUrl;
