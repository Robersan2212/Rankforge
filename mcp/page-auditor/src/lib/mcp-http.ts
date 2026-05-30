import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Express } from "express";

export function createMcpHttpApp(
  createServer: () => McpServer,
  path = "/mcp"
): Express {
  const app = createMcpExpressApp({ host: "0.0.0.0" });

  app.post(path, async (req, res) => {
    const server = createServer();
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      res.on("close", () => {
        transport.close();
        server.close();
      });
    } catch (error) {
      console.error("MCP request error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  app.get(path, (_req, res) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    });
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  return app;
}

export function listenMcpApp(
  app: Express,
  port: number,
  name: string
): void {
  app.listen(port, () => {
    console.log(`${name} MCP server listening on http://127.0.0.1:${port}/mcp`);
  });
}
