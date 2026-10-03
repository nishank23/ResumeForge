import {
  createDatabaseClient,
  assertRuntimeDatabaseRole,
  deliverAuditOutbox,
  createLocalAuditHttpTransport,
  runAuditRelayWorker,
} from "../packages/prisma-client/dist/index.js";
import { loadLocalAuditConfig } from "./local-audit-config.mjs";

const controller = new AbortController();
const stop = () => controller.abort();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
let db;
try {
  const config = loadLocalAuditConfig();
  // Bound pool connection, server statements and client-side query waits.
  db = createDatabaseClient(config.databaseUrl, { timeoutMs: 3_000 });
  await assertRuntimeDatabaseRole(db, "auditRelay");
  const send = createLocalAuditHttpTransport(config);
  let unavailable = false;
  let previousBacklog;
  console.log(
    "Local audit worker running: 5 events/pass, 5s between completed passes. Ctrl-C stops gracefully.",
  );
  await runAuditRelayWorker(
    async () => {
      // Check access on every scheduled pass; extra/missing grants halt claims.
      await assertRuntimeDatabaseRole(db, "auditRelay");
      if (controller.signal.aborted)
        return { claimed: 0, delivered: 0, retried: 0, blocked: 0, stale: 0 };
      const summary = await deliverAuditOutbox(db, send, {
        batchSize: 5,
        leaseMs: 120_000,
      });
      const counts = await Promise.all(
        ["pending", "delivering", "blocked"].map((deliveryState) =>
          db.auditOutbox.count({ where: { deliveryState } }),
        ),
      );
      const backlog = Object.fromEntries(
        ["pending", "delivering", "blocked"].map((state, i) => [
          state,
          counts[i],
        ]),
      );
      const serialized = JSON.stringify(backlog);
      if (summary.claimed > 0 || unavailable || serialized !== previousBacklog)
        console.log(JSON.stringify({ ...summary, backlog }));
      previousBacklog = serialized;
      unavailable = false;
      return summary;
    },
    {
      signal: controller.signal,
      onUnavailable: () => {
        if (!unavailable)
          console.error(
            "Local audit worker unavailable; retrying without discarding intents. Check database status and runtime grants.",
          );
        unavailable = true;
      },
    },
  );
  console.log("Local audit worker stopped.");
} catch {
  console.error(
    "Local audit worker failed to start/run. Check db:runtime:init, audit:local:init and local database status.",
  );
  process.exitCode = 1;
} finally {
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
  try {
    await db?.$disconnect();
  } catch {
    process.exitCode = 1;
  }
}
