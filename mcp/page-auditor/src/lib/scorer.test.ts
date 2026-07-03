import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseHtml } from "./parser.js";
import {
  buildScoreBreakdown,
  scoreImages,
  totalScore,
} from "./scorer.js";
import { validateUrlInput } from "./safety.js";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "fixtures"
);

function loadFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf8");
}

describe("validateUrlInput", () => {
  it("rejects non-http schemes", () => {
    expect(() => validateUrlInput("file:///etc/passwd")).toThrow(/http or https/);
  });

  it("rejects malformed URLs", () => {
    expect(() => validateUrlInput("not-a-url")).toThrow(/not well-formed/);
  });

  it("accepts valid https URLs", () => {
    const parsed = validateUrlInput("https://example.com/page");
    expect(parsed.hostname).toBe("example.com");
  });
});

describe("parseHtml", () => {
  it("extracts meta, headings, links, and images from good page", () => {
    const html = loadFixture("good-page.html");
    const data = parseHtml(html, "https://example.com/guides/running");

    expect(data.meta_title).toContain("Running Shoes");
    expect(data.meta_description_length).toBeGreaterThan(100);
    expect(data.headings.h1).toHaveLength(1);
    expect(data.headings.h2.length).toBeGreaterThanOrEqual(1);
    expect(data.links.internal_count).toBeGreaterThanOrEqual(1);
    expect(data.links.external_count).toBeGreaterThanOrEqual(1);
    expect(data.images.total).toBe(2);
    expect(data.images.missing_alt_count).toBe(0);
  });

  it("detects missing meta and skipped heading levels", () => {
    const html = loadFixture("no-meta.html");
    const data = parseHtml(html, "https://example.com/bad");

    expect(data.meta_title).toBeNull();
    expect(data.headings.h1).toHaveLength(1);
    expect(data.headings.h2).toHaveLength(0);
    expect(data.headings.h3).toHaveLength(1);
    expect(data.images.missing_alt_count).toBe(1);
  });
});

describe("scorer", () => {
  it("gives full image points when there are zero images", () => {
    const html = loadFixture("zero-images.html");
    const data = parseHtml(html, "https://example.com/zero");
    const images = scoreImages(data.images);
    expect(images.score).toBe(15);
    expect(images.max).toBe(15);
  });

  it("produces lower score when H1 is removed", () => {
    const good = parseHtml(
      loadFixture("good-page.html"),
      "https://example.com/good"
    );
    const noH1Html = loadFixture("good-page.html").replace(
      "<h1>Best Running Shoes for Marathon Training</h1>",
      ""
    );
    const withoutH1 = parseHtml(noH1Html, "https://example.com/good");

    const goodScore = totalScore(buildScoreBreakdown(good));
    const reducedScore = totalScore(buildScoreBreakdown(withoutH1));
    expect(reducedScore).toBeLessThan(goodScore);
  });
});

describe("assertSafeHostname", () => {
  it("rejects literal private IPv4 addresses", async () => {
    const { assertSafeHostname } = await import("./safety.js");
    await expect(assertSafeHostname("127.0.0.1")).rejects.toThrow(/private/i);
    await expect(assertSafeHostname("192.168.1.1")).rejects.toThrow(/private/i);
  });
});
