export type SerpErrorCode =
  | "SERP_API_ERROR"
  | "SERP_RATE_LIMITED"
  | "SERP_NO_RESULTS"
  | "SERP_INVALID_KEY"
  | "INVALID_KEYWORD";

export class SerpError extends Error {
  readonly code: SerpErrorCode;
  readonly statusCode: number;

  constructor(code: SerpErrorCode, message: string, statusCode: number) {
    super(message);
    this.name = "SerpError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function serpErrorStatus(err: unknown): number {
  if (err instanceof SerpError) return err.statusCode;
  return 500;
}
