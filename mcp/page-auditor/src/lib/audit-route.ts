import type { Express, Request, Response } from "express";
import { auditUrl } from "./audit.js";
import { AuditError, auditErrorStatus } from "./errors.js";

export function registerAuditRoute(app: Express): void {
  app.post("/audit", async (req: Request, res: Response) => {
    const url = req.body?.url;
    if (typeof url !== "string" || !url.trim()) {
      res.status(400).json({ error: "INVALID_URL", message: "url is required" });
      return;
    }

    try {
      const report = await auditUrl(url);
      res.json(report);
    } catch (err) {
      const status = auditErrorStatus(err);
      const message = err instanceof Error ? err.message : String(err);
      const code = err instanceof AuditError ? err.code : "FETCH_FAILED";
      res.status(status).json({ error: code, message });
    }
  });
}
