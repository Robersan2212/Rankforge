/** Tunable weights and thresholds for the composite live SEO score (0–100). */

export interface WeightConfig {
  keyword: number;
  wordCount: number;
  headings: number;
  readability: number;
}

export const DEFAULT_WEIGHTS: WeightConfig = {
  keyword: 0.25,
  wordCount: 0.2,
  headings: 0.25,
  readability: 0.3,
};

/** Ideal words between primary-keyword uses (~1 use per 175 words). */
export const IDEAL_WORDS_PER_USE = 175;

/** Sparse end of band (~1 use per 200 words). */
export const KEYWORD_MIN_DENSITY = IDEAL_WORDS_PER_USE / 200;

/** Dense end of band (~1 use per 150 words). */
export const KEYWORD_MAX_DENSITY = IDEAL_WORDS_PER_USE / 150;

export const KEYWORD_STUFFING_PENALTY_FACTOR = 80;

export const WORD_COUNT_UNDER_TOLERANCE = 0.9;
export const WORD_COUNT_OVER_TOLERANCE = 1.3;
export const WORD_COUNT_OVER_PENALTY_FACTOR = 50;
export const WORD_COUNT_OVER_SCORE_FLOOR = 60;

export const HEADING_NO_H1_H2_PENALTY = 40;
export const HEADING_SKIPPED_LEVEL_PENALTY = 15;
export const HEADING_SKIPPED_LEVEL_PENALTY_CAP = 45;
export const HEADING_EMPTY_OR_DUPLICATE_PENALTY = 10;
export const HEADING_SINGLE_IN_LONG_DOC_PENALTY = 15;
export const HEADING_LONG_DOC_WORD_THRESHOLD = 600;

export const READABILITY_FLESCH_TARGET_LOW = 50;
export const READABILITY_FLESCH_TARGET_HIGH = 70;
export const READABILITY_FLESCH_PEAK = 60;

export const SCORE_LABEL_NEEDS_WORK_MAX = 49;
export const SCORE_LABEL_GOOD_MAX = 74;

export const SCORE_LABELS = {
  needsWork: "Needs work",
  good: "Good",
  excellent: "Excellent",
} as const;

export const NO_TARGET_WORD_COUNT_FALLBACK_SCORE = 50;
