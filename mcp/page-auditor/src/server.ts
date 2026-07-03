import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { auditUrl } from "./lib/audit.js";

export function createPageAuditorServer(): McpServer {
  const server = new McpServer({
    name: "page-auditor-mcp",
    version: "1.0.0",
  });

  server.registerTool(
    "audit_page",
    {
      description:
        "Crawls a URL and returns a structured SEO audit report with score breakdown (0–100).",
      inputSchema: {
        url: z.string().url().describe("The page URL to audit"),
      },
    },
    async ({ url }) => {
      try {
        const result = await auditUrl(url);
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
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: message,
                url,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}
