import { createMcpHttpApp, listenMcpApp } from "./lib/mcp-http.js";
import { createPageAuditorServer } from "./server.js";

const PORT = Number(process.env.PORT ?? 3001);
const app = createMcpHttpApp(createPageAuditorServer);
listenMcpApp(app, PORT, "page-auditor");
