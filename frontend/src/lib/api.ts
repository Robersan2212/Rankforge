import type { AuditResult } from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class AuditApiError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = "AuditApiError";
  }
}

export async function runAudit(url: string): Promise<AuditResult> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/audit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
  } catch {
    throw new AuditApiError(
      "Could not reach the audit server. Is the backend running on port 8000?"
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail =
      typeof data.detail === "string"
        ? data.detail
        : Array.isArray(data.detail)
          ? data.detail.map((d: { msg?: string }) => d.msg ?? String(d)).join(", ")
          : data.message ?? `Audit failed (${response.status})`;
    throw new AuditApiError(detail, response.status);
  }

  return data as AuditResult;
}

export function isValidAuditUrl(url: string): boolean {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
