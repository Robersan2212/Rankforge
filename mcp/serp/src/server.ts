import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchSerp } from "./lib/serp.js";

export function createSerpServer(): McpServer {
  const server = new McpServer({
    name: "serp-mcp",
    version: "1.0.0",
  });

  server.registerTool(
    "fetch_serp",
    {
      description:
        "Fetches the top 10 organic Google search results for a keyword via SerpAPI.",
      inputSchema: {
        keyword: z.string().min(1).describe("Target keyword to search"),
      },
    },
    async ({ keyword }) => {
      try {
        const results = await fetchSerp(keyword);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ keyword, results }, null, 2),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: false, error: message, keyword }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}
