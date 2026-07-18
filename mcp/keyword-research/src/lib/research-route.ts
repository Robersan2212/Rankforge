import type { Express, Request, Response } from "express";
import { ResearchError, researchErrorStatus } from "./errors.js";
import { getRelatedKeywords } from "./research.js";

export function registerResearchRoute(app: Express): void {
  app.post("/research", async (req: Request, res: Response) => {
    const seed = req.body?.seed ?? req.body?.keyword;
    const limit = req.body?.limit;

    if (typeof seed !== "string" || !seed.trim()) {
      res.status(400).json({
        error: "INVALID_SEED",
        message: "seed is required",
      });
      return;
    }

    const parsedLimit =
      limit === undefined ? 50 : Number(limit);
    if (!Number.isFinite(parsedLimit) || parsedLimit < 1) {
      res.status(400).json({
        error: "INVALID_SEED",
        message: "limit must be a positive number",
      });
      return;
    }

    try {
      const result = await getRelatedKeywords(seed, parsedLimit);
      res.json(result);
    } catch (err) {
      const status = researchErrorStatus(err);
      const message = err instanceof Error ? err.message : String(err);
      const code = err instanceof ResearchError ? err.code : "RESEARCH_ERROR";
      res.status(status).json({ error: code, message });
    }
  });
}
