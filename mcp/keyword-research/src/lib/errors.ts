export class ResearchError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 500
  ) {
    super(message);
    this.name = "ResearchError";
  }
}

export function researchErrorStatus(err: unknown): number {
  if (err instanceof ResearchError) return err.status;
  return 500;
}
