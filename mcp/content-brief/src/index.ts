import express from "express";
import { createMcpHttpApp, listenMcpApp } from "./lib/mcp-http.js";
import { generateContentBrief } from "./lib/generate.js";
import { createContentBriefServer } from "./server.js";

const PORT = Number(process.env.PORT ?? 3005);
const app = createMcpHttpApp(createContentBriefServer);

app.use(express.json());

app.post("/generate", async (req, res) => {
  try {
    const brief = await generateContentBrief(req.body);
    res.json({ success: true, brief });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(422).json({ success: false, error: message });
  }
});

listenMcpApp(app, PORT, "content-brief");
