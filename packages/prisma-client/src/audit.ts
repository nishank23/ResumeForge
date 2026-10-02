import { validateAuditEventIntent } from "@resume-forge/audit-contracts";
import type { Prisma, PrismaClient } from "./generated/client.js";

/** Validation errors deliberately omit input values and metadata key names. */
export class AuditCaptureError extends Error {
  constructor() {
    super("Audit capture rejected");
    this.name = "AuditCaptureError";
  }
}

/**
 * Caller must authenticate the actor, authorize the action/resource, and use
 * scoped database queries inside operation. This helper is not authentication.
 * Only database work belongs in operation: no HTTP, logging of private data,
 * streaming, or other effects that cannot be rolled back.
 *
 * Return values become available only after the outbox write commits. This also
 * provides the fail-closed capture boundary for an authorized contact read.
 * Duplicate event IDs reject the transaction; this is not mutation idempotency.
 */
export async function withPersonalAuditTransaction<T>(
  db: PrismaClient,
  authenticatedActorId: string,
  input: unknown,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const result = validateAuditEventIntent(input);
  if (!result.success) throw new AuditCaptureError();
  const intent = result.data;
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (
    intent.actorUserId !== authenticatedActorId ||
    intent.outcome !== "succeeded" ||
    intent.workspaceType !== "individual" ||
    (intent.targetUserId !== undefined &&
      intent.targetUserId !== authenticatedActorId) ||
    ![intent.eventId, intent.actorUserId, intent.workspaceId].every((id) =>
      uuid.test(id),
    )
  )
    throw new AuditCaptureError();

  return db.$transaction(async (tx) => {
    const workspace = await tx.workspace.findFirst({
      where: {
        id: intent.workspaceId,
        type: "individual",
        personalOwnerUserId: authenticatedActorId,
      },
      select: { id: true },
    });
    if (!workspace) throw new AuditCaptureError();
    const value = await operation(tx);
    // Persist only the normalized allowlisted contract, never the original input.
    // Capture needs INSERT only; do not RETURN private queue rows to producers.
    await tx.auditOutbox.createMany({
      data: {
        eventId: intent.eventId,
        payload: { ...intent, metadata: { ...intent.metadata } },
      },
    });
    return value;
  });
}
