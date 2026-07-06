import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { analyzeBatch } from "./lib/batch.js";
import { extractPage } from "./lib/extract.js";

export function createCompetitorAnalysisServer(): McpServer {
  const server = new McpServer({
    name: "competitor-analysis-mcp",
    version: "1.0.0",
  });

  server.registerTool(
    "extract_page",
    {
      description:
        "Scrapes a competitor page and extracts headings, word count, topics, and FAQ questions.",
      inputSchema: {
        url: z.string().min(1).describe("Page URL to extract"),
        rank_position: z.number().int().optional(),
      },
    },
    async ({ url, rank_position }) => {
      const result = await extractPage(url, rank_position);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    }
  );

  server.registerTool(
    "analyze_competitors",
    {
      description:
        "Batch-analyze multiple competitor URLs with capped concurrency.",
      inputSchema: {
        urls: z
          .array(
            z.object({
              url: z.string().min(1),
              rank_position: z.number().int().optional(),
            })
          )
          .min(1),
      },
    },
    async ({ urls }) => {
      const results = await analyzeBatch(urls);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ results }, null, 2),
          },
        ],
      };
    }
  );

  return server;
}
