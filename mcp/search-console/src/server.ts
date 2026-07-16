import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GscError } from "./lib/errors.js";
import { getGscMetrics } from "./lib/gsc.js";

async function runGscTool(
  projectId: string,
  url: string,
  dateRangeStart?: string,
  dateRangeEnd?: string,
  bypassCache?: boolean
) {
  try {
    const result = await getGscMetrics({
      projectId,
      url,
      dateRangeStart,
      dateRangeEnd,
      bypassCache,
    });
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = err instanceof GscError ? err.code : "GSC_API_ERROR";
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ success: false, error: code, message, projectId, url }),
        },
      ],
      isError: true,
    };
  }
}

export function createSearchConsoleServer(): McpServer {
  const server = new McpServer({
    name: "search-console-mcp",
    version: "1.0.0",
  });

  const inputSchema = {
    project_id: z.string().min(1).describe("Rankforge project UUID"),
    url: z.string().url().describe("Audited page URL"),
    date_range_start: z.string().optional().describe("YYYY-MM-DD"),
    date_range_end: z.string().optional().describe("YYYY-MM-DD"),
    bypass_cache: z.boolean().optional().describe("Skip 24h cache"),
  };

  server.registerTool(
    "get_gsc_metrics",
    {
      description:
        "Fetches Google Search Console impressions, clicks, CTR, and position for a URL.",
      inputSchema,
    },
    async ({ project_id, url, date_range_start, date_range_end, bypass_cache }) =>
      runGscTool(project_id, url, date_range_start, date_range_end, bypass_cache)
  );

  return server;
}
