import { assertRobotsAllowed, parseRobotsTxt, isPathAllowedForRobots } from "./robots.js";
import { fetchPageHtml } from "./fetcher.js";
import { parseHtml } from "./parser.js";
import { sanitizeStringList, sanitizeText } from "./sanitize.js";
import { buildScoreBreakdown, totalScore } from "./scorer.js";
import { validateAuditUrl } from "./safety.js";
import type { AuditReport, HeadingsByLevel } from "./types.js";

function sanitizeHeadings(headings: HeadingsByLevel): HeadingsByLevel {
  return {
    h1: sanitizeStringList(headings.h1),
    h2: sanitizeStringList(headings.h2),
    h3: sanitizeStringList(headings.h3),
    h4: sanitizeStringList(headings.h4),
    h5: sanitizeStringList(headings.h5),
    h6: sanitizeStringList(headings.h6),
  };
}

export interface AuditUrlOptions {
  projectId?: string;
  auditId?: string;
}

export async function auditUrl(
  rawUrl: string,
  options: AuditUrlOptions = {}
): Promise<AuditReport> {
  const parsed = await validateAuditUrl(rawUrl);
  const url = parsed.href;

  await assertRobotsAllowed(parsed);

  const { html, finalUrl } = await fetchPageHtml(url);
  const data = parseHtml(html, finalUrl);
  const score_breakdown = buildScoreBreakdown(data);
  const seo_score = totalScore(score_breakdown);

  return {
    ...(options.auditId ? { audit_id: options.auditId } : {}),
    ...(options.projectId ? { project_id: options.projectId } : {}),
    url: finalUrl,
    fetched_at: new Date().toISOString(),
    meta_title: sanitizeText(data.meta_title),
    meta_title_length: data.meta_title_length,
    meta_description: sanitizeText(data.meta_description),
    meta_description_length: data.meta_description_length,
    headings: sanitizeHeadings(data.headings),
    word_count: data.word_count,
    links: data.links,
    images: {
      ...data.images,
      missing_alt_examples: sanitizeStringList(data.images.missing_alt_examples),
    },
    seo_score,
    score_breakdown,
    errors: [],
  };
}

/** @deprecated Use auditUrl — kept for backward compatibility */
export const auditPage = auditUrl;
