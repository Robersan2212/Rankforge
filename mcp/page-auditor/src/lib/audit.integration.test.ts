import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./fetcher.js", () => ({
  fetchPageHtml: vi.fn(),
}));

vi.mock("./robots.js", () => ({
  assertRobotsAllowed: vi.fn(),
}));

import { fetchPageHtml } from "./fetcher.js";
import { auditUrl } from "./audit.js";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "fixtures"
);

describe("auditUrl integration", () => {
  beforeEach(() => {
    vi.mocked(fetchPageHtml).mockReset();
  });

  it("returns a complete AuditReport from fixture HTML", async () => {
    const html = readFileSync(join(fixturesDir, "good-page.html"), "utf8");
    vi.mocked(fetchPageHtml).mockResolvedValue({
      html,
      finalUrl: "https://example.com/guides/running",
    });

    const report = await auditUrl("https://example.com/guides/running", {
      projectId: "11111111-1111-4111-8111-111111111111",
    });

    expect(report.project_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(report.meta_title).toContain("Running Shoes");
    expect(report.headings.h1).toHaveLength(1);
    expect(report.word_count).toBeGreaterThan(0);
    expect(report.links.internal_count).toBeGreaterThanOrEqual(1);
    expect(report.links.external_count).toBeGreaterThanOrEqual(1);
    expect(report.images.total).toBe(2);
    expect(report.seo_score).toBeGreaterThan(0);
    expect(report.score_breakdown.title.max).toBe(15);
    expect(report.errors).toEqual([]);
  });

  it("sanitizes HTML tags from scraped meta description", async () => {
    const html = readFileSync(join(fixturesDir, "good-page.html"), "utf8").replace(
      'content="Discover the best running shoes',
      'content="Discover<script>alert(1)</script> the best running shoes'
    );
    vi.mocked(fetchPageHtml).mockResolvedValue({
      html,
      finalUrl: "https://example.com/x",
    });

    const report = await auditUrl("https://example.com/x");
    expect(report.meta_description).toContain("Discover the best running shoes");
    expect(report.meta_description).not.toContain("<");
    expect(report.meta_description).not.toContain("script");
  });
});
