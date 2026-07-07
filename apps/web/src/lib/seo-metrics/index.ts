import { calculateWordCount } from "./word-count";
import { countKeywordUsage } from "./keywords";
import { validateHeadings } from "./headings";
import { scoreReadability } from "./readability";

export { calculateWordCount, type WordCountResult } from "./word-count";
export {
  countKeywordUsage,
  type KeywordUsage,
  type KeywordUsageResult,
} from "./keywords";
export {
  validateHeadings,
  type HeadingCounts,
  type HeadingLevel,
  type HeadingValidationResult,
} from "./headings";
export { scoreReadability, type ReadabilityResult } from "./readability";

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
}

export function computeSeoMetrics(input: SeoMetricsInput): SeoMetrics {
  return {
    wordCount: calculateWordCount(input.text, input.targetWordCount),
    keywords: countKeywordUsage(
      input.text,
      input.primaryKeyword,
      input.semanticKeywords
    ),
    headings: validateHeadings(input.docJson),
    readability: scoreReadability(input.text),
  };
}
