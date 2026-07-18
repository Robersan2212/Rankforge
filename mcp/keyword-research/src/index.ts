import { loadEnvFile } from "./lib/load-env.js";

loadEnvFile();

import express from "express";
import { createMcpHttpApp, listenMcpApp } from "./lib/mcp-http.js";
import { registerResearchRoute } from "./lib/research-route.js";
import { createKeywordResearchServer } from "./server.js";

const PORT = Number(process.env.PORT ?? 3007);

const mcpApp = createMcpHttpApp(createKeywordResearchServer);
const app = express();

app.use(express.json());
registerResearchRoute(app);
app.use(mcpApp);

listenMcpApp(app, PORT, "keyword-research");
