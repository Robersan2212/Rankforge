import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ResearchError } from "./lib/errors.js";
import { getRelatedKeywords } from "./lib/research.js";

async function runResearchTool(seed: string, limit?: number) {
  try {
    const result = await getRelatedKeywords(seed, limit ?? 50);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = err instanceof ResearchError ? err.code : "RESEARCH_ERROR";
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ success: false, error: code, message, seed }),
        },
      ],
      isError: true,
    };
  }
}

export function createKeywordResearchServer(): McpServer {
  const server = new McpServer({
    name: "keyword-research-mcp",
    version: "1.0.0",
  });

  server.registerTool(
    "get_related_keywords",
    {
      description:
        "Fetch related keywords with search volume and difficulty for a seed keyword.",
      inputSchema: {
        seed: z.string().min(2).max(100).describe("Seed keyword"),
        limit: z
          .number()
          .int()
          .min(20)
          .max(50)
          .optional()
          .describe("Max related keywords (20–50, default 50)"),
      },
    },
    async ({ seed, limit }) => runResearchTool(seed, limit)
  );

  return server;
}
