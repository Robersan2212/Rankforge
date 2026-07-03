import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { CompetitorError } from "./errors.js";
import { MAX_URL_LENGTH } from "./types.js";

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal"]);

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false;
  const [a, b] = parts;
  if (a === 127) return true;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 0) return true;
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("fe80:")) return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    if (isIP(mapped) === 4) return isPrivateIpv4(mapped);
  }
  return false;
}

function isBlockedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) return isPrivateIpv6(ip);
  return true;
}

export async function assertSafeHostname(hostname: string): Promise<void> {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(host)) {
    throw new CompetitorError(
      "SSRF_BLOCKED",
      `Requests to ${host} are not allowed`,
      403
    );
  }

  if (isIP(host)) {
    if (isBlockedIp(host)) {
      throw new CompetitorError(
        "SSRF_BLOCKED",
        "Requests to private or internal IP addresses are not allowed",
        403
      );
    }
    return;
  }

  let addresses: { address: string; family: number }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new CompetitorError(
      "FETCH_FAILED",
      `Could not resolve hostname: ${host}`,
      400
    );
  }

  for (const { address } of addresses) {
    if (isBlockedIp(address)) {
      throw new CompetitorError(
        "SSRF_BLOCKED",
        "Hostname resolves to a private or internal IP address",
        403
      );
    }
  }
}

export function validateUrlInput(raw: string): URL {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new CompetitorError("INVALID_URL", "URL is required", 400);
  }
  if (trimmed.length > MAX_URL_LENGTH) {
    throw new CompetitorError(
      "INVALID_URL",
      `URL exceeds maximum length of ${MAX_URL_LENGTH} characters`,
      400
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new CompetitorError("INVALID_URL", "URL is not well-formed", 400);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new CompetitorError(
      "INVALID_URL",
      "URL must use http or https scheme",
      400
    );
  }

  if (!parsed.hostname) {
    throw new CompetitorError("INVALID_URL", "URL must include a hostname", 400);
  }

  return parsed;
}

export async function validatePageUrl(raw: string): Promise<URL> {
  const parsed = validateUrlInput(raw);
  await assertSafeHostname(parsed.hostname);
  return parsed;
}

export async function validateRedirectTarget(url: string): Promise<void> {
  const parsed = validateUrlInput(url);
  await assertSafeHostname(parsed.hostname);
}
