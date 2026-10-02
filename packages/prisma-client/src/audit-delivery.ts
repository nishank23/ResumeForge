import { randomUUID } from "node:crypto";
import {
  validateAuditEventIntent,
  type AuditEventIntent,
} from "@resume-forge/audit-contracts";
import type { Prisma, PrismaClient } from "./generated/client.js";

export type AuditDeliveryRejectionCode =
  "invalid_intent" | "invalid_scope" | "event_conflict";

const rejectionCodes = new Set<string>([
  "invalid_intent",
  "invalid_scope",
  "event_conflict",
]);

/** Permanent failures contain only fixed codes, never transport/payload details. */
export class AuditDeliveryRejection extends Error {
  constructor(readonly code: AuditDeliveryRejectionCode) {
    super("Audit delivery rejected");
    this.name = "AuditDeliveryRejection";
  }
}

export interface AuditDeliverySummary {
  claimed: number;
  delivered: number;
  retried: number;
  blocked: number;
  stale: number;
}

interface ClaimedIntent {
  eventId: string;
  payload: Prisma.JsonValue;
  attempts: number;
}

/**
 * Producer-side relay. Transport must resolve only after durable ingestion.
 * At-least-once delivery requires an idempotent recipient. No DB transaction is
 * held across transport. A crashed/stalled attempt is reclaimed after its lease.
 */
export async function deliverAuditOutbox(
  db: PrismaClient,
  deliver: (intent: AuditEventIntent) => Promise<unknown>,
  options: { batchSize?: number; leaseMs?: number; now?: () => Date } = {},
): Promise<AuditDeliverySummary> {
  const batchSize = options.batchSize ?? 25;
  const leaseMs = options.leaseMs ?? 30_000;
  const clock = options.now ?? (() => new Date());
  if (
    !Number.isInteger(batchSize) ||
    batchSize < 1 ||
    batchSize > 100 ||
    !Number.isInteger(leaseMs) ||
    leaseMs < 1_000 ||
    leaseMs > 300_000
  )
    throw new RangeError("Invalid audit delivery limits");
  const now = clock();
  if (!Number.isFinite(now.getTime()))
    throw new RangeError("Invalid audit clock");
  const token = randomUUID();
  const expiry = new Date(now.getTime() + leaseMs);
  const rows = await db.$queryRaw<ClaimedIntent[]>`
    WITH due AS (
      SELECT "id" FROM "AuditOutbox"
      WHERE ("deliveryState" = 'pending' AND "nextAttemptAt" <= ${now})
         OR ("deliveryState" = 'delivering' AND "leaseExpiresAt" <= ${now})
      ORDER BY "nextAttemptAt", "createdAt", "id"
      LIMIT ${batchSize} FOR UPDATE SKIP LOCKED
    )
    UPDATE "AuditOutbox" AS outbox
    SET "deliveryState" = 'delivering', "leaseToken" = ${token}::uuid,
        "leaseExpiresAt" = ${expiry}, "updatedAt" = ${now},
        "attempts" = LEAST(outbox."attempts"::bigint + 1, 2147483647)::integer
    FROM due WHERE outbox."id" = due."id"
    RETURNING outbox."eventId", outbox."payload", outbox."attempts"
  `;
  const summary: AuditDeliverySummary = {
    claimed: rows.length,
    delivered: 0,
    retried: 0,
    blocked: 0,
    stale: 0,
  };
  for (const row of rows) {
    let errorCode: AuditDeliveryRejectionCode | "delivery_unavailable" | null =
      null;
    try {
      const intent = validateAuditEventIntent(row.payload);
      if (!intent.success || intent.data.eventId.toLowerCase() !== row.eventId)
        throw new AuditDeliveryRejection("invalid_intent");
      await deliver(intent.data);
    } catch (error: unknown) {
      errorCode =
        error instanceof AuditDeliveryRejection &&
        rejectionCodes.has(error.code)
          ? error.code
          : "delivery_unavailable";
    }
    const finishedAt = clock();
    const permanent =
      errorCode !== null && errorCode !== "delivery_unavailable";
    // Retry indefinitely with a capped delay; committed intents are never dropped.
    const delay = Math.min(300_000, 5_000 * 2 ** Math.min(row.attempts - 1, 6));
    const result = await db.auditOutbox.updateMany({
      where: {
        eventId: row.eventId,
        deliveryState: "delivering",
        leaseToken: token,
      },
      data: {
        deliveryState:
          errorCode === null ? "delivered" : permanent ? "blocked" : "pending",
        leaseToken: null,
        leaseExpiresAt: null,
        lastErrorCode: errorCode,
        deliveredAt: errorCode === null ? finishedAt : null,
        nextAttemptAt:
          errorCode === null || permanent
            ? finishedAt
            : new Date(finishedAt.getTime() + delay),
      },
    });
    // An expired attempt cannot acknowledge or reschedule a newer owner's lease.
    if (result.count === 0) summary.stale++;
    else if (errorCode === null) summary.delivered++;
    else if (permanent) summary.blocked++;
    else summary.retried++;
  }
  return summary;
}
