import type { Express, Request, Response } from "express";
import { GscError, gscErrorStatus } from "./errors.js";
import { getGscMetrics } from "./gsc.js";

export function registerGscRoute(app: Express): void {
  app.post("/gsc-metrics", async (req: Request, res: Response) => {
    const projectId = req.body?.project_id;
    const url = req.body?.url;
    const dateRangeStart = req.body?.date_range_start;
    const dateRangeEnd = req.body?.date_range_end;
    const bypassCache = Boolean(req.body?.bypass_cache);

    if (typeof projectId !== "string" || !projectId.trim()) {
      res.status(400).json({ error: "INVALID_PROJECT", message: "project_id is required" });
      return;
    }
    if (typeof url !== "string" || !url.trim()) {
      res.status(400).json({ error: "INVALID_URL", message: "url is required" });
      return;
    }

    try {
      const result = await getGscMetrics({
        projectId: projectId.trim(),
        url: url.trim(),
        dateRangeStart:
          typeof dateRangeStart === "string" ? dateRangeStart : undefined,
        dateRangeEnd: typeof dateRangeEnd === "string" ? dateRangeEnd : undefined,
        bypassCache,
      });
      res.json(result);
    } catch (err) {
      const status = gscErrorStatus(err);
      const message = err instanceof Error ? err.message : String(err);
      const code = err instanceof GscError ? err.code : "GSC_API_ERROR";
      res.status(status).json({ error: code, message });
    }
  });
}
