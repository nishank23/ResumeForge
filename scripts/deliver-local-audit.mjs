import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import {
  createDatabaseClient,
  deliverAuditOutbox,
} from "../packages/prisma-client/dist/index.js";
import { ingestPersonalAuditEvent } from "../services/workspace-service/dist/audit.js";

// Local-only operator command. Never load the root .env or a hosted DATABASE_URL.
let db;
try {
  const local = parseEnv(
    readFileSync(new URL("../.local/database.env", import.meta.url), "utf8"),
  );
  const url = new URL(local.DATABASE_URL);
  if (
    url.hostname !== "127.0.0.1" ||
    url.port !== "55432" ||
    url.pathname !== "/resume_forge_dev"
  )
    throw new Error("Invalid local configuration");
  db = createDatabaseClient(url.href);
  const summary = await deliverAuditOutbox(db, (intent) =>
    ingestPersonalAuditEvent(db, intent),
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
    "Local audit delivery failed. Check local database status and migrations.",
  );
  process.exitCode = 1;
} finally {
  await db?.$disconnect();
}
