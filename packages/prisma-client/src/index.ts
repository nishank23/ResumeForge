import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client.js";
export { withPersonalAuditTransaction, AuditCaptureError } from "./audit.js";
export {
  deliverAuditOutbox,
  AuditDeliveryRejection,
  type AuditDeliverySummary,
} from "./audit-delivery.js";

/** Server-only client. Callers supply configuration; never export models to browser DTOs. */
export function createDatabaseClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
