import express from "express";
import { createMcpHttpApp, listenMcpApp } from "./lib/mcp-http.js";
import { registerAuditRoute } from "./lib/audit-route.js";
import { createPageAuditorServer } from "./server.js";

const PORT = Number(process.env.PORT ?? 3001);

const mcpApp = createMcpHttpApp(createPageAuditorServer);
const app = express();

app.use(express.json());
registerAuditRoute(app);

app.use(mcpApp);

listenMcpApp(app, PORT, "page-auditor");
