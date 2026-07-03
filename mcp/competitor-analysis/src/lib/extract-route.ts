import type { Express, Request, Response } from "express";
import { analyzeBatch } from "./batch.js";
import { extractPage } from "./extract.js";

export function registerExtractRoutes(app: Express): void {
  app.post("/extract", async (req: Request, res: Response) => {
    const url = req.body?.url;
    const rankPosition = req.body?.rank_position;

    if (typeof url !== "string" || !url.trim()) {
      res.status(400).json({ error: "INVALID_URL", message: "url is required" });
      return;
    }

    const rank =
      rankPosition === undefined ? undefined : Number(rankPosition);

    const result = await extractPage(
      url,
      rank !== undefined && Number.isFinite(rank) ? rank : undefined
    );
    res.json(result);
  });

  app.post("/analyze-batch", async (req: Request, res: Response) => {
    const urls = req.body?.urls;

    if (!Array.isArray(urls) || urls.length === 0) {
      res.status(400).json({
        error: "INVALID_URL",
        message: "urls must be a non-empty array",
      });
      return;
    }

    const parsed = urls.map((item: unknown, index: number) => {
      if (typeof item === "string") {
        return { url: item, rank_position: index + 1 };
      }
      if (item && typeof item === "object" && "url" in item) {
        const obj = item as { url: unknown; rank_position?: unknown };
        return {
          url: String(obj.url),
          rank_position:
            obj.rank_position !== undefined
              ? Number(obj.rank_position)
              : index + 1,
        };
      }
      return { url: "", rank_position: index + 1 };
    });

    if (parsed.some((p) => !p.url.trim())) {
      res.status(400).json({
        error: "INVALID_URL",
        message: "each url entry must include a valid url string",
      });
      return;
    }

    const results = await analyzeBatch(parsed);
    res.json({ results });
  });
}
