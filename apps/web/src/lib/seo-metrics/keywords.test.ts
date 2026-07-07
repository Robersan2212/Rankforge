import { describe, expect, it } from "vitest";
import { countKeywordUsage } from "./keywords";

describe("countKeywordUsage", () => {
  it("returns zero counts when no keywords provided", () => {
    const result = countKeywordUsage("some text here", "", []);
    expect(result.primary).toBeNull();
    expect(result.semantic).toEqual([]);
    expect(result.totalOccurrences).toBe(0);
  });

  it("counts primary keyword case-insensitively", () => {
    const text =
      "Best Running Shoes are great. Everyone loves best running shoes.";
    const result = countKeywordUsage(text, "best running shoes", []);
    expect(result.primary?.count).toBe(2);
    expect(result.totalOccurrences).toBe(2);
  });

  it("counts semantic keywords and deduplicates", () => {
    const result = countKeywordUsage(
      "trail running and marathon training for runners",
      "trail running",
      ["marathon training", "marathon training", "trail running"]
    );
    expect(result.primary?.count).toBe(1);
    expect(result.semantic).toHaveLength(1);
    expect(result.semantic[0].keyword).toBe("marathon training");
    expect(result.semantic[0].count).toBe(1);
  });
});
