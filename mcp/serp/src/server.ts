import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SerpError } from "./lib/errors.js";
import { getTopResults } from "./lib/serp.js";

async function runSerpTool(keyword: string, count?: number) {
  try {
    const result = await getTopResults(keyword, count ?? 10);
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
    const code = err instanceof SerpError ? err.code : "SERP_API_ERROR";
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ success: false, error: code, message, keyword }),
        },
      ],
      isError: true,
    };
  }
}

export function createSerpServer(): McpServer {
  const server = new McpServer({
    name: "serp-mcp",
    version: "1.0.0",
  });

  const inputSchema = {
    keyword: z.string().min(1).describe("Target keyword to search"),
    count: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .describe("Number of organic results (default 10)"),
  };

  server.registerTool(
    "get_top_results",
    {
      description:
        "Fetches top organic Google search results for a keyword via SerpAPI.",
      inputSchema,
    },
    async ({ keyword, count }) => runSerpTool(keyword, count)
  );

  server.registerTool(
    "fetch_serp",
    {
      description:
        "Alias for get_top_results — fetches organic Google results via SerpAPI.",
      inputSchema: { keyword: inputSchema.keyword },
    },
    async ({ keyword }) => runSerpTool(keyword)
  );

  return server;
}
