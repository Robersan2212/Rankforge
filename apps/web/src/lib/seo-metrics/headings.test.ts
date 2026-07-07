import { describe, expect, it } from "vitest";
import { validateHeadings } from "./headings";

const doc = (content: unknown[]) => ({ type: "doc", content });

describe("validateHeadings", () => {
  it("warns when no headings exist", () => {
    const result = validateHeadings(doc([{ type: "paragraph", content: [] }]));
    expect(result.counts.total).toBe(0);
    expect(result.isValid).toBe(false);
    expect(result.warnings[0]).toContain("No headings");
  });

  it("counts TipTap heading nodes by attrs.level", () => {
    const result = validateHeadings(
      doc([
        { type: "heading", attrs: { level: 1 }, content: [] },
        { type: "heading", attrs: { level: 2 }, content: [] },
        { type: "heading", attrs: { level: 2 }, content: [] },
      ])
    );
    expect(result.counts.h1).toBe(1);
    expect(result.counts.h2).toBe(2);
    expect(result.counts.total).toBe(3);
  });

  it("counts h1-h6 node types from TipTap JSON", () => {
    const result = validateHeadings(
      doc([
        { type: "heading", attrs: { level: 1 } },
        { type: "h2" },
        { type: "h3" },
      ])
    );
    expect(result.counts.h1).toBe(1);
    expect(result.counts.h2).toBe(1);
    expect(result.counts.h3).toBe(1);
    expect(result.counts.total).toBe(3);
  });

  it("warns on multiple H1 headings", () => {
    const result = validateHeadings(
      doc([{ type: "h1" }, { type: "h1" }, { type: "h2" }])
    );
    expect(result.warnings.some((w) => w.includes("Multiple H1"))).toBe(true);
    expect(result.isValid).toBe(false);
  });

  it("warns on skipped heading levels", () => {
    const result = validateHeadings(doc([{ type: "h1" }, { type: "h3" }]));
    expect(result.warnings.some((w) => w.includes("Skipped"))).toBe(true);
  });

  it("handles invalid input gracefully", () => {
    const result = validateHeadings(null);
    expect(result.isValid).toBe(false);
    expect(result.warnings[0]).toContain("Invalid document");
  });
});
