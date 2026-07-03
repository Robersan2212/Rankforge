import { AuditError } from "./errors.js";

export function classifyHttpStatus(status: number): AuditError | null {
  if (status === 401) {
    return new AuditError(
      "ACCESS_BLOCKED",
      "Page requires authentication (login wall). Audit stopped.",
      403
    );
  }
  if (status === 402) {
    return new AuditError(
      "ACCESS_BLOCKED",
      "Page appears to be behind a paywall. Audit stopped.",
      403
    );
  }
  if (status === 403) {
    return new AuditError(
      "ACCESS_BLOCKED",
      "Access to this page was forbidden. The site may block crawlers or show a paywall.",
      403
    );
  }
  if (status === 429) {
    return new AuditError(
      "RATE_LIMITED",
      "Target site rate-limited this request. Try again later.",
      429
    );
  }
  if (status >= 400) {
    return new AuditError(
      "FETCH_FAILED",
      `Page failed to load: HTTP ${status}`,
      504
    );
  }
  return null;
}

export function classifyBlockedHtml(html: string): AuditError | null {
  const lower = html.toLowerCase();
  if (
    /captcha|cf-challenge|g-recaptcha|hcaptcha|turnstile|challenge-platform/.test(
      lower
    )
  ) {
    return new AuditError(
      "ACCESS_BLOCKED",
      "Page appears to show a CAPTCHA challenge. Audit stopped.",
      403
    );
  }
  if (
    /paywall|subscribe to (read|continue)|members only|sign in to continue/.test(
      lower
    )
  ) {
    return new AuditError(
      "ACCESS_BLOCKED",
      "Page appears to be behind a paywall or login wall. Audit stopped.",
      403
    );
  }
  return null;
}
