export type AuditErrorCode =
  | "INVALID_URL"
  | "SSRF_BLOCKED"
  | "ROBOTS_DISALLOWED"
  | "TIMEOUT"
  | "FETCH_FAILED"
  | "RESPONSE_TOO_LARGE";

export class AuditError extends Error {
  readonly code: AuditErrorCode;
  readonly statusCode: number;

  constructor(code: AuditErrorCode, message: string, statusCode: number) {
    super(message);
    this.name = "AuditError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function auditErrorStatus(err: unknown): number {
  if (err instanceof AuditError) return err.statusCode;
  return 500;
}
