import { serve } from "@hono/node-server";
import { createAtsApp } from "./app.js";
import { loadAtsConfig } from "./config.js";
import { createGeminiAssessor } from "./gemini.js";
const config = loadAtsConfig();
const app = createAtsApp({
  key: config.key,
  assess: createGeminiAssessor(config),
  timeoutMs: config.timeoutMs,
  available: !!config.geminiKey?.trim() && config.paidGemini,
});
serve({ fetch: app.fetch, hostname: config.host, port: config.port }, () => {
  console.log(`Internal ATS service listening on port ${String(config.port)}.`);
});
