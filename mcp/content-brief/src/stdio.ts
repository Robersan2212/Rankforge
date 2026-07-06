import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createContentBriefServer } from "./server.js";

const server = createContentBriefServer();
const transport = new StdioServerTransport();
await server.connect(transport);
