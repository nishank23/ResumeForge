export { managedRuntimeDatabaseUrl } from "./local-runtime.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client.js";
export {
  runAuditRelayWorker,
  type AuditRelayWorkerOptions,
} from "./audit-worker.js";
export {
  runtimeRoleNames,
  RUNTIME_GRANTS,
  RUNTIME_FUNCTIONS,
  assertRuntimeDatabaseRole,
  type RuntimeService,
} from "./runtime-access.js";
export { withPersonalAuditTransaction, AuditCaptureError } from "./audit.js";
export {
  createLocalAuditHttpTransport,
  INTERNAL_AUDIT_PATH,
  LOCAL_AUDIT_SERVICE_ID,
  localAuditRelayKeySchema,
} from "./audit-http.js";
export {
  deliverAuditOutbox,
  AuditDeliveryRejection,
  type AuditDeliverySummary,
} from "./audit-delivery.js";

/** Server-only client. Callers supply configuration; never export models to browser DTOs. */
export function createDatabaseClient(
  connectionString: string,
  options: { timeoutMs?: number } = {},
): PrismaClient {
  const timeout = options.timeoutMs;
  if (
    timeout !== undefined &&
    (!Number.isInteger(timeout) || timeout < 50 || timeout > 30_000)
  )
    throw new RangeError("Invalid database timeout");
  // adapter-pg normalizes timestamptz offsets as UTC; request UTC output on every pooled connection.
  const connection = new URL(connectionString);
  connection.searchParams.set(
    "options",
    [connection.searchParams.get("options"), "-c timezone=UTC"]
      .filter(Boolean)
      .join(" "),
  );
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: connection.href,
      ...(timeout === undefined
        ? {}
        : {
            connectionTimeoutMillis: timeout,
            statement_timeout: timeout,
            query_timeout: timeout + 1_000,
          }),
    }),
  });
}
