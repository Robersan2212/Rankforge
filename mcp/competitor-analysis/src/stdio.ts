import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createCompetitorAnalysisServer } from "./server.js";

const server = createCompetitorAnalysisServer();
const transport = new StdioServerTransport();
await server.connect(transport);
