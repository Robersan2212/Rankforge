import { chromium, type Response } from "playwright";
import { AuditError } from "./errors.js";
import { validateRedirectTarget } from "./safety.js";
import { CRAWL_TIMEOUT_MS, MAX_HTML_BYTES, USER_AGENT } from "./types.js";

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

export async function fetchPageHtml(url: string): Promise<{
  html: string;
  finalUrl: string;
}> {
  const parsed = new URL(url);
  await throttleHost(parsed.hostname);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    acceptDownloads: false,
  });

  try {
    const page = await context.newPage();
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

    if (response.status() >= 400) {
      throw new AuditError(
        "FETCH_FAILED",
        `Page failed to load: HTTP ${response.status()}`,
        504
      );
    }

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

    return { html, finalUrl: resolvedUrl };
  } finally {
    await context.close();
    await browser.close();
  }
}
