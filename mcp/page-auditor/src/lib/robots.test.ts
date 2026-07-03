import { describe, expect, it } from "vitest";
import { isPathAllowedForRobots, parseRobotsTxt } from "./robots.js";

describe("parseRobotsTxt", () => {
  it("disallows paths blocked for all crawlers", () => {
    const rules = parseRobotsTxt(`
User-agent: *
Disallow: /private/
Allow: /
    `);

    expect(isPathAllowedForRobots(rules, "/")).toBe(true);
    expect(isPathAllowedForRobots(rules, "/public/page")).toBe(true);
    expect(isPathAllowedForRobots(rules, "/private/secret")).toBe(false);
  });

  it("prefers the longest matching allow rule", () => {
    const rules = parseRobotsTxt(`
User-agent: *
Disallow: /blog/
Allow: /blog/public/
    `);

    expect(isPathAllowedForRobots(rules, "/blog/public/post")).toBe(true);
    expect(isPathAllowedForRobots(rules, "/blog/draft/post")).toBe(false);
  });

  it("applies RankforgeAuditBot-specific rules when present", () => {
    const rules = parseRobotsTxt(`
User-agent: *
Disallow: /

User-agent: RankforgeAuditBot
Allow: /
    `);

    expect(isPathAllowedForRobots(rules, "/welcome")).toBe(true);
  });
});

describe("assertRobotsAllowed", () => {
  it("throws ROBOTS_DISALLOWED when path is blocked", async () => {
    const { assertRobotsAllowed } = await import("./robots.js");
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () =>
      new Response(
        "User-agent: *\nDisallow: /blocked\n",
        { status: 200 }
      );

    await expect(
      assertRobotsAllowed(new URL("https://example.com/blocked/page"))
    ).rejects.toMatchObject({
      code: "ROBOTS_DISALLOWED",
    });

    globalThis.fetch = originalFetch;
  });
});
