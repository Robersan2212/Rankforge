export class GscError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 502) {
    super(message);
    this.name = "GscError";
    this.code = code;
    this.status = status;
  }
}

export function gscErrorStatus(err: unknown): number {
  if (err instanceof GscError) return err.status;
  return 502;
}
