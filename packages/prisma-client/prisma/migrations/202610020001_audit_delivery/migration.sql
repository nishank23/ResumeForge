-- Preserve existing audit history: new fields remain NULL on legacy events.
ALTER TABLE "AuditEvent"
  ADD COLUMN "outcome" TEXT,
  ADD COLUMN "correlationId" TEXT,
  ADD COLUMN "payloadHash" TEXT;

ALTER TABLE "AuditOutbox"
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "leaseToken" UUID,
  ADD COLUMN "leaseExpiresAt" TIMESTAMPTZ(3),
  ADD COLUMN "deliveredAt" TIMESTAMPTZ(3),
  ADD COLUMN "lastErrorCode" TEXT,
  ADD CONSTRAINT "AuditOutbox_delivery_state_check"
    CHECK ("deliveryState" IN ('pending', 'delivering', 'delivered', 'blocked')),
  ADD CONSTRAINT "AuditOutbox_attempts_check" CHECK ("attempts" >= 0),
  ADD CONSTRAINT "AuditOutbox_lease_check" CHECK (
    ("deliveryState" = 'delivering' AND "leaseToken" IS NOT NULL AND "leaseExpiresAt" IS NOT NULL)
    OR ("deliveryState" <> 'delivering' AND "leaseToken" IS NULL AND "leaseExpiresAt" IS NULL)
  ),
  ADD CONSTRAINT "AuditOutbox_delivered_check" CHECK (
    ("deliveryState" = 'delivered') = ("deliveredAt" IS NOT NULL)
  );

CREATE INDEX "AuditOutbox_deliveryState_nextAttemptAt_createdAt_idx"
  ON "AuditOutbox"("deliveryState", "nextAttemptAt", "createdAt");
