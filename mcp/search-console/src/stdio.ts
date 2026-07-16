import { loadEnvFile } from "./lib/load-env.js";

loadEnvFile();

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createSearchConsoleServer } from "./server.js";

const server = createSearchConsoleServer();
const transport = new StdioServerTransport();
await server.connect(transport);
