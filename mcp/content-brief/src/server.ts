import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateContentBrief } from "./lib/generate.js";

const auditDataSchema = z.record(z.unknown());
const competitorDataSchema = z.record(z.unknown());

export function createContentBriefServer(): McpServer {
  const server = new McpServer({
    name: "content-brief-mcp",
    version: "1.0.0",
  });

  server.registerTool(
    "generate_content_brief",
    {
      description:
        "Synthesize page audit and competitor analysis data into a structured SEO content brief.",
      inputSchema: {
        primary_keyword: z.string().min(1),
        audit_data: auditDataSchema,
        competitor_data: competitorDataSchema,
        source_audit_id: z.string().min(1),
        source_competitor_analysis_id: z.string().min(1),
      },
    },
    async (input) => {
      try {
        const brief = await generateContentBrief(input);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: true, brief }, null, 2),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: false, error: message }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}
