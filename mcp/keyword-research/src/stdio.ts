import { loadEnvFile } from "./lib/load-env.js";

loadEnvFile();

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createKeywordResearchServer } from "./server.js";

const server = createKeywordResearchServer();
const transport = new StdioServerTransport();
await server.connect(transport);
