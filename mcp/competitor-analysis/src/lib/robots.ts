import { CompetitorError } from "./errors.js";
import { USER_AGENT } from "./types.js";

interface RobotsRule {
  allow: string[];
  disallow: string[];
}

const robotsCache = new Map<string, RobotsRule>();

function parseRobotsTxt(content: string): RobotsRule {
  const rules: RobotsRule = { allow: [], disallow: [] };
  let applies = false;
  let sawUserAgent = false;

  for (const line of content.split("\n")) {
    const trimmed = line.split("#")[0]?.trim() ?? "";
    if (!trimmed) continue;

    const colon = trimmed.indexOf(":");
    if (colon === -1) continue;

    const key = trimmed.slice(0, colon).trim().toLowerCase();
    const value = trimmed.slice(colon + 1).trim();

    if (key === "user-agent") {
      sawUserAgent = true;
      applies =
        value === "*" ||
        value.toLowerCase().includes("rankforgebot");
      continue;
    }

    if (!applies && sawUserAgent) continue;

    if (key === "disallow" && value) {
      rules.disallow.push(value);
    } else if (key === "allow" && value) {
      rules.allow.push(value);
    }
  }

  return rules;
}

function pathMatches(rulePath: string, requestPath: string): boolean {
  if (!rulePath) return false;
  if (rulePath === "/") return true;
  return requestPath.startsWith(rulePath);
}

function isPathAllowed(rules: RobotsRule, path: string): boolean {
  let bestAllow = "";
  let bestDisallow = "";

  for (const rule of rules.allow) {
    if (pathMatches(rule, path) && rule.length >= bestAllow.length) {
      bestAllow = rule;
    }
  }
  for (const rule of rules.disallow) {
    if (pathMatches(rule, path) && rule.length >= bestDisallow.length) {
      bestDisallow = rule;
    }
  }

  if (bestDisallow && !bestAllow) return false;
  if (bestAllow && !bestDisallow) return true;
  if (bestAllow.length > bestDisallow.length) return true;
  if (bestDisallow.length > bestAllow.length) return false;
  return true;
}

export function isScrapingAllowed(url: URL, _userAgent = USER_AGENT): boolean {
  const cacheKey = url.origin;
  const cached = robotsCache.get(cacheKey);
  if (cached) {
    return isPathAllowed(cached, url.pathname || "/");
  }
  return true;
}

export async function loadRobotsRules(origin: string): Promise<RobotsRule | null> {
  const cached = robotsCache.get(origin);
  if (cached) return cached;

  const robotsUrl = new URL("/robots.txt", origin).href;
  try {
    const response = await fetch(robotsUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const text = await response.text();
    const rules = parseRobotsTxt(text);
    robotsCache.set(origin, rules);
    return rules;
  } catch {
    return null;
  }
}

export async function checkRobotsAllowed(pageUrl: URL): Promise<boolean> {
  const rules = await loadRobotsRules(pageUrl.origin);
  if (!rules) return true;
  return isPathAllowed(rules, pageUrl.pathname || "/");
}

export function clearRobotsCache(): void {
  robotsCache.clear();
}

export { parseRobotsTxt, isPathAllowed as isPathAllowedForRobots };
