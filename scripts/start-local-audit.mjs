import { createRequire } from "node:module";
import { createDatabaseClient } from "../packages/prisma-client/dist/index.js";
import { createWorkspaceAuditApp } from "../services/workspace-service/dist/app.js";
import { loadLocalAuditConfig } from "./local-audit-config.mjs";

// Resolve the adapter from the workspace that owns the HTTP server dependency.
const { serve } = createRequire(
  new URL("../services/workspace-service/package.json", import.meta.url),
)("@hono/node-server");
let db;
try {
  const config = loadLocalAuditConfig();
  db = createDatabaseClient(config.databaseUrl);
  await db.$connect();
  const app = createWorkspaceAuditApp({ db, relayKey: config.key });
  const server = serve(
    { fetch: app.fetch, hostname: "127.0.0.1", port: 4005 },
    () => {
      console.log(
        "Local workspace audit service listening on http://127.0.0.1:4005",
      );
    },
  );
  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  server.on("error", async () => {
    console.error("Local audit service failed to listen. Check port 4005.");
    await db.$disconnect();
    process.exitCode = 1;
  });
  const stop = () => {
    server.close(async () => {
      await db.$disconnect();
    });
    server.closeAllConnections();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
} catch {
  console.error(
    "Local audit service startup failed. Run audit:local:init and check local database status/migrations.",
  );
  await db?.$disconnect();
  process.exitCode = 1;
}
