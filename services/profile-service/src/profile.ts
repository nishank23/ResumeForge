import { randomUUID } from "node:crypto";
import { z } from "zod";
import { authorizePersonalProfileAction } from "@resume-forge/access-policy";
import {
  resolvedActorSchema,
  type ResolvedActor,
} from "@resume-forge/access-policy/server";
import {
  validateAuditEventIntent,
  type AuditEventIntent,
} from "@resume-forge/audit-contracts";
import {
  withPersonalAuditTransaction,
  type createDatabaseClient,
} from "@resume-forge/prisma-client";
import type { ProfessionalProfileDto } from "@resume-forge/shared-types";
import {
  ProfileError,
  profileUpdateSchema,
  professionalProfileSchema,
} from "./contracts.js";

type Database = ReturnType<typeof createDatabaseClient>;
type Context = {
  actor: ResolvedActor;
  selectedWorkspaceId?: string;
  correlationId: string;
};
const projection = {
  id: true,
  fullName: true,
  location: true,
  professionalSummary: true,
  revision: true,
} as const;

/** Server composition supplies a freshly verified actor; context from request bodies is never accepted. */
export function createProfileUseCases(db: Database, now = Date.now) {
  function assertContext(context: Context) {
    if (
      !resolvedActorSchema.safeParse(context.actor).success ||
      context.actor.expiresAt <= now()
    )
      throw new ProfileError("unauthenticated");
    if (!z.string().uuid().safeParse(context.correlationId).success)
      throw new ProfileError("invalid_input");
  }
  function event(
    context: Context,
    action: AuditEventIntent["action"],
    resourceId: string,
  ): AuditEventIntent {
    return {
      eventId: randomUUID(),
      action,
      actorUserId: context.actor.userId,
      targetUserId: context.actor.userId,
      workspaceType: "individual",
      workspaceId: context.actor.personalWorkspaceId,
      resourceType: "profile",
      resourceId,
      outcome: "succeeded",
      occurredAt: new Date(now()).toISOString(),
      correlationId: context.correlationId,
      metadata: {},
    };
  }
  async function authorize(
    context: Context,
    permission: "profile.read" | "profile.update",
  ) {
    assertContext(context);
    const workspace = await db.workspace.findFirst({
      where: {
        id: context.actor.personalWorkspaceId,
        type: "individual",
        personalOwnerUserId: context.actor.userId,
      },
      select: { id: true, type: true, personalOwnerUserId: true },
    });
    if (!workspace?.personalOwnerUserId) throw new ProfileError("forbidden");
    const decision = authorizePersonalProfileAction({
      permission,
      actorUserId: context.actor.userId,
      workspace: {
        ...workspace,
        personalOwnerUserId: workspace.personalOwnerUserId,
      },
      clientSelectedWorkspaceId: context.selectedWorkspaceId,
    });
    if (!decision.allowed) {
      // Record the denial in the actor's authoritative workspace; never copy a forged selector.
      const intent = validateAuditEventIntent({
        ...event(context, "authorization.denied", workspace.id),
        resourceType: "workspace",
        outcome: "denied",
        metadata: { permission, reasonCode: decision.code },
      });
      if (!intent.success) throw new Error("Profile audit unavailable");
      await db.$transaction(async (tx) => {
        assertContext(context);
        const owned = await tx.workspace.findFirst({
          where: {
            id: workspace.id,
            type: "individual",
            personalOwnerUserId: context.actor.userId,
          },
          select: { id: true },
        });
        if (!owned) throw new ProfileError("forbidden");
        await tx.auditOutbox.createMany({
          data: {
            eventId: intent.data.eventId,
            payload: { ...intent.data, metadata: { ...intent.data.metadata } },
          },
        });
      });
      throw new ProfileError("forbidden");
    }
    // Master profiles are user-owned (not workspace copies); scope has been verified above.
    const profile = await db.userProfile.findFirst({
      where: { userId: context.actor.userId },
      select: { id: true, userId: true },
    });
    if (!profile) throw new ProfileError("not_found");
    const resource = authorizePersonalProfileAction({
      permission,
      actorUserId: context.actor.userId,
      workspace: {
        ...workspace,
        personalOwnerUserId: workspace.personalOwnerUserId,
      },
      resource: {
        id: profile.id,
        ownerUserId: profile.userId,
        workspaceId: workspace.id,
      },
    });
    if (!resource.allowed) throw new ProfileError("forbidden");
    return profile.id;
  }
  async function execute(
    context: Context,
    input?: unknown,
  ): Promise<ProfessionalProfileDto> {
    const writing = input !== undefined;
    const parsed = writing ? profileUpdateSchema.safeParse(input) : undefined;
    assertContext(context);
    if (parsed && !parsed.success) throw new ProfileError("invalid_input");
    const id = await authorize(
      context,
      writing ? "profile.update" : "profile.read",
    );
    return withPersonalAuditTransaction(
      db,
      context.actor.userId,
      event(context, writing ? "profile.updated" : "profile.viewed", id),
      async (tx) => {
        assertContext(context);
        const where = { id, userId: context.actor.userId };
        if (parsed?.success) {
          const { expectedRevision, ...fields } = parsed.data;
          const updated = await tx.userProfile.updateMany({
            where: { ...where, revision: expectedRevision },
            data: { ...fields, revision: { increment: 1 } },
          });
          if (updated.count !== 1) throw new ProfileError("revision_conflict");
        }
        const profile = await tx.userProfile.findFirst({
          where,
          select: projection,
        });
        if (!profile) throw new ProfileError("not_found");
        assertContext(context);
        // No ORM model, contact relation, embedding, grant or auth identity is serialized.
        return professionalProfileSchema.parse(profile);
      },
    );
  }
  return {
    read: (context: Context) => execute(context),
    update: (context: Context, input: unknown) => {
      if (input === undefined) throw new ProfileError("invalid_input");
      return execute(context, input);
    },
  };
}
