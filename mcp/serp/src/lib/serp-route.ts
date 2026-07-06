import type { Express, Request, Response } from "express";
import { SerpError, serpErrorStatus } from "./errors.js";
import { getTopResults } from "./serp.js";

export function registerSerpRoute(app: Express): void {
  app.post("/serp", async (req: Request, res: Response) => {
    const keyword = req.body?.keyword;
    const count = req.body?.count;

    if (typeof keyword !== "string" || !keyword.trim()) {
      res.status(400).json({
        error: "INVALID_KEYWORD",
        message: "keyword is required",
      });
      return;
    }

    const parsedCount =
      count === undefined ? 10 : Number(count);
    if (!Number.isFinite(parsedCount) || parsedCount < 1) {
      res.status(400).json({
        error: "INVALID_KEYWORD",
        message: "count must be a positive number",
      });
      return;
    }

    try {
      const result = await getTopResults(keyword, parsedCount);
      res.json(result);
    } catch (err) {
      const status = serpErrorStatus(err);
      const message = err instanceof Error ? err.message : String(err);
      const code = err instanceof SerpError ? err.code : "SERP_API_ERROR";
      res.status(status).json({ error: code, message });
    }
  });
}
