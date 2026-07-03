import { logicalHierarchyOk } from "./parser.js";
import type { ParsedPageData, ScoreBreakdown, ScoreCategory } from "./types.js";

function category(score: number, max: number, notes: string): ScoreCategory {
  return { score: Math.round(score), max, notes };
}

export function scoreTitle(
  title: string | null,
  length: number
): ScoreCategory {
  const max = 15;
  if (!title?.trim()) {
    return category(0, max, "Meta title is missing");
  }
  if (length >= 30 && length <= 60) {
    return category(max, max, `Title length (${length}) is in the ideal 30–60 character range`);
  }
  if (length < 30) {
    const partial = Math.max(0, (length / 30) * max * 0.6);
    return category(partial, max, `Title is too short (${length} chars; ideal 30–60)`);
  }
  const over = length - 60;
  const partial = Math.max(0, max - over * 0.3);
  return category(partial, max, `Title is too long (${length} chars; ideal 30–60)`);
}

export function scoreDescription(
  desc: string | null,
  length: number
): ScoreCategory {
  const max = 15;
  if (!desc?.trim()) {
    return category(0, max, "Meta description is missing");
  }
  if (length >= 120 && length <= 160) {
    return category(max, max, `Description length (${length}) is in the ideal 120–160 character range`);
  }
  if (length < 120) {
    const partial = Math.max(0, (length / 120) * max * 0.7);
    return category(partial, max, `Description is too short (${length} chars; ideal 120–160)`);
  }
  const over = length - 160;
  const partial = Math.max(0, max - over * 0.25);
  return category(partial, max, `Description is too long (${length} chars; ideal 120–160)`);
}

export function scoreHeadings(data: ParsedPageData): ScoreCategory {
  const max = 20;
  const h1Count = data.headings.h1.length;
  const h2Count = data.headings.h2.length;
  const hierarchyOk = logicalHierarchyOk(data.heading_levels_in_order);

  let score = 0;
  const notes: string[] = [];

  if (h1Count === 1) {
    score += 8;
    notes.push("Exactly one H1 present");
  } else if (h1Count === 0) {
    notes.push("No H1 found");
  } else {
    score += 3;
    notes.push(`${h1Count} H1 tags found (ideal: exactly 1)`);
  }

  if (hierarchyOk) {
    score += 6;
    notes.push("Heading hierarchy is logical");
  } else {
    notes.push("Heading levels skip a rank");
  }

  if (h2Count >= 1) {
    score += 6;
    notes.push(`${h2Count} H2 subheading(s) present`);
  } else {
    notes.push("No H2 subheadings found");
  }

  return category(Math.min(score, max), max, notes.join("; "));
}

export function scoreContentLength(wordCount: number): ScoreCategory {
  const max = 20;
  if (wordCount >= 600) {
    return category(max, max, `${wordCount} words meets the 600+ word target`);
  }
  const ratio = wordCount / 600;
  const score = Math.max(0, ratio * max);
  return category(
    score,
    max,
    `${wordCount} words (scaled; full points at 600+)`
  );
}

export function scoreLinks(links: ParsedPageData["links"]): ScoreCategory {
  const max = 15;
  let score = 0;
  const notes: string[] = [];

  if (links.internal_count > 0) {
    score += 10;
    notes.push(`${links.internal_count} internal link(s)`);
  } else {
    notes.push("No internal links");
  }

  if (links.external_count > 0) {
    score += 5;
    notes.push(`${links.external_count} external link(s)`);
  } else {
    notes.push("No external links");
  }

  return category(Math.min(score, max), max, notes.join("; "));
}

export function scoreImages(images: ParsedPageData["images"]): ScoreCategory {
  const max = 15;
  if (images.total === 0) {
    return category(max, max, "No images on page (full points)");
  }
  const withAlt = images.total - images.missing_alt_count;
  const pct = withAlt / images.total;
  const score = pct * max;
  return category(
    score,
    max,
    `${withAlt}/${images.total} images have alt text (${Math.round(pct * 100)}%)`
  );
}

export function buildScoreBreakdown(data: ParsedPageData): ScoreBreakdown {
  return {
    title: scoreTitle(data.meta_title, data.meta_title_length),
    description: scoreDescription(
      data.meta_description,
      data.meta_description_length
    ),
    headings: scoreHeadings(data),
    content_length: scoreContentLength(data.word_count),
    links: scoreLinks(data.links),
    images: scoreImages(data.images),
  };
}

export function totalScore(breakdown: ScoreBreakdown): number {
  const sum =
    breakdown.title.score +
    breakdown.description.score +
    breakdown.headings.score +
    breakdown.content_length.score +
    breakdown.links.score +
    breakdown.images.score;
  return Math.min(100, Math.round(sum));
}
