import { createMcpHttpApp, listenMcpApp } from "./lib/mcp-http.js";
import { createContentDbServer } from "./server.js";

const PORT = Number(process.env.PORT ?? 3004);
const app = createMcpHttpApp(createContentDbServer);
listenMcpApp(app, PORT, "content-db");
