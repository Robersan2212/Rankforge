import { describe, expect, it } from "vitest";
import {
  calculateOverallSeoScore,
  scoreHeadingStructure,
  scoreKeywordUsage,
  scoreReadabilityForSeo,
  scoreWordCount,
} from "./seo-score";
import { computeSeoMetrics } from "./index";
import type { HeadingCounts, HeadingEntry } from "./headings";
import type { KeywordUsageResult } from "./keywords";
import type { ReadabilityResult } from "./readability";
import type { WordCountResult } from "./word-count";

function emptyCounts(): HeadingCounts {
  return { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0, total: 0 };
}

function keywords(primary: { keyword: string; count: number } | null): KeywordUsageResult {
  return {
    primary: primary
      ? { keyword: primary.keyword, count: primary.count, isPrimary: true }
      : null,
    semantic: [],
    totalOccurrences: primary?.count ?? 0,
  };
}

function docWithHeadings(
  headings: Array<{ level: number; text: string }>
): unknown {
  return {
    type: "doc",
    content: headings.map((heading) => ({
      type: "heading",
      attrs: { level: heading.level },
      content: [{ type: "text", text: heading.text }],
    })),
  };
}

describe("scoreKeywordUsage", () => {
  it("returns 0 when primary keyword is missing", () => {
    const result = scoreKeywordUsage(keywords(null), 300, false);
    expect(result.score).toBe(0);
    expect(result.detail).toContain("primary keyword");
  });

  it("returns 0 when keyword is never used", () => {
    const result = scoreKeywordUsage(
      keywords({ keyword: "seo", count: 0 }),
      300,
      true
    );
    expect(result.score).toBe(0);
  });

  it("returns 100 when usage is within the recommended band", () => {
    const result = scoreKeywordUsage(
      keywords({ keyword: "seo", count: 2 }),
      300,
      true
    );
    expect(result.score).toBe(100);
    expect(result.detail).toContain("within target range");
  });

  it("penalizes keyword stuffing", () => {
    const inBand = scoreKeywordUsage(
      keywords({ keyword: "seo", count: 2 }),
      300,
      true
    );
    const stuffed = scoreKeywordUsage(
      keywords({ keyword: "seo", count: 20 }),
      300,
      true
    );
    expect(stuffed.score).toBeLessThan(inBand.score);
  });
});

describe("scoreWordCount", () => {
  it("returns 0 for empty content", () => {
    expect(scoreWordCount({ current: 0 }).score).toBe(0);
  });

  it("returns 100 at target within tolerance band", () => {
    const result = scoreWordCount({ current: 300, target: 300, percentOfTarget: 100 });
    expect(result.score).toBe(100);
  });

  it("scales up below 90% of target", () => {
    const result = scoreWordCount({ current: 180, target: 300, percentOfTarget: 60 });
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(100);
  });

  it("decays above 130% but floors at 60", () => {
    const result = scoreWordCount({ current: 900, target: 300, percentOfTarget: 300 });
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.score).toBeLessThan(100);
  });

  it("uses neutral fallback when no target is set", () => {
    const result = scoreWordCount({ current: 250 });
    expect(result.score).toBe(50);
    expect(result.detail).toContain("No target word count");
  });
});

describe("scoreHeadingStructure", () => {
  it("deducts heavily when no H1 or H2 exist", () => {
    const counts: HeadingCounts = {
      ...emptyCounts(),
      h3: 2,
      total: 2,
    };
    const entries: HeadingEntry[] = [
      { level: 3, text: "Section" },
      { level: 3, text: "Another" },
    ];
    const result = scoreHeadingStructure(counts, entries, 400);
    expect(result.score).toBeLessThanOrEqual(60);
  });

  it("deducts for skipped heading levels", () => {
    const counts: HeadingCounts = {
      ...emptyCounts(),
      h1: 1,
      h3: 1,
      total: 2,
    };
    const entries: HeadingEntry[] = [
      { level: 1, text: "Title" },
      { level: 3, text: "Skipped H2" },
    ];
    const result = scoreHeadingStructure(counts, entries, 400);
    expect(result.score).toBeLessThan(100);
    expect(result.detail).toContain("skipped");
  });

  it("deducts for empty and duplicate headings", () => {
    const counts: HeadingCounts = {
      ...emptyCounts(),
      h1: 2,
      total: 2,
    };
    const entries: HeadingEntry[] = [
      { level: 1, text: "   " },
      { level: 1, text: "Duplicate" },
      { level: 1, text: "duplicate" },
    ];
    const result = scoreHeadingStructure(counts, entries, 200);
    expect(result.score).toBeLessThan(100);
    expect(result.detail).toContain("empty");
    expect(result.detail).toContain("duplicate");
  });

  it("deducts for a single heading in a long document", () => {
    const counts: HeadingCounts = {
      ...emptyCounts(),
      h1: 1,
      total: 1,
    };
    const entries: HeadingEntry[] = [{ level: 1, text: "Only heading" }];
    const result = scoreHeadingStructure(counts, entries, 650);
    expect(result.score).toBeLessThan(100);
    expect(result.detail).toContain("only one heading");
  });
});

describe("scoreReadabilityForSeo", () => {
  it("returns 100 in the Flesch 50–70 target band", () => {
    const result = scoreReadabilityForSeo({ score: 60, label: "Standard" });
    expect(result.score).toBe(100);
  });

  it("lowers score for very difficult text", () => {
    const result = scoreReadabilityForSeo({ score: 20, label: "Very difficult" });
    expect(result.score).toBeLessThan(100);
  });

  it("lowers score for very easy text", () => {
    const result = scoreReadabilityForSeo({ score: 95, label: "Very easy" });
    expect(result.score).toBeLessThan(100);
  });
});

describe("calculateOverallSeoScore", () => {
  it("returns overall 0 for empty documents without throwing", () => {
    const result = calculateOverallSeoScore({
      wordCount: { current: 0 },
      keywords: keywords(null),
      headings: { counts: emptyCounts() },
      headingEntries: [],
      readability: { score: 0, label: "No content" },
      hasPrimaryKeyword: false,
    });
    expect(result.overallScore).toBe(0);
    expect(result.label).toBe("Needs work");
  });
});

describe("computeSeoMetrics integration", () => {
  function buildReadablePassage(
    wordTarget: number,
    keyword: string,
    keywordUses: number
  ): string {
    const intro =
      "Businesses rely on professional cleaning teams to keep offices safe and welcoming. " +
      "Regular maintenance reduces wear, improves air quality, and supports employee productivity. " +
      "Managers often evaluate providers based on reliability, transparency, and service quality. " +
      "A strong program includes daily tasks, periodic deep cleaning, and clear communication. " +
      "Facilities leaders track outcomes with checklists, inspections, and feedback from staff. ";

    const middle =
      "When selecting a vendor, compare scope, scheduling flexibility, and reporting standards. " +
      "Training, insurance coverage, and supply management also influence long-term value. " +
      "Many organizations start with a pilot area before expanding across the full building. " +
      "Documented procedures help teams stay consistent during busy seasons and staff turnover. " +
      "Sustainable products and efficient workflows can reduce costs without lowering standards. ";

    const closing =
      "Ultimately, the right partner aligns with your goals, budget, and compliance requirements. " +
      "Review proposals carefully, ask for references, and define success metrics up front. " +
      "With the right plan in place, your workplace stays cleaner, healthier, and more professional. ";

    let text = intro + middle + closing;
    const words = text.split(/\s+/).filter(Boolean);
    while (words.length < wordTarget) {
      text += middle;
      words.push(...middle.split(/\s+/).filter(Boolean));
    }

    const trimmed = words.slice(0, wordTarget).join(" ");
    const parts = trimmed.split(/\s+/);
    const spacing = Math.max(1, Math.floor(wordTarget / (keywordUses + 1)));

    for (let i = 1; i <= keywordUses; i++) {
      const index = Math.min(parts.length - 1, i * spacing);
      parts.splice(index, 0, ...keyword.split(/\s+/));
    }

    return parts.join(" ");
  }

  it("scores a well-optimized ~300-word passage in the excellent band", () => {
    const keyword = "janitorial services";
    const text = buildReadablePassage(300, keyword, 2);
    const metrics = computeSeoMetrics({
      text,
      docJson: docWithHeadings([
        { level: 1, text: "Janitorial Services Guide" },
        { level: 2, text: "Why It Matters" },
        { level: 2, text: "What To Expect" },
      ]),
      primaryKeyword: keyword,
      targetWordCount: 300,
    });

    expect(metrics.seoScore.overallScore).toBeGreaterThanOrEqual(75);
    expect(metrics.seoScore.overallScore).toBeLessThanOrEqual(100);
    expect(metrics.seoScore.label).toBe("Excellent");
  });

  it("lowers overall score for keyword stuffing", () => {
    const keyword = "janitorial services";
    const stuffed = buildReadablePassage(300, keyword, 25);
    const balanced = buildReadablePassage(300, keyword, 2);

    const stuffedMetrics = computeSeoMetrics({
      text: stuffed,
      docJson: docWithHeadings([{ level: 1, text: "Title" }]),
      primaryKeyword: keyword,
      targetWordCount: 300,
    });
    const balancedMetrics = computeSeoMetrics({
      text: balanced,
      docJson: docWithHeadings([
        { level: 1, text: "Title" },
        { level: 2, text: "Section" },
      ]),
      primaryKeyword: keyword,
      targetWordCount: 300,
    });

    expect(stuffedMetrics.seoScore.breakdown.keyword.score).toBeLessThan(
      balancedMetrics.seoScore.breakdown.keyword.score
    );
    expect(stuffedMetrics.seoScore.overallScore).toBeLessThan(
      balancedMetrics.seoScore.overallScore
    );
  });

  it("lowers heading and overall scores when headings are removed from a long doc", () => {
    const keyword = "janitorial services";
    const text = buildReadablePassage(650, keyword, 4);
    const withHeadings = computeSeoMetrics({
      text,
      docJson: docWithHeadings([
        { level: 1, text: "Guide" },
        { level: 2, text: "Benefits" },
        { level: 2, text: "Process" },
      ]),
      primaryKeyword: keyword,
      targetWordCount: 600,
    });
    const withoutHeadings = computeSeoMetrics({
      text,
      docJson: { type: "doc", content: [] },
      primaryKeyword: keyword,
      targetWordCount: 600,
    });

    expect(withoutHeadings.seoScore.breakdown.headings.score).toBeLessThan(
      withHeadings.seoScore.breakdown.headings.score
    );
    expect(withoutHeadings.seoScore.overallScore).toBeLessThan(
      withHeadings.seoScore.overallScore
    );
  });
});
