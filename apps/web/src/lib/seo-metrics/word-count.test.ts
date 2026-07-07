import { describe, expect, it } from "vitest";
import { calculateWordCount } from "./word-count";

describe("calculateWordCount", () => {
  it("returns 0 for empty text", () => {
    expect(calculateWordCount("")).toEqual({ current: 0 });
    expect(calculateWordCount("   ")).toEqual({ current: 0 });
  });

  it("counts words in a passage", () => {
    const words = Array.from({ length: 300 }, (_, i) => `word${i}`).join(" ");
    const result = calculateWordCount(words, 300);
    expect(result.current).toBe(300);
    expect(result.target).toBe(300);
    expect(result.percentOfTarget).toBe(100);
  });

  it("handles emoji and non-Latin text", () => {
    const result = calculateWordCount("Hello 世界 🎉 test");
    expect(result.current).toBe(4);
  });

  it("handles very long input without crashing", () => {
    const long = "word ".repeat(50_000);
    const result = calculateWordCount(long, 1000);
    expect(result.current).toBe(50_000);
    expect(result.percentOfTarget).toBe(5000);
  });
});
