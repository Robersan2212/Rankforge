import express from "express";
import { registerExtractRoutes } from "./lib/extract-route.js";
import { createMcpHttpApp, listenMcpApp } from "./lib/mcp-http.js";
import { createCompetitorAnalysisServer } from "./server.js";

const PORT = Number(process.env.PORT ?? 3003);

const mcpApp = createMcpHttpApp(createCompetitorAnalysisServer);
const app = express();

app.use(express.json());
registerExtractRoutes(app);
app.use(mcpApp);

listenMcpApp(app, PORT, "competitor-analysis");
