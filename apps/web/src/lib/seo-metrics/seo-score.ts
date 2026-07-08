import type { KeywordUsageResult } from "./keywords";
import type { WordCountResult } from "./word-count";
import type { HeadingCounts, HeadingEntry } from "./headings";
import type { ReadabilityResult } from "./readability";
import {
  DEFAULT_WEIGHTS,
  HEADING_EMPTY_OR_DUPLICATE_PENALTY,
  HEADING_LONG_DOC_WORD_THRESHOLD,
  HEADING_NO_H1_H2_PENALTY,
  HEADING_SINGLE_IN_LONG_DOC_PENALTY,
  HEADING_SKIPPED_LEVEL_PENALTY,
  HEADING_SKIPPED_LEVEL_PENALTY_CAP,
  IDEAL_WORDS_PER_USE,
  KEYWORD_MAX_DENSITY,
  KEYWORD_MIN_DENSITY,
  KEYWORD_STUFFING_PENALTY_FACTOR,
  NO_TARGET_WORD_COUNT_FALLBACK_SCORE,
  READABILITY_FLESCH_TARGET_HIGH,
  READABILITY_FLESCH_TARGET_LOW,
  SCORE_LABEL_GOOD_MAX,
  SCORE_LABEL_NEEDS_WORK_MAX,
  SCORE_LABELS,
  WORD_COUNT_OVER_PENALTY_FACTOR,
  WORD_COUNT_OVER_SCORE_FLOOR,
  WORD_COUNT_OVER_TOLERANCE,
  WORD_COUNT_UNDER_TOLERANCE,
  type WeightConfig,
} from "./seo-score-config";

export interface SeoScoreBreakdownItem {
  score: number;
  weight: number;
  detail: string;
}

export interface SeoScoreResult {
  overallScore: number;
  breakdown: {
    keyword: SeoScoreBreakdownItem;
    wordCount: SeoScoreBreakdownItem;
    headings: SeoScoreBreakdownItem;
    readability: SeoScoreBreakdownItem;
  };
  label: string;
}

export interface SeoScoreMetricsInput {
  wordCount: WordCountResult;
  keywords: KeywordUsageResult;
  headings: { counts: HeadingCounts };
  headingEntries: HeadingEntry[];
  readability: ReadabilityResult;
  hasPrimaryKeyword: boolean;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreToLabel(overallScore: number): string {
  if (overallScore <= SCORE_LABEL_NEEDS_WORK_MAX) {
    return SCORE_LABELS.needsWork;
  }
  if (overallScore <= SCORE_LABEL_GOOD_MAX) {
    return SCORE_LABELS.good;
  }
  return SCORE_LABELS.excellent;
}

export function scoreKeywordUsage(
  keywords: KeywordUsageResult,
  wordCount: number,
  hasPrimaryKeyword: boolean
): { score: number; detail: string } {
  if (!hasPrimaryKeyword) {
    return {
      score: 0,
      detail: "Link a brief or set a primary keyword",
    };
  }

  const uses = keywords.primary?.count ?? 0;
  if (uses === 0) {
    return { score: 0, detail: "Primary keyword not used yet" };
  }

  if (wordCount === 0) {
    return { score: 0, detail: "No content to score keyword usage" };
  }

  const usageDensity = (uses * IDEAL_WORDS_PER_USE) / wordCount;

  if (usageDensity < KEYWORD_MIN_DENSITY) {
    const score = clampScore(100 * (usageDensity / KEYWORD_MIN_DENSITY));
    return {
      score,
      detail: `Keyword used ${uses}x — below recommended density`,
    };
  }

  if (usageDensity <= KEYWORD_MAX_DENSITY) {
    return {
      score: 100,
      detail: `Keyword used ${uses}x — within target range`,
    };
  }

  const score = clampScore(
    Math.max(
      0,
      100 - (usageDensity - KEYWORD_MAX_DENSITY) * KEYWORD_STUFFING_PENALTY_FACTOR
    )
  );
  return {
    score,
    detail: `Keyword used ${uses}x — above recommended density`,
  };
}

export function scoreWordCount(
  wordCount: WordCountResult
): { score: number; detail: string } {
  const current = wordCount.current;
  if (current === 0) {
    return { score: 0, detail: "No content yet" };
  }

  const target = wordCount.target;
  if (target === undefined || target <= 0) {
    return {
      score: NO_TARGET_WORD_COUNT_FALLBACK_SCORE,
      detail: "No target word count — link a brief",
    };
  }

  const ratio = current / target;

  if (ratio < WORD_COUNT_UNDER_TOLERANCE) {
    const score = clampScore(
      100 * (current / (WORD_COUNT_UNDER_TOLERANCE * target))
    );
    return {
      score,
      detail: `${current.toLocaleString()} words — below target (${target.toLocaleString()})`,
    };
  }

  if (ratio <= WORD_COUNT_OVER_TOLERANCE) {
    return {
      score: 100,
      detail: `${current.toLocaleString()} words — within target range`,
    };
  }

  const score = clampScore(
    Math.max(
      WORD_COUNT_OVER_SCORE_FLOOR,
      100 - (ratio - WORD_COUNT_OVER_TOLERANCE) * WORD_COUNT_OVER_PENALTY_FACTOR
    )
  );
  return {
    score,
    detail: `${current.toLocaleString()} words — above target (${target.toLocaleString()})`,
  };
}

function countSkippedLevels(counts: HeadingCounts): number {
  const levelsPresent = (["h1", "h2", "h3", "h4", "h5", "h6"] as const).filter(
    (level) => counts[level] > 0
  );

  let skipped = 0;
  const allLevels = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;
  for (let i = 1; i < levelsPresent.length; i++) {
    const prevIdx = allLevels.indexOf(levelsPresent[i - 1]);
    const currIdx = allLevels.indexOf(levelsPresent[i]);
    if (currIdx - prevIdx > 1) {
      skipped += 1;
    }
  }
  return skipped;
}

function countEmptyHeadings(entries: HeadingEntry[]): number {
  return entries.filter((entry) => !entry.text.trim()).length;
}

function countDuplicateHeadings(entries: HeadingEntry[]): number {
  const seen = new Set<string>();
  let duplicates = 0;

  for (const entry of entries) {
    const normalized = entry.text.trim().toLowerCase();
    if (!normalized) continue;
    if (seen.has(normalized)) {
      duplicates += 1;
    } else {
      seen.add(normalized);
    }
  }

  return duplicates;
}

export function scoreHeadingStructure(
  counts: HeadingCounts,
  entries: HeadingEntry[],
  wordCount: number
): { score: number; detail: string } {
  if (counts.total === 0) {
    return {
      score: clampScore(100 - HEADING_NO_H1_H2_PENALTY),
      detail: "No headings — add structure with H1–H6",
    };
  }

  let penalty = 0;
  const issues: string[] = [];

  if (counts.h1 === 0 && counts.h2 === 0) {
    penalty += HEADING_NO_H1_H2_PENALTY;
    issues.push("missing H1/H2");
  }

  const skipped = countSkippedLevels(counts);
  if (skipped > 0) {
    penalty += Math.min(
      skipped * HEADING_SKIPPED_LEVEL_PENALTY,
      HEADING_SKIPPED_LEVEL_PENALTY_CAP
    );
    issues.push(
      skipped === 1 ? "skipped heading level" : `${skipped} skipped levels`
    );
  }

  const emptyCount = countEmptyHeadings(entries);
  if (emptyCount > 0) {
    penalty += emptyCount * HEADING_EMPTY_OR_DUPLICATE_PENALTY;
    issues.push(
      emptyCount === 1 ? "empty heading" : `${emptyCount} empty headings`
    );
  }

  const duplicateCount = countDuplicateHeadings(entries);
  if (duplicateCount > 0) {
    penalty += duplicateCount * HEADING_EMPTY_OR_DUPLICATE_PENALTY;
    issues.push(
      duplicateCount === 1
        ? "duplicate heading"
        : `${duplicateCount} duplicate headings`
    );
  }

  if (
    counts.total === 1 &&
    wordCount >= HEADING_LONG_DOC_WORD_THRESHOLD
  ) {
    penalty += HEADING_SINGLE_IN_LONG_DOC_PENALTY;
    issues.push("only one heading in a long document");
  }

  const score = clampScore(100 - penalty);
  const detail =
    issues.length > 0
      ? `Heading issues: ${issues.join(", ")}`
      : "Heading structure looks good";

  return { score, detail };
}

export function scoreReadabilityForSeo(
  readability: ReadabilityResult
): { score: number; detail: string } {
  const flesch = readability.score;

  if (flesch <= 0) {
    return {
      score: 0,
      detail: readability.label || "No readable content to score",
    };
  }

  if (
    flesch >= READABILITY_FLESCH_TARGET_LOW &&
    flesch <= READABILITY_FLESCH_TARGET_HIGH
  ) {
    return {
      score: 100,
      detail: `Flesch ${flesch} — ideal range for SEO content`,
    };
  }

  if (flesch < READABILITY_FLESCH_TARGET_LOW) {
    const score = clampScore(100 * (flesch / READABILITY_FLESCH_TARGET_LOW));
    return {
      score,
      detail: `Flesch ${flesch} — may be too difficult for readers`,
    };
  }

  const score = clampScore(
    100 *
      ((100 - flesch) / (100 - READABILITY_FLESCH_TARGET_HIGH))
  );
  return {
    score,
    detail: `Flesch ${flesch} — may be too simplistic for the topic`,
  };
}

function emptySeoScoreResult(weights: WeightConfig): SeoScoreResult {
  const zeroItem = (weight: number): SeoScoreBreakdownItem => ({
    score: 0,
    weight,
    detail: "No content yet",
  });

  return {
    overallScore: 0,
    breakdown: {
      keyword: zeroItem(weights.keyword),
      wordCount: zeroItem(weights.wordCount),
      headings: zeroItem(weights.headings),
      readability: zeroItem(weights.readability),
    },
    label: SCORE_LABELS.needsWork,
  };
}

export function calculateOverallSeoScore(
  metrics: SeoScoreMetricsInput,
  weights: WeightConfig = DEFAULT_WEIGHTS
): SeoScoreResult {
  if (metrics.wordCount.current === 0) {
    return emptySeoScoreResult(weights);
  }

  const keywordResult = scoreKeywordUsage(
    metrics.keywords,
    metrics.wordCount.current,
    metrics.hasPrimaryKeyword
  );
  const wordCountResult = scoreWordCount(metrics.wordCount);
  const headingsResult = scoreHeadingStructure(
    metrics.headings.counts,
    metrics.headingEntries,
    metrics.wordCount.current
  );
  const readabilityResult = scoreReadabilityForSeo(metrics.readability);

  const breakdown = {
    keyword: {
      ...keywordResult,
      weight: weights.keyword,
    },
    wordCount: {
      ...wordCountResult,
      weight: weights.wordCount,
    },
    headings: {
      ...headingsResult,
      weight: weights.headings,
    },
    readability: {
      ...readabilityResult,
      weight: weights.readability,
    },
  };

  const overallScore = clampScore(
    breakdown.keyword.score * weights.keyword +
      breakdown.wordCount.score * weights.wordCount +
      breakdown.headings.score * weights.headings +
      breakdown.readability.score * weights.readability
  );

  return {
    overallScore,
    breakdown,
    label: scoreToLabel(overallScore),
  };
}
