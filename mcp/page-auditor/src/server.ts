import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { auditPage } from "./lib/audit.js";

export function createPageAuditorServer(): McpServer {
  const server = new McpServer({
    name: "page-auditor-mcp",
    version: "1.0.0",
  });

  server.registerTool(
    "audit_page",
    {
      description:
        "Crawls a URL and returns SEO signals: meta tags, headings, word count, links, images, rubric issues, and an SEO score (0–100).",
      inputSchema: {
        url: z.string().url().describe("The page URL to audit"),
      },
    },
    async ({ url }) => {
      try {
        const result = await auditPage(url);
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
