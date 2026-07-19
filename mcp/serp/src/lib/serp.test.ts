import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SerpError } from "./errors.js";
import {
  expandUsStateAbbreviations,
  extractUsZip,
  getTopResults,
  locationLookupQueries,
  parseLocationIntent,
  sanitizeLocation,
} from "./serp.js";

const FIXTURE = {
  organic_results: Array.from({ length: 10 }, (_, i) => ({
    position: i + 1,
    title: `Result ${i + 1}`,
    link: `https://example${i + 1}.com/page`,
    snippet: `Snippet ${i + 1}`,
  })),
};

const AUSTIN_LOCATION = [
  {
    name: "Austin, TX",
    canonical_name: "Austin,Texas,United States",
    country_code: "US",
    target_type: "City",
    reach: 4870000,
    keys: ["austin", "texas", "united", "states"],
  },
];

const LOGAN_CITIES = [
  {
    name: "Logan",
    canonical_name: "Logan,Utah,United States",
    country_code: "US",
    target_type: "City",
    reach: 131000,
    keys: ["logan", "utah", "united", "states"],
  },
  {
    name: "Logan",
    canonical_name: "Logan,Ohio,United States",
    country_code: "US",
    target_type: "City",
    reach: 23000,
    keys: ["logan", "ohio", "united", "states"],
  },
];

const UTAH_STATE = [
  {
    name: "Utah",
    canonical_name: "Utah,United States",
    country_code: "US",
    target_type: "State",
    reach: 3000000,
    keys: ["utah", "united", "states"],
  },
  {
    name: "Salt Lake City",
    canonical_name: "Salt Lake City,Utah,United States",
    country_code: "US",
    target_type: "City",
    reach: 1000000,
    keys: ["salt", "lake", "city", "utah"],
  },
];

const ZIP_84321 = [
  {
    name: "84321",
    canonical_name: "84321,Utah,United States",
    country_code: "US",
    target_type: "Postal Code",
    reach: 50000,
    keys: ["84321", "utah", "united", "states"],
  },
];

describe("sanitizeLocation", () => {
  it("returns null for empty or whitespace", () => {
    expect(sanitizeLocation(null)).toBeNull();
    expect(sanitizeLocation(undefined)).toBeNull();
    expect(sanitizeLocation("   ")).toBeNull();
  });

  it("strips control characters and caps length", () => {
    expect(sanitizeLocation("Austin\u0000, TX")).toBe("Austin, TX");
    expect(sanitizeLocation("a".repeat(150))?.length).toBe(100);
  });
});

describe("expandUsStateAbbreviations", () => {
  it("expands City, ST forms SerpAPI Locations understands", () => {
    expect(expandUsStateAbbreviations("Logan, UT")).toBe("Logan, Utah");
    expect(expandUsStateAbbreviations("Austin, TX")).toBe("Austin, Texas");
  });
});

describe("extractUsZip", () => {
  it("extracts 5-digit and ZIP+4 codes", () => {
    expect(extractUsZip("84321")).toBe("84321");
    expect(extractUsZip("84321-4500")).toBe("84321");
    expect(extractUsZip("Logan 84321 UT")).toBe("84321");
    expect(extractUsZip("Austin, TX")).toBeNull();
  });
});

describe("parseLocationIntent", () => {
  it("detects state abbreviations and full names", () => {
    expect(parseLocationIntent("UT")).toMatchObject({
      isStateOnly: true,
      stateName: "Utah",
      stateAbbr: "UT",
    });
    expect(parseLocationIntent("Utah")).toMatchObject({
      isStateOnly: true,
      stateName: "Utah",
      stateAbbr: "UT",
    });
    expect(parseLocationIntent("California")).toMatchObject({
      isStateOnly: true,
      stateName: "California",
      stateAbbr: "CA",
    });
  });

  it("detects ZIP queries", () => {
    expect(parseLocationIntent("84321")).toMatchObject({
      isZipQuery: true,
      zip: "84321",
    });
    expect(parseLocationIntent("84321, UT")).toMatchObject({
      isZipQuery: true,
      zip: "84321",
      stateName: "Utah",
    });
  });
});

describe("locationLookupQueries", () => {
  it("tries abbreviated and expanded city forms", () => {
    expect(locationLookupQueries("Logan, UT")).toEqual([
      "Logan, UT",
      "Logan, Utah",
      "Logan Utah",
      "Logan",
    ]);
  });

  it("prioritizes full state name for bare abbreviations", () => {
    expect(locationLookupQueries("UT")[0]).toBe("Utah");
    expect(locationLookupQueries("CA")[0]).toBe("California");
  });

  it("prioritizes ZIP code lookups", () => {
    expect(locationLookupQueries("84321, UT")[0]).toBe("84321");
    expect(locationLookupQueries("84321-4500")[0]).toBe("84321");
  });
});

describe("getTopResults", () => {
  beforeEach(() => {
    process.env.SERP_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SERP_API_KEY;
  });

  it("returns 10 results from mocked API response without location", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => FIXTURE,
    });
    vi.stubGlobal("fetch", fetchMock);

    const { keyword, results, location_applied } =
      await getTopResults("seo tips");
    expect(keyword).toBe("seo tips");
    expect(results).toHaveLength(10);
    expect(location_applied).toBeNull();
    expect(results[0]).toEqual({
      rank_position: 1,
      title: "Result 1",
      url: "https://example1.com/page",
      snippet: "Snippet 1",
    });

    const searchUrl = String(fetchMock.mock.calls[0][0]);
    expect(searchUrl).toContain("q=seo+tips");
    expect(searchUrl).not.toContain("location=");
  });

  it("passes resolved location and returns location_applied", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => AUSTIN_LOCATION,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          organic_results: [
            {
              position: 1,
              title: "Local Result",
              link: "https://local.example.com",
              snippet: "Local",
            },
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getTopResults("plumber", 10, "Austin, TX");
    expect(result.location_applied).toBe("Austin, TX");
    expect(result.results).toHaveLength(1);
    expect(result.note).toMatch(/Only 1 organic result/);

    const locationsUrl = String(fetchMock.mock.calls[0][0]);
    expect(locationsUrl).toContain("locations.json");
    expect(locationsUrl).toContain("q=Austin");

    const searchUrl = String(fetchMock.mock.calls[1][0]);
    expect(searchUrl).toContain("location=Austin");
    expect(searchUrl).toContain("gl=us");
  });

  it("resolves City, ST abbreviations like Logan, UT", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => LOGAN_CITIES,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          organic_results: [
            {
              position: 1,
              title: "Utah Local",
              link: "https://logan.example.com",
              snippet: "Local",
            },
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getTopResults("janitorial services", 10, "Logan, UT");
    expect(result.location_applied).toBe("Logan, UT");
    expect(result.results[0].url).toBe("https://logan.example.com");

    const secondLookup = String(fetchMock.mock.calls[1][0]);
    expect(secondLookup).toContain("q=Logan%2C+Utah");
  });

  it("resolves bare state abbreviation and full name", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => UTAH_STATE,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          organic_results: [
            {
              position: 1,
              title: "State Result",
              link: "https://utah.example.com",
              snippet: "UT",
            },
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const viaAbbr = await getTopResults("plumber", 10, "UT");
    expect(viaAbbr.location_applied).toBe("Utah (UT)");
    expect(String(fetchMock.mock.calls[0][0])).toContain("q=Utah");
  });

  it("resolves ZIP codes including ZIP+4", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ZIP_84321,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          organic_results: [
            {
              position: 1,
              title: "ZIP Local",
              link: "https://zip.example.com",
              snippet: "Local",
            },
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getTopResults("plumber", 10, "84321-4500");
    expect(result.location_applied).toBe("84321 (UT)");
    expect(String(fetchMock.mock.calls[0][0])).toContain("q=84321");
  });

  it("throws SERP_INVALID_LOCATION for unrecognized location", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      })
    );

    await expect(
      getTopResults("plumber", 10, "NotARealPlaceXYZ123")
    ).rejects.toMatchObject({
      code: "SERP_INVALID_LOCATION",
    });
  });

  it("does not fall back to global when location is invalid", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getTopResults("plumber", 10, "NotARealPlaceXYZ123")
    ).rejects.toBeInstanceOf(SerpError);

    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(1);
    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).toContain("locations.json");
    }
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
