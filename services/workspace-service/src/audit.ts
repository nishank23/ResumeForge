import { createHash } from "node:crypto";
import { validateAuditEventIntent } from "@resume-forge/audit-contracts";
import {
  AuditDeliveryRejection,
  type createDatabaseClient,
} from "@resume-forge/prisma-client";

type Database = ReturnType<typeof createDatabaseClient>;

/**
 * Workspace-owned ingestion. HTTP composition must authenticate its producer
 * before invoking this use case; trusted in-process tests may invoke it directly.
 * This records previously authorized history; it never grants resource access.
 */
export async function ingestPersonalAuditEvent(db: Database, input: unknown) {
  const result = validateAuditEventIntent(input);
  if (!result.success) throw new AuditDeliveryRejection("invalid_intent");
  const intent = result.data;
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (
    intent.workspaceType !== "individual" ||
    intent.outcome !== "succeeded" ||
    (intent.targetUserId !== undefined &&
      intent.targetUserId !== intent.actorUserId) ||
    ![intent.eventId, intent.actorUserId, intent.workspaceId].every((id) =>
      uuid.test(id),
    )
  )
    throw new AuditDeliveryRejection("invalid_scope");
  // Canonical key order (including metadata) makes equivalent retries converge.
  const metadata = Object.fromEntries(
    Object.entries(intent.metadata).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    ),
  );
  const normalized = {
    ...intent,
    eventId: intent.eventId.toLowerCase(),
    actorUserId: intent.actorUserId.toLowerCase(),
    workspaceId: intent.workspaceId.toLowerCase(),
    ...(intent.targetUserId === undefined
      ? {}
      : { targetUserId: intent.targetUserId.toLowerCase() }),
    metadata,
  };
  const hash = createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex");
  return db.$transaction(async (tx) => {
    const workspace = await tx.workspace.findFirst({
      where: {
        id: normalized.workspaceId,
        type: "individual",
        personalOwnerUserId: normalized.actorUserId,
      },
      select: { id: true },
    });
    if (!workspace) throw new AuditDeliveryRejection("invalid_scope");
    const inserted = await tx.auditEvent.createMany({
      data: [
        {
          id: normalized.eventId,
          actorUserId: normalized.actorUserId,
          workspaceType: normalized.workspaceType,
          workspaceId: normalized.workspaceId,
          targetUserId: normalized.targetUserId,
          action: normalized.action,
          resourceType: normalized.resourceType,
          resourceId: normalized.resourceId,
          metadata,
          timestamp: new Date(normalized.occurredAt),
          outcome: normalized.outcome,
          correlationId: normalized.correlationId,
          payloadHash: hash,
        },
      ],
      skipDuplicates: true,
    });
    const persisted = await tx.auditEvent.findUniqueOrThrow({
      where: { id: normalized.eventId },
      select: { payloadHash: true },
    });
    if (persisted.payloadHash !== hash)
      throw new AuditDeliveryRejection("event_conflict");
    return { eventId: normalized.eventId, duplicate: inserted.count === 0 };
  });
}
