import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listBriefs, saveBrief } from "./lib/db.js";

const briefSchema = z.object({
  title: z.string(),
  keywords: z.array(z.string()),
  outline: z.array(z.string()),
});

export function createContentDbServer(): McpServer {
  const server = new McpServer({
    name: "content-db-mcp",
    version: "1.0.0",
  });

  server.registerTool(
    "save_brief",
    {
      description:
        "Saves a content brief to the Rankforge project database (public.briefs).",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        keyword: z.string().min(1).describe("Primary keyword for the brief"),
        brief: briefSchema.describe("Brief content payload"),
      },
    },
    async ({ projectId, keyword, brief }) => {
      try {
        const saved = await saveBrief(projectId, keyword, brief);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: true, briefId: saved.id, saved }),
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
                projectId,
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "list_briefs",
    {
      description: "Lists content briefs for a project.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
      },
    },
    async ({ projectId }) => {
      try {
        const briefs = await listBriefs(projectId);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ projectId, briefs }, null, 2),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: false, error: message, projectId }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}
