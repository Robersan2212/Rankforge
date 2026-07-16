import { loadEnvFile } from "./lib/load-env.js";

loadEnvFile();

import express from "express";
import { createMcpHttpApp, listenMcpApp } from "./lib/mcp-http.js";
import { registerGscRoute } from "./lib/gsc-route.js";
import { createSearchConsoleServer } from "./server.js";

const PORT = Number(process.env.PORT ?? 3006);

const mcpApp = createMcpHttpApp(createSearchConsoleServer);
const app = express();

app.use(express.json());
registerGscRoute(app);
app.use(mcpApp);

listenMcpApp(app, PORT, "search-console");
