import type { Express, Request, Response } from "express";
import { auditUrl } from "./audit.js";
import { AuditError, auditErrorStatus } from "./errors.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const requestLog = new Map<string, number[]>();
const MCP_RATE_LIMIT = 10;
const MCP_RATE_WINDOW_MS = 60_000;

function checkMcpRateLimit(clientKey: string): void {
  const now = Date.now();
  const recent = (requestLog.get(clientKey) ?? []).filter(
    (ts) => now - ts < MCP_RATE_WINDOW_MS
  );
  if (recent.length >= MCP_RATE_LIMIT) {
    throw new AuditError(
      "RATE_LIMITED",
      "Too many audit requests. Try again in a minute.",
      429
    );
  }
  recent.push(now);
  requestLog.set(clientKey, recent);
}

export function registerAuditRoute(app: Express): void {
  app.post("/audit", async (req: Request, res: Response) => {
    const url = req.body?.url;
    const projectId = req.body?.project_id;

    if (typeof url !== "string" || !url.trim()) {
      res.status(400).json({ error: "INVALID_URL", message: "url is required" });
      return;
    }

    if (
      projectId !== undefined &&
      (typeof projectId !== "string" || !UUID_RE.test(projectId))
    ) {
      res.status(400).json({
        error: "INVALID_URL",
        message: "project_id must be a valid UUID when provided",
      });
      return;
    }

    const clientKey = req.ip ?? req.socket.remoteAddress ?? "unknown";

    try {
      checkMcpRateLimit(clientKey);
      const report = await auditUrl(url, {
        projectId: typeof projectId === "string" ? projectId : undefined,
      });
      res.json(report);
    } catch (err) {
      const status = auditErrorStatus(err);
      const message = err instanceof Error ? err.message : String(err);
      const code = err instanceof AuditError ? err.code : "FETCH_FAILED";
      res.status(status).json({ error: code, message });
    }
  });
}
