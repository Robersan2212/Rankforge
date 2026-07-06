import { loadEnvFile } from "./lib/load-env.js";

loadEnvFile();

import express from "express";
import { createMcpHttpApp, listenMcpApp } from "./lib/mcp-http.js";
import { registerSerpRoute } from "./lib/serp-route.js";
import { createSerpServer } from "./server.js";

const PORT = Number(process.env.PORT ?? 3002);

const mcpApp = createMcpHttpApp(createSerpServer);
const app = express();

app.use(express.json());
registerSerpRoute(app);
app.use(mcpApp);

listenMcpApp(app, PORT, "serp");
