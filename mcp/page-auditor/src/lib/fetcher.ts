import { chromium, type Response } from "playwright";
import { AuditError } from "./errors.js";
import {
  classifyBlockedHtml,
  classifyHttpStatus,
} from "./fetch-errors.js";
import { validateRedirectTarget } from "./safety.js";
import {
  CONNECT_TIMEOUT_MS,
  CRAWL_TIMEOUT_MS,
  MAX_HTML_BYTES,
  MAX_REDIRECTS,
  USER_AGENT,
} from "./types.js";

const hostLastRequest = new Map<string, number>();
const HOST_THROTTLE_MS = 1000;

async function throttleHost(hostname: string): Promise<void> {
  const now = Date.now();
  const last = hostLastRequest.get(hostname) ?? 0;
  const wait = HOST_THROTTLE_MS - (now - last);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  hostLastRequest.set(hostname, Date.now());
}

async function fetchWithTimeouts(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  let headersReceived = false;

  const connectTimer = setTimeout(() => {
    if (!headersReceived) controller.abort();
  }, CONNECT_TIMEOUT_MS);

  const totalTimer = setTimeout(() => controller.abort(), CRAWL_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        ...(init.headers ?? {}),
      },
    });
    headersReceived = true;
    clearTimeout(connectTimer);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/abort/i.test(message)) {
      if (!headersReceived) {
        throw new AuditError(
          "TIMEOUT",
          `Connection timed out after ${CONNECT_TIMEOUT_MS / 1000}s`,
          504
        );
      }
      throw new AuditError(
        "TIMEOUT",
        `Page load timed out after ${CRAWL_TIMEOUT_MS / 1000}s`,
        504
      );
    }
    throw new AuditError("FETCH_FAILED", `Page failed to load: ${message}`, 504);
  } finally {
    clearTimeout(connectTimer);
    clearTimeout(totalTimer);
  }
}

async function readHtmlBody(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    const byteLength = Buffer.byteLength(text, "utf8");
    if (byteLength > MAX_HTML_BYTES) {
      throw new AuditError(
        "RESPONSE_TOO_LARGE",
        `Page HTML exceeds maximum size of ${MAX_HTML_BYTES / (1024 * 1024)}MB`,
        504
      );
    }
    return text;
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_HTML_BYTES) {
      throw new AuditError(
        "RESPONSE_TOO_LARGE",
        `Page HTML exceeds maximum size of ${MAX_HTML_BYTES / (1024 * 1024)}MB`,
        504
      );
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function isUsableStaticHtml(html: string): boolean {
  const byteLength = Buffer.byteLength(html, "utf8");
  if (byteLength === 0 || byteLength > MAX_HTML_BYTES) return false;

  const lower = html.toLowerCase();
  if (!lower.includes("<html") && !lower.includes("<!doctype")) return false;

  const visibleText = html.replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return visibleText.length >= 50 || lower.includes("<title");
}

async function fetchHtmlViaHttp(url: string): Promise<{
  html: string;
  finalUrl: string;
} | null> {
  let currentUrl = url;

  for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
    await validateRedirectTarget(currentUrl);

    const response = await fetchWithTimeouts(currentUrl, {
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new AuditError(
          "FETCH_FAILED",
          `Redirect response missing Location header (HTTP ${response.status})`,
          504
        );
      }
      currentUrl = new URL(location, currentUrl).href;
      continue;
    }

    const statusError = classifyHttpStatus(response.status);
    if (statusError) throw statusError;

    const html = await readHtmlBody(response);
    const blocked = classifyBlockedHtml(html);
    if (blocked) throw blocked;

    if (!isUsableStaticHtml(html)) {
      return null;
    }

    return { html, finalUrl: currentUrl };
  }

  throw new AuditError(
    "FETCH_FAILED",
    `Too many redirects (max ${MAX_REDIRECTS})`,
    504
  );
}

async function validateResponseChain(response: Response): Promise<string> {
  const seen = new Set<string>();
  let request = response.request();

  while (request) {
    const currentResponse = await request.response();
    const url = (currentResponse ?? response).url();
    if (seen.has(url)) break;
    seen.add(url);
    await validateRedirectTarget(url);
    request = request.redirectedFrom();
  }

  return response.url();
}

async function fetchHtmlViaPlaywright(url: string): Promise<{
  html: string;
  finalUrl: string;
}> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    acceptDownloads: false,
  });

  try {
    const page = await context.newPage();
    page.on("popup", (popup) => {
      void popup.close();
    });

    let response: Response | null = null;

    try {
      response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: CRAWL_TIMEOUT_MS,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/timeout/i.test(message)) {
        throw new AuditError(
          "TIMEOUT",
          `Page load timed out after ${CRAWL_TIMEOUT_MS / 1000}s`,
          504
        );
      }
      throw new AuditError("FETCH_FAILED", `Page failed to load: ${message}`, 504);
    }

    if (!response) {
      throw new AuditError(
        "FETCH_FAILED",
        "Page failed to load: no response received",
        504
      );
    }

    const statusError = classifyHttpStatus(response.status());
    if (statusError) throw statusError;

    const finalUrl = await validateResponseChain(response);
    const resolvedUrl = finalUrl || response.url();
    await validateRedirectTarget(resolvedUrl);

    const html = await page.content();
    const byteLength = Buffer.byteLength(html, "utf8");
    if (byteLength > MAX_HTML_BYTES) {
      throw new AuditError(
        "RESPONSE_TOO_LARGE",
        `Page HTML exceeds maximum size of ${MAX_HTML_BYTES / (1024 * 1024)}MB`,
        504
      );
    }

    const blocked = classifyBlockedHtml(html);
    if (blocked) throw blocked;

    return { html, finalUrl: resolvedUrl };
  } finally {
    await context.close();
    await browser.close();
  }
}

export async function fetchPageHtml(url: string): Promise<{
  html: string;
  finalUrl: string;
}> {
  const parsed = new URL(url);
  await throttleHost(parsed.hostname);

  const staticResult = await fetchHtmlViaHttp(url);
  if (staticResult) {
    return staticResult;
  }

  return fetchHtmlViaPlaywright(url);
}
