export type CompetitorErrorCode =
  | "INVALID_URL"
  | "SSRF_BLOCKED"
  | "ROBOTS_DISALLOWED"
  | "TIMEOUT"
  | "FETCH_FAILED"
  | "RESPONSE_TOO_LARGE"
  | "ACCESS_BLOCKED"
  | "RATE_LIMITED"
  | "NON_HTML";

export class CompetitorError extends Error {
  readonly code: CompetitorErrorCode;
  readonly statusCode: number;

  constructor(code: CompetitorErrorCode, message: string, statusCode: number) {
    super(message);
    this.name = "CompetitorError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function competitorErrorStatus(err: unknown): number {
  if (err instanceof CompetitorError) return err.statusCode;
  return 500;
}

export function errorToReason(code: CompetitorErrorCode): string {
  switch (code) {
    case "ROBOTS_DISALLOWED":
      return "robots_disallowed";
    case "TIMEOUT":
      return "timeout";
    case "ACCESS_BLOCKED":
      return "paywall";
    case "NON_HTML":
      return "non_html";
    default:
      return "fetch_failed";
  }
}
