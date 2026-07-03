import { CompetitorError, errorToReason } from "./errors.js";
import { fetchPageHtml } from "./fetcher.js";
import { extractFaqQuestions, extractTopics } from "./extractor.js";
import { parseHtml } from "./parser.js";
import { checkRobotsAllowed } from "./robots.js";
import { sanitizeStringList } from "./sanitize.js";
import { validatePageUrl } from "./safety.js";
import type { CompetitorPageResult, HeadingsByLevel } from "./types.js";

function sanitizeHeadingsObj(headings: HeadingsByLevel): HeadingsByLevel {
  return {
    h1: sanitizeStringList(headings.h1),
    h2: sanitizeStringList(headings.h2),
    h3: sanitizeStringList(headings.h3),
    h4: sanitizeStringList(headings.h4),
    h5: sanitizeStringList(headings.h5),
    h6: sanitizeStringList(headings.h6),
  };
}

export async function extractPage(
  rawUrl: string,
  rankPosition?: number
): Promise<CompetitorPageResult> {
  const base: CompetitorPageResult = {
    url: rawUrl.trim(),
    rank_position: rankPosition,
    status: "failed",
  };

  try {
    const parsed = await validatePageUrl(rawUrl);
    const url = parsed.href;
    base.url = url;

    const allowed = await checkRobotsAllowed(parsed);
    if (!allowed) {
      return {
        ...base,
        status: "skipped",
        reason: "robots_disallowed",
      };
    }

    const { html, finalUrl } = await fetchPageHtml(url);
    const { headings, word_count, body_sample } = parseHtml(html);
    const sanitizedHeadings = sanitizeHeadingsObj(headings);
    const topics = extractTopics(
      { h2: sanitizedHeadings.h2, h3: sanitizedHeadings.h3 },
      body_sample
    );
    const faq_questions = sanitizeStringList(extractFaqQuestions(html));

    return {
      url: finalUrl,
      rank_position: rankPosition,
      status: "ok",
      headings: sanitizedHeadings,
      word_count,
      topics_covered: topics,
      faq_questions,
      scraped_at: new Date().toISOString(),
    };
  } catch (err) {
    if (err instanceof CompetitorError) {
      const reason = errorToReason(err.code);
      const status = err.code === "ROBOTS_DISALLOWED" ? "skipped" : "failed";
      return {
        ...base,
        status,
        reason,
      };
    }
    return {
      ...base,
      status: "failed",
      reason: "fetch_failed",
    };
  }
}
