import { loadEnvFile } from "./lib/load-env.js";

loadEnvFile();

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createSerpServer } from "./server.js";

const server = createSerpServer();
const transport = new StdioServerTransport();
await server.connect(transport);
