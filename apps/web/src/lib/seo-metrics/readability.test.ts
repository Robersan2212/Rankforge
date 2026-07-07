import { describe, expect, it } from "vitest";
import { scoreReadability } from "./readability";

describe("scoreReadability", () => {
  it("returns no content label for empty text", () => {
    expect(scoreReadability("")).toEqual({ score: 0, label: "No content" });
  });

  it("returns too short for brief text", () => {
    expect(scoreReadability("short text")).toEqual({
      score: 0,
      label: "Too short",
    });
  });

  it("scores readable prose", () => {
    const passage =
      "The cat sat on the mat. It was a sunny day. Birds sang in the trees. " +
      "Children played in the park nearby. Everyone enjoyed the warm weather.";
    const result = scoreReadability(passage);
    expect(result.score).toBeGreaterThan(0);
    expect(result.label).not.toBe("No content");
  });

  it("handles emoji-heavy text without crashing", () => {
    const text =
      "Hello world this is a test passage with enough words to score. " +
      "🎉🎉🎉 More words here for readability scoring purposes today.";
    const result = scoreReadability(text);
    expect(typeof result.score).toBe("number");
    expect(typeof result.label).toBe("string");
  });
});
