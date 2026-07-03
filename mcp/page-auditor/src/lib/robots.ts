import { AuditError } from "./errors.js";
import { USER_AGENT } from "./types.js";

interface RobotsRule {
  allow: string[];
  disallow: string[];
}

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
      applies = value === "*" || value.toLowerCase().includes("rankforgeauditbot");
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

export function isPathAllowedForRobots(rules: RobotsRule, path: string): boolean {
  return isPathAllowed(rules, path);
}

export { parseRobotsTxt };

export async function assertRobotsAllowed(pageUrl: URL): Promise<void> {
  const robotsUrl = new URL("/robots.txt", pageUrl.origin).href;

  let response: Response;
  try {
    response = await fetch(robotsUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return;
  }

  if (!response.ok) return;

  const text = await response.text();
  const rules = parseRobotsTxt(text);
  const path = pageUrl.pathname || "/";

  if (!isPathAllowed(rules, path)) {
    throw new AuditError(
      "ROBOTS_DISALLOWED",
      `Crawling ${path} is disallowed by robots.txt for this site`,
      403
    );
  }
}
