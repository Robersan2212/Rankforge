import { CompetitorError } from "./errors.js";

export function classifyHttpStatus(status: number): CompetitorError | null {
  if (status === 401) {
    return new CompetitorError(
      "ACCESS_BLOCKED",
      "Page requires authentication (login wall).",
      403
    );
  }
  if (status === 402) {
    return new CompetitorError(
      "ACCESS_BLOCKED",
      "Page appears to be behind a paywall.",
      403
    );
  }
  if (status === 403) {
    return new CompetitorError(
      "ACCESS_BLOCKED",
      "Access to this page was forbidden.",
      403
    );
  }
  if (status === 429) {
    return new CompetitorError(
      "RATE_LIMITED",
      "Target site rate-limited this request.",
      429
    );
  }
  if (status >= 400) {
    return new CompetitorError(
      "FETCH_FAILED",
      `Page failed to load: HTTP ${status}`,
      504
    );
  }
  return null;
}

export function classifyBlockedHtml(html: string): CompetitorError | null {
  const lower = html.toLowerCase();
  if (
    /captcha|cf-challenge|g-recaptcha|hcaptcha|turnstile|challenge-platform/.test(
      lower
    )
  ) {
    return new CompetitorError(
      "ACCESS_BLOCKED",
      "Page appears to show a CAPTCHA challenge.",
      403
    );
  }
  if (
    /paywall|subscribe to (read|continue)|members only|sign in to continue/.test(
      lower
    )
  ) {
    return new CompetitorError(
      "ACCESS_BLOCKED",
      "Page appears to be behind a paywall or login wall.",
      403
    );
  }
  return null;
}
