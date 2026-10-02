import {
  createDatabaseClient,
  deliverAuditOutbox,
  createLocalAuditHttpTransport,
} from "../packages/prisma-client/dist/index.js";
import { loadLocalAuditConfig } from "./local-audit-config.mjs";

// Local-only operator command. Never load the root .env or a hosted DATABASE_URL.
let db;
try {
  const config = loadLocalAuditConfig();
  db = createDatabaseClient(config.databaseUrl);
  // A 25-event batch has up to 75 seconds of transport waits inside a 120s lease.
  const summary = await deliverAuditOutbox(
    db,
    createLocalAuditHttpTransport(config),
    { leaseMs: 120_000 },
  );
  const backlog = {
    pending: await db.auditOutbox.count({
      where: { deliveryState: "pending" },
    }),
    delivering: await db.auditOutbox.count({
      where: { deliveryState: "delivering" },
    }),
    blocked: await db.auditOutbox.count({
      where: { deliveryState: "blocked" },
    }),
  };
  console.log(JSON.stringify({ ...summary, backlog }));
  if (backlog.blocked > 0 || summary.retried > 0) process.exitCode = 1;
} catch {
  console.error(
    "Local audit delivery failed. Check audit:local:init, local database and audit:serve:local.",
  );
  process.exitCode = 1;
} finally {
  await db?.$disconnect();
}
