import { calculateWordCount } from "./word-count";
import { countKeywordUsage } from "./keywords";
import { validateHeadings, extractHeadings } from "./headings";
import { scoreReadability } from "./readability";
import { calculateOverallSeoScore } from "./seo-score";

export { calculateWordCount, type WordCountResult } from "./word-count";
export {
  countKeywordUsage,
  type KeywordUsage,
  type KeywordUsageResult,
} from "./keywords";
export {
  validateHeadings,
  extractHeadings,
  type HeadingCounts,
  type HeadingEntry,
  type HeadingLevel,
  type HeadingValidationResult,
} from "./headings";
export { scoreReadability, type ReadabilityResult } from "./readability";
export {
  calculateOverallSeoScore,
  scoreKeywordUsage,
  scoreWordCount,
  scoreHeadingStructure,
  scoreReadabilityForSeo,
  type SeoScoreResult,
  type SeoScoreBreakdownItem,
} from "./seo-score";

export interface SeoMetricsInput {
  text: string;
  docJson: unknown;
  primaryKeyword: string;
  semanticKeywords?: string[];
  targetWordCount?: number;
}

export interface SeoMetrics {
  wordCount: ReturnType<typeof calculateWordCount>;
  keywords: ReturnType<typeof countKeywordUsage>;
  headings: ReturnType<typeof validateHeadings>;
  readability: ReturnType<typeof scoreReadability>;
  seoScore: ReturnType<typeof calculateOverallSeoScore>;
}

export function computeSeoMetrics(input: SeoMetricsInput): SeoMetrics {
  const wordCount = calculateWordCount(input.text, input.targetWordCount);
  const keywords = countKeywordUsage(
    input.text,
    input.primaryKeyword,
    input.semanticKeywords
  );
  const headings = validateHeadings(input.docJson);
  const readability = scoreReadability(input.text);
  const headingEntries = extractHeadings(input.docJson);

  const seoScore = calculateOverallSeoScore({
    wordCount,
    keywords,
    headings,
    headingEntries,
    readability,
    hasPrimaryKeyword: Boolean(input.primaryKeyword.trim()),
  });

  return {
    wordCount,
    keywords,
    headings,
    readability,
    seoScore,
  };
}
