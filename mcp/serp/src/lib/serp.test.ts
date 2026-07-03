import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SerpError } from "./errors.js";
import { getTopResults } from "./serp.js";

const FIXTURE = {
  organic_results: Array.from({ length: 10 }, (_, i) => ({
    position: i + 1,
    title: `Result ${i + 1}`,
    link: `https://example${i + 1}.com/page`,
    snippet: `Snippet ${i + 1}`,
  })),
};

describe("getTopResults", () => {
  beforeEach(() => {
    process.env.SERP_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SERP_API_KEY;
  });

  it("returns 10 results from mocked API response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => FIXTURE,
      })
    );

    const { keyword, results } = await getTopResults("seo tips");
    expect(keyword).toBe("seo tips");
    expect(results).toHaveLength(10);
    expect(results[0]).toEqual({
      rank_position: 1,
      title: "Result 1",
      url: "https://example1.com/page",
      snippet: "Snippet 1",
    });
  });

  it("throws SERP_INVALID_KEY when API key missing", async () => {
    delete process.env.SERP_API_KEY;
    await expect(getTopResults("test")).rejects.toMatchObject({
      code: "SERP_INVALID_KEY",
    });
  });

  it("throws SERP_NO_RESULTS for empty organic results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ organic_results: [] }),
      })
    );

    await expect(getTopResults("obscure query")).rejects.toMatchObject({
      code: "SERP_NO_RESULTS",
    });
  });

  it("throws SERP_RATE_LIMITED on HTTP 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: "Rate limit exceeded" }),
      })
    );

    await expect(getTopResults("test")).rejects.toBeInstanceOf(SerpError);
    await expect(getTopResults("test")).rejects.toMatchObject({
      code: "SERP_RATE_LIMITED",
    });
  });
});
