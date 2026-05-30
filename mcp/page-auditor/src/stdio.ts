import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createPageAuditorServer } from "./server.js";

const server = createPageAuditorServer();
const transport = new StdioServerTransport();
await server.connect(transport);
