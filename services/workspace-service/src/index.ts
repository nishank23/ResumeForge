import { serve } from "@hono/node-server";
import { createDatabaseClient } from "@resume-forge/prisma-client";
import { createLocalActorResolver } from "@resume-forge/access-policy/server";
import { createWorkspaceApp } from "./app.js";

const databaseUrl =
  process.env["DATABASE_URL"] ??
  "postgresql://postgres:postgres@127.0.0.1:55432/resume_forge_dev";
const port = Number(process.env["PORT"] ?? 4003);
const authEndpoint =
  process.env["AUTH_RESOLVE_ENDPOINT"] ?? "http://127.0.0.1:4001/internal/auth/resolve";
const authKey = process.env["LOCAL_PROFILE_SERVICE_KEY"] ?? "0".repeat(64);
const relayKey = process.env["LOCAL_AUDIT_RELAY_KEY"];

const db = createDatabaseClient(databaseUrl, { timeoutMs: 5_000 });

const app = createWorkspaceApp({
  db,
  resolveActor: createLocalActorResolver({
    endpoint: authEndpoint,
    key: authKey,
  }),
  relayKey,
});

serve({ fetch: app.fetch, hostname: "127.0.0.1", port }, () => {
  console.log(`Workspace service listening on http://localhost:${String(port)}`);
});
