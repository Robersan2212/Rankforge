import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createContentDbServer } from "./server.js";

const server = createContentDbServer();
const transport = new StdioServerTransport();
await server.connect(transport);
