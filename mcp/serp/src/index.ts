import { createMcpHttpApp, listenMcpApp } from "./lib/mcp-http.js";
import { createSerpServer } from "./server.js";

const PORT = Number(process.env.PORT ?? 3002);
const app = createMcpHttpApp(createSerpServer);
listenMcpApp(app, PORT, "serp");
