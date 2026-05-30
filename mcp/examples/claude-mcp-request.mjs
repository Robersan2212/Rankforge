/**
 * Example: call Claude with multiple Rankforge MCP servers (HTTPS required).
 *
 *   ANTHROPIC_API_KEY=... \
 *   PAGE_AUDITOR_MCP_URL=https://.../mcp \
 *   node mcp/examples/claude-mcp-request.mjs
 */
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const pageAuditorUrl = process.env.PAGE_AUDITOR_MCP_URL;
if (!pageAuditorUrl) {
  console.error("Set PAGE_AUDITOR_MCP_URL to your deployed page-auditor /mcp endpoint (HTTPS).");
  process.exit(1);
}

const mcpServers = [
  {
    type: "url",
    name: "page-auditor",
    url: pageAuditorUrl,
  },
];

if (process.env.SERP_MCP_URL) {
  mcpServers.push({
    type: "url",
    name: "serp",
    url: process.env.SERP_MCP_URL,
  });
}

const tools = mcpServers.map((s) => ({
  type: "mcp_toolset",
  mcp_server_name: s.name,
}));

const response = await client.beta.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 4096,
  betas: ["mcp-client-2025-11-20"],
  messages: [
    {
      role: "user",
      content:
        "Audit https://example.com and list the three most important SEO fixes.",
    },
  ],
  mcp_servers: mcpServers,
  tools,
});

for (const block of response.content) {
  if (block.type === "text") {
    console.log(block.text);
  }
}
