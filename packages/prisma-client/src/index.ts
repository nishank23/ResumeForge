import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client.js";
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
export function createDatabaseClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
