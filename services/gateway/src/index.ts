import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { ApiResponse } from "@resume-forge/shared-types";

const app = new Hono();

// ── Middleware ─────────────────────────────────────────────────────────
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: ["http://localhost:3000"],
    credentials: true,
  }),
);

// ── Health endpoint ───────────────────────────────────────────────────
app.get("/api/v1/health", (c) => {
  const response: ApiResponse<{ status: string; timestamp: string }> = {
    data: {
      status: "ok",
      timestamp: new Date().toISOString(),
    },
  };
  return c.json(response);
});

// ── Fallback ──────────────────────────────────────────────────────────
app.notFound((c) => {
  return c.json({ error: { code: "NOT_FOUND", message: "Route not found" } }, 404);
});

// ── Server ────────────────────────────────────────────────────────────
const port = Number(process.env["GATEWAY_PORT"]) || 4000;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Gateway listening on http://localhost:${String(info.port)}`);
});

export default app;
