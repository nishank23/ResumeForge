import { randomUUID } from "node:crypto";
import { type createDatabaseClient } from "@resume-forge/prisma-client";
import {
  type CreateWorkspaceInput,
  type UpdateWorkspaceInput,
  type InviteMemberInput,
  type UpdateMemberInput,
  type CreateGrantInput,
  type AuditEventsQuery,
  type WorkspaceDto,
  type WorkspaceMemberDto,
  type WorkspaceGrantDto,
  type WorkspaceContextDto,
  type AuditEventItemDto,
  type AuditEventsResponseDto,
  type ResolvedActor,
  type WorkspaceRole,
  type WorkspaceType,
  WorkspaceError,
} from "./contracts.js";
import { resolveWorkspacePermissions, hasPermission } from "./rbac.js";

type Database = ReturnType<typeof createDatabaseClient>;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface AuditRecordOptions {
  actorUserId: string;
  workspaceType: WorkspaceType;
  workspaceId: string;
  targetUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}

async function recordAuditEventAndOutbox(
  tx: Parameters<Parameters<Database["$transaction"]>[0]>[0],
  options: AuditRecordOptions,
) {
  const eventId = randomUUID();
  const now = new Date();
  const metadata = options.metadata ?? {};

  await tx.auditEvent.create({
    data: {
      id: eventId,
      actorUserId: options.actorUserId,
      workspaceType: options.workspaceType,
      workspaceId: options.workspaceId,
      targetUserId: options.targetUserId ?? null,
      action: options.action,
      resourceType: options.resourceType,
      resourceId: options.resourceId ?? null,
      metadata: JSON.parse(JSON.stringify(metadata)),
      outcome: "succeeded",
      correlationId: options.correlationId ?? null,
      timestamp: now,
    },
  });

  await tx.auditOutbox.createMany({
    data: [
      {
        eventId,
        payload: JSON.parse(
          JSON.stringify({
            eventId,
            actorUserId: options.actorUserId,
            workspaceType: options.workspaceType,
            workspaceId: options.workspaceId,
            targetUserId: options.targetUserId ?? undefined,
            action: options.action,
            resourceType: options.resourceType,
            resourceId: options.resourceId ?? undefined,
            outcome: "succeeded",
            occurredAt: now.toISOString(),
            correlationId: options.correlationId ?? randomUUID(),
            metadata,
          }),
        ),
      },
    ],
    skipDuplicates: true,
  });
}

export function createWorkspaceUseCases(db: Database) {
  return {
    // ── Create Organization or Vendor Workspace ─────────────────────────────
    async createWorkspace(
      actor: ResolvedActor,
      input: CreateWorkspaceInput,
      correlationId?: string,
    ): Promise<WorkspaceDto> {
      const baseSlug = input.slug ? slugify(input.slug) : slugify(input.name);

      return db.$transaction(async (tx) => {
        // Find available unique slug
        let candidateSlug = baseSlug || "workspace";
        let count = 0;
        while (count < 20) {
          const existing =
            input.type === "organization"
              ? await tx.organization.findUnique({ where: { slug: candidateSlug } })
              : await tx.vendor.findUnique({ where: { slug: candidateSlug } });
          if (!existing) break;
          count++;
          candidateSlug = `${baseSlug}-${count}`;
        }

        const workspace = await tx.workspace.create({
          data: {
            type: input.type,
          },
        });

        let orgOrVendorName = input.name;
        let logoUrl: string | null = input.logoUrl ?? null;
        let settings: Record<string, unknown> | null =
          (input.settings as Record<string, unknown>) ?? null;

        if (input.type === "organization") {
          const org = await tx.organization.create({
            data: {
              workspaceId: workspace.id,
              name: input.name,
              slug: candidateSlug,
              logoUrl: input.logoUrl ?? null,
              settings: input.settings ? JSON.parse(JSON.stringify(input.settings)) : undefined,
            },
          });
          orgOrVendorName = org.name;
          logoUrl = org.logoUrl;
          settings = org.settings as Record<string, unknown> | null;
        } else {
          const vendor = await tx.vendor.create({
            data: {
              workspaceId: workspace.id,
              name: input.name,
              slug: candidateSlug,
              logoUrl: input.logoUrl ?? null,
              settings: input.settings ? JSON.parse(JSON.stringify(input.settings)) : undefined,
            },
          });
          orgOrVendorName = vendor.name;
          logoUrl = vendor.logoUrl;
          settings = vendor.settings as Record<string, unknown> | null;
        }

        // Creator becomes the initial Owner of the organization or vendor
        await tx.workspaceMembership.create({
          data: {
            workspaceId: workspace.id,
            userId: actor.userId,
            role: "owner",
            status: "active",
          },
        });

        // Audit the creation
        await recordAuditEventAndOutbox(tx, {
          actorUserId: actor.userId,
          workspaceType: input.type,
          workspaceId: workspace.id,
          action: "member.role_changed",
          resourceType: "workspace",
          resourceId: workspace.id,
          metadata: {
            role: "owner",
            status: "active",
            workspaceType: input.type,
          },
          correlationId,
        });

        return {
          id: workspace.id,
          type: input.type,
          name: orgOrVendorName,
          slug: candidateSlug,
          logoUrl,
          personalOwnerUserId: null,
          role: "owner",
          status: "active",
          memberCount: 1,
          settings,
          createdAt: workspace.createdAt.toISOString(),
          updatedAt: workspace.updatedAt.toISOString(),
        };
      });
    },

    // ── List Workspaces for Actor ───────────────────────────────────────────
    async listWorkspaces(actor: ResolvedActor): Promise<WorkspaceDto[]> {
      const results: WorkspaceDto[] = [];

      // 1. Personal Workspace
      const personal = await db.workspace.findFirst({
        where: {
          personalOwnerUserId: actor.userId,
          type: "individual",
        },
      });

      if (personal) {
        results.push({
          id: personal.id,
          type: "individual",
          name: "Personal Workspace",
          slug: null,
          logoUrl: null,
          personalOwnerUserId: actor.userId,
          role: "owner",
          status: "active",
          memberCount: 1,
          createdAt: personal.createdAt.toISOString(),
          updatedAt: personal.updatedAt.toISOString(),
        });
      }

      // 2. Organization and Vendor Workspaces with active/invited memberships
      const memberships = await db.workspaceMembership.findMany({
        where: {
          userId: actor.userId,
          status: { in: ["active", "invited"] },
        },
        include: {
          workspace: {
            include: {
              organization: true,
              vendor: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      for (const m of memberships) {
        const ws = m.workspace;
        const name =
          ws.organization?.name ?? ws.vendor?.name ?? "Shared Workspace";
        const slug = ws.organization?.slug ?? ws.vendor?.slug ?? null;
        const logoUrl = ws.organization?.logoUrl ?? ws.vendor?.logoUrl ?? null;
        const settings = (ws.organization?.settings ??
          ws.vendor?.settings ??
          null) as Record<string, unknown> | null;

        results.push({
          id: ws.id,
          type: ws.type as WorkspaceType,
          name,
          slug,
          logoUrl,
          personalOwnerUserId: ws.personalOwnerUserId,
          role: m.role as WorkspaceRole,
          status: m.status as "active" | "invited",
          settings,
          createdAt: ws.createdAt.toISOString(),
          updatedAt: ws.updatedAt.toISOString(),
        });
      }

      return results;
    },

    // ── Get Workspace Details ───────────────────────────────────────────────
    async getWorkspace(actor: ResolvedActor, workspaceId: string): Promise<WorkspaceDto> {
      const ws = await db.workspace.findUnique({
        where: { id: workspaceId },
        include: {
          organization: true,
          vendor: true,
        },
      });

      if (!ws) {
        throw new WorkspaceError("workspace_not_found", "Workspace not found", 404);
      }

      if (ws.type === "individual") {
        if (ws.personalOwnerUserId !== actor.userId) {
          throw new WorkspaceError("forbidden", "Access denied to personal workspace", 403);
        }
        return {
          id: ws.id,
          type: "individual",
          name: "Personal Workspace",
          slug: null,
          logoUrl: null,
          personalOwnerUserId: actor.userId,
          role: "owner",
          status: "active",
          memberCount: 1,
          createdAt: ws.createdAt.toISOString(),
          updatedAt: ws.updatedAt.toISOString(),
        };
      }

      // Org or Vendor: check membership
      const membership = await db.workspaceMembership.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: actor.userId,
          },
        },
      });

      if (!membership || membership.status === "suspended") {
        throw new WorkspaceError("forbidden", "Not an active member of this workspace", 403);
      }

      const memberCount = await db.workspaceMembership.count({
        where: { workspaceId, status: "active" },
      });

      const name = ws.organization?.name ?? ws.vendor?.name ?? "Shared Workspace";
      const slug = ws.organization?.slug ?? ws.vendor?.slug ?? null;
      const logoUrl = ws.organization?.logoUrl ?? ws.vendor?.logoUrl ?? null;
      const settings = (ws.organization?.settings ??
        ws.vendor?.settings ??
        null) as Record<string, unknown> | null;

      return {
        id: ws.id,
        type: ws.type as WorkspaceType,
        name,
        slug,
        logoUrl,
        personalOwnerUserId: null,
        role: membership.role as WorkspaceRole,
        status: membership.status as "active" | "invited",
        memberCount,
        settings,
        createdAt: ws.createdAt.toISOString(),
        updatedAt: ws.updatedAt.toISOString(),
      };
    },

    // ── Update Workspace Settings ───────────────────────────────────────────
    async updateWorkspace(
      actor: ResolvedActor,
      workspaceId: string,
      input: UpdateWorkspaceInput,
      correlationId?: string,
    ): Promise<WorkspaceDto> {
      const ws = await db.workspace.findUnique({
        where: { id: workspaceId },
        include: { organization: true, vendor: true },
      });

      if (!ws) {
        throw new WorkspaceError("workspace_not_found", "Workspace not found", 404);
      }

      if (ws.type === "individual") {
        if (ws.personalOwnerUserId !== actor.userId) {
          throw new WorkspaceError("forbidden", "Access denied", 403);
        }
        return {
          id: ws.id,
          type: "individual",
          name: "Personal Workspace",
          role: "owner",
          status: "active",
          createdAt: ws.createdAt.toISOString(),
          updatedAt: ws.updatedAt.toISOString(),
        };
      }

      // Check role
      const membership = await db.workspaceMembership.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: actor.userId } },
      });

      if (
        !membership ||
        membership.status !== "active" ||
        (membership.role !== "owner" && membership.role !== "admin")
      ) {
        throw new WorkspaceError(
          "forbidden",
          "Requires workspace.settings.manage permission",
          403,
        );
      }

      return db.$transaction(async (tx) => {
        let name = ws.organization?.name ?? ws.vendor?.name ?? "";
        let logoUrl = ws.organization?.logoUrl ?? ws.vendor?.logoUrl ?? null;
        let settings = (ws.organization?.settings ??
          ws.vendor?.settings ??
          null) as Record<string, unknown> | null;

        if (ws.type === "organization" && ws.organization) {
          const updated = await tx.organization.update({
            where: { workspaceId },
            data: {
              name: input.name ?? undefined,
              logoUrl: input.logoUrl !== undefined ? input.logoUrl : undefined,
              settings: input.settings ? JSON.parse(JSON.stringify(input.settings)) : undefined,
            },
          });
          name = updated.name;
          logoUrl = updated.logoUrl;
          settings = updated.settings as Record<string, unknown> | null;
        } else if (ws.type === "vendor" && ws.vendor) {
          const updated = await tx.vendor.update({
            where: { workspaceId },
            data: {
              name: input.name ?? undefined,
              logoUrl: input.logoUrl !== undefined ? input.logoUrl : undefined,
              settings: input.settings ? JSON.parse(JSON.stringify(input.settings)) : undefined,
            },
          });
          name = updated.name;
          logoUrl = updated.logoUrl;
          settings = updated.settings as Record<string, unknown> | null;
        }

        await recordAuditEventAndOutbox(tx, {
          actorUserId: actor.userId,
          workspaceType: ws.type as WorkspaceType,
          workspaceId: ws.id,
          action: "workspace.settings_updated",
          resourceType: "workspace",
          resourceId: ws.id,
          metadata: {
            updatedFields: Object.keys(input),
          },
          correlationId,
        });

        return {
          id: ws.id,
          type: ws.type as WorkspaceType,
          name,
          slug: ws.organization?.slug ?? ws.vendor?.slug ?? null,
          logoUrl,
          role: membership.role as WorkspaceRole,
          status: "active",
          settings,
          createdAt: ws.createdAt.toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });
    },

    // ── Switch Workspace Context / Resolve Active Permissions ───────────────
    async switchContext(actor: ResolvedActor, workspaceId: string): Promise<WorkspaceContextDto> {
      const ws = await db.workspace.findUnique({
        where: { id: workspaceId },
        include: { organization: true, vendor: true },
      });

      if (!ws) {
        throw new WorkspaceError("workspace_not_found", "Workspace not found", 404);
      }

      if (ws.type === "individual") {
        if (ws.personalOwnerUserId !== actor.userId) {
          throw new WorkspaceError("forbidden", "Access denied to personal workspace", 403);
        }
        const permissions = resolveWorkspacePermissions("individual", "owner");
        return {
          workspaceId: ws.id,
          type: "individual",
          name: "Personal Workspace",
          slug: null,
          role: "owner",
          status: "active",
          permissions,
        };
      }

      const membership = await db.workspaceMembership.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: actor.userId } },
      });

      if (!membership || membership.status !== "active") {
        throw new WorkspaceError("forbidden", "Not an active member of this workspace", 403);
      }

      const permissions = resolveWorkspacePermissions(
        ws.type as WorkspaceType,
        membership.role as WorkspaceRole,
      );

      return {
        workspaceId: ws.id,
        type: ws.type as WorkspaceType,
        name: ws.organization?.name ?? ws.vendor?.name ?? "Shared Workspace",
        slug: ws.organization?.slug ?? ws.vendor?.slug ?? null,
        role: membership.role as WorkspaceRole,
        status: "active",
        permissions,
      };
    },

    // ── Member Management ───────────────────────────────────────────────────
    async listMembers(actor: ResolvedActor, workspaceId: string): Promise<WorkspaceMemberDto[]> {
      const ws = await db.workspace.findUnique({
        where: { id: workspaceId },
      });

      if (!ws) {
        throw new WorkspaceError("workspace_not_found", "Workspace not found", 404);
      }

      // Check caller's role in this workspace
      let callerRole: WorkspaceRole = "member";
      if (ws.type === "individual") {
        if (ws.personalOwnerUserId !== actor.userId) {
          throw new WorkspaceError("forbidden", "Access denied", 403);
        }
        callerRole = "owner";
      } else {
        const membership = await db.workspaceMembership.findUnique({
          where: { workspaceId_userId: { workspaceId, userId: actor.userId } },
        });
        if (!membership || membership.status === "suspended") {
          throw new WorkspaceError("forbidden", "Access denied", 403);
        }
        callerRole = membership.role as WorkspaceRole;
      }

      const permissions = resolveWorkspacePermissions(ws.type as WorkspaceType, callerRole);
      if (!hasPermission(permissions, "workspace.members.view")) {
        throw new WorkspaceError("forbidden", "Requires workspace.members.view permission", 403);
      }

      const canReadContact = hasPermission(permissions, "profile.contact.read");

      const members = await db.workspaceMembership.findMany({
        where: { workspaceId },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      return members.map((m) => {
        // Field privacy: Sanitize or omit email if contact access is denied
        const sanitizedEmail =
          canReadContact || ws.type !== "vendor" ? m.user.email : null;

        return {
          id: m.id,
          workspaceId: m.workspaceId,
          userId: m.userId,
          role: m.role as WorkspaceRole,
          status: m.status as "active" | "invited" | "suspended",
          user: {
            id: m.user.id,
            name: m.user.name,
            email: sanitizedEmail,
          },
          createdAt: m.createdAt.toISOString(),
          updatedAt: m.updatedAt.toISOString(),
        };
      });
    },

    async inviteMember(
      actor: ResolvedActor,
      workspaceId: string,
      input: InviteMemberInput,
      correlationId?: string,
    ): Promise<WorkspaceMemberDto> {
      const ws = await db.workspace.findUnique({ where: { id: workspaceId } });
      if (!ws || ws.type === "individual") {
        throw new WorkspaceError(
          "invalid_workspace",
          "Cannot invite members to personal workspace",
          400,
        );
      }

      const callerMembership = await db.workspaceMembership.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: actor.userId } },
      });

      if (
        !callerMembership ||
        callerMembership.status !== "active" ||
        (callerMembership.role !== "owner" && callerMembership.role !== "admin")
      ) {
        throw new WorkspaceError(
          "forbidden",
          "Requires user.invite or workspace.members.manage permission",
          403,
        );
      }

      return db.$transaction(async (tx) => {
        // Find target user
        let targetUser: { id: string; name: string | null; email: string } | null = null;
        if (input.userId) {
          targetUser = await tx.user.findUnique({
            where: { id: input.userId },
            select: { id: true, name: true, email: true },
          });
          if (!targetUser) {
            throw new WorkspaceError("user_not_found", "User not found by ID", 404);
          }
        } else if (input.email) {
          targetUser = await tx.user.findUnique({
            where: { email: input.email.toLowerCase() },
            select: { id: true, name: true, email: true },
          });
          if (!targetUser) {
            // Create user placeholder for invitation
            targetUser = await tx.user.create({
              data: {
                email: input.email.toLowerCase(),
                name: input.email.split("@")[0],
              },
              select: { id: true, name: true, email: true },
            });
          }
        }

        if (!targetUser) {
          throw new WorkspaceError("user_not_found", "Target user could not be resolved", 400);
        }

        const existingMembership = await tx.workspaceMembership.findUnique({
          where: {
            workspaceId_userId: {
              workspaceId,
              userId: targetUser.id,
            },
          },
        });

        if (existingMembership) {
          if (existingMembership.status === "active") {
            throw new WorkspaceError(
              "already_member",
              "User is already an active member of this workspace",
              409,
            );
          }
          // Reactivate or update role
          const updated = await tx.workspaceMembership.update({
            where: { id: existingMembership.id },
            data: {
              role: input.role,
              status: "active",
            },
          });

          await recordAuditEventAndOutbox(tx, {
            actorUserId: actor.userId,
            workspaceType: ws.type as WorkspaceType,
            workspaceId,
            targetUserId: targetUser.id,
            action: "member.invited",
            resourceType: "workspace_membership",
            resourceId: updated.id,
            metadata: { role: input.role, status: "active" },
            correlationId,
          });

          return {
            id: updated.id,
            workspaceId,
            userId: targetUser.id,
            role: updated.role as WorkspaceRole,
            status: "active",
            user: targetUser,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
          };
        }

        const created = await tx.workspaceMembership.create({
          data: {
            workspaceId,
            userId: targetUser.id,
            role: input.role,
            status: "active",
          },
        });

        await recordAuditEventAndOutbox(tx, {
          actorUserId: actor.userId,
          workspaceType: ws.type as WorkspaceType,
          workspaceId,
          targetUserId: targetUser.id,
          action: "member.invited",
          resourceType: "workspace_membership",
          resourceId: created.id,
          metadata: { role: input.role, status: "active" },
          correlationId,
        });

        return {
          id: created.id,
          workspaceId,
          userId: targetUser.id,
          role: created.role as WorkspaceRole,
          status: "active",
          user: targetUser,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        };
      });
    },

    async updateMember(
      actor: ResolvedActor,
      workspaceId: string,
      memberOrUserId: string,
      input: UpdateMemberInput,
      correlationId?: string,
    ): Promise<WorkspaceMemberDto> {
      const ws = await db.workspace.findUnique({ where: { id: workspaceId } });
      if (!ws || ws.type === "individual") {
        throw new WorkspaceError("invalid_workspace", "Invalid workspace operation", 400);
      }

      const callerMembership = await db.workspaceMembership.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: actor.userId } },
      });

      if (
        !callerMembership ||
        callerMembership.status !== "active" ||
        (callerMembership.role !== "owner" && callerMembership.role !== "admin")
      ) {
        throw new WorkspaceError("forbidden", "Requires workspace.members.manage permission", 403);
      }

      return db.$transaction(async (tx) => {
        // Find target by membership id or userId
        const target = await tx.workspaceMembership.findFirst({
          where: {
            workspaceId,
            OR: [{ id: memberOrUserId }, { userId: memberOrUserId }],
          },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        });

        if (!target) {
          throw new WorkspaceError("member_not_found", "Workspace member not found", 404);
        }

        // Admin restrictions:
        if (callerMembership.role === "admin") {
          if (target.role === "owner") {
            throw new WorkspaceError("forbidden", "Admins cannot modify owner memberships", 403);
          }
          if (input.role === "owner") {
            throw new WorkspaceError("forbidden", "Only owners can promote members to owner", 403);
          }
        }

        // ── Last-Owner Protection ──────────────────────────────────────────
        // If target is owner and role is changed away from owner, or status is set to suspended
        const isDemotingOrSuspendingOwner =
          target.role === "owner" &&
          ((input.role !== undefined && input.role !== "owner") ||
            input.status === "suspended");

        if (isDemotingOrSuspendingOwner) {
          const activeOwnerCount = await tx.workspaceMembership.count({
            where: {
              workspaceId,
              role: "owner",
              status: "active",
            },
          });

          if (activeOwnerCount <= 1) {
            throw new WorkspaceError(
              "last_owner_protection",
              "Cannot demote or suspend the last active owner of the workspace",
              409,
            );
          }
        }

        const updated = await tx.workspaceMembership.update({
          where: { id: target.id },
          data: {
            role: input.role ?? undefined,
            status: input.status ?? undefined,
          },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        });

        const action =
          input.status === "suspended" ? "member.suspended" : "member.role_changed";

        await recordAuditEventAndOutbox(tx, {
          actorUserId: actor.userId,
          workspaceType: ws.type as WorkspaceType,
          workspaceId,
          targetUserId: target.userId,
          action,
          resourceType: "workspace_membership",
          resourceId: target.id,
          metadata: {
            previousRole: target.role,
            newRole: updated.role,
            previousStatus: target.status,
            newStatus: updated.status,
          },
          correlationId,
        });

        return {
          id: updated.id,
          workspaceId,
          userId: target.userId,
          role: updated.role as WorkspaceRole,
          status: updated.status as "active" | "invited" | "suspended",
          user: updated.user,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        };
      });
    },

    async removeMember(
      actor: ResolvedActor,
      workspaceId: string,
      memberOrUserId: string,
      correlationId?: string,
    ): Promise<{ removed: true; id: string }> {
      const ws = await db.workspace.findUnique({ where: { id: workspaceId } });
      if (!ws || ws.type === "individual") {
        throw new WorkspaceError("invalid_workspace", "Invalid workspace operation", 400);
      }

      const callerMembership = await db.workspaceMembership.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: actor.userId } },
      });

      return db.$transaction(async (tx) => {
        const target = await tx.workspaceMembership.findFirst({
          where: {
            workspaceId,
            OR: [{ id: memberOrUserId }, { userId: memberOrUserId }],
          },
        });

        if (!target) {
          throw new WorkspaceError("member_not_found", "Workspace member not found", 404);
        }

        const isSelfDeparture = target.userId === actor.userId;

        if (!isSelfDeparture) {
          if (
            !callerMembership ||
            callerMembership.status !== "active" ||
            (callerMembership.role !== "owner" && callerMembership.role !== "admin")
          ) {
            throw new WorkspaceError("forbidden", "Requires user.remove permission", 403);
          }

          if (callerMembership.role === "admin" && target.role === "owner") {
            throw new WorkspaceError("forbidden", "Admins cannot remove owners", 403);
          }
        }

        // ── Last-Owner Protection ──────────────────────────────────────────
        if (target.role === "owner") {
          const activeOwnerCount = await tx.workspaceMembership.count({
            where: {
              workspaceId,
              role: "owner",
              status: "active",
            },
          });

          if (activeOwnerCount <= 1) {
            throw new WorkspaceError(
              "last_owner_protection",
              "Cannot remove the last active owner of the workspace",
              409,
            );
          }
        }

        await tx.workspaceMembership.delete({
          where: { id: target.id },
        });

        await recordAuditEventAndOutbox(tx, {
          actorUserId: actor.userId,
          workspaceType: ws.type as WorkspaceType,
          workspaceId,
          targetUserId: target.userId,
          action: "member.removed",
          resourceType: "workspace_membership",
          resourceId: target.id,
          metadata: {
            role: target.role,
            isSelfDeparture,
          },
          correlationId,
        });

        return { removed: true, id: target.id };
      });
    },

    // ── Profile-Workspace Grants (D03) ──────────────────────────────────────
    async createGrant(
      actor: ResolvedActor,
      workspaceId: string,
      input: CreateGrantInput,
      correlationId?: string,
    ): Promise<WorkspaceGrantDto> {
      // Caller must own the profile
      const profile = await db.userProfile.findUnique({
        where: { id: input.profileId },
      });

      if (!profile || profile.userId !== actor.userId) {
        throw new WorkspaceError(
          "forbidden",
          "Only the profile owner can grant workspace access",
          403,
        );
      }

      const ws = await db.workspace.findUnique({ where: { id: workspaceId } });
      if (!ws) {
        throw new WorkspaceError("workspace_not_found", "Workspace not found", 404);
      }

      return db.$transaction(async (tx) => {
        const grant = await tx.profileWorkspaceGrant.upsert({
          where: {
            profileId_workspaceId: {
              profileId: input.profileId,
              workspaceId,
            },
          },
          update: {
            canReadProfile: input.canReadProfile,
            canWriteProfile: input.canWriteProfile,
            canReadContact: input.canReadContact,
            grantedByUserId: actor.userId,
            revokedAt: null,
          },
          create: {
            profileId: input.profileId,
            workspaceId,
            grantedByUserId: actor.userId,
            canReadProfile: input.canReadProfile,
            canWriteProfile: input.canWriteProfile,
            canReadContact: input.canReadContact,
          },
        });

        await recordAuditEventAndOutbox(tx, {
          actorUserId: actor.userId,
          workspaceType: ws.type as WorkspaceType,
          workspaceId,
          targetUserId: actor.userId,
          action: "profile.access_granted",
          resourceType: "profile_workspace_grant",
          resourceId: grant.id,
          metadata: {
            profileId: input.profileId,
            canReadProfile: grant.canReadProfile,
            canWriteProfile: grant.canWriteProfile,
            canReadContact: grant.canReadContact,
          },
          correlationId,
        });

        return {
          id: grant.id,
          profileId: grant.profileId,
          workspaceId: grant.workspaceId,
          grantedByUserId: grant.grantedByUserId,
          canReadProfile: grant.canReadProfile,
          canWriteProfile: grant.canWriteProfile,
          canReadContact: grant.canReadContact,
          createdAt: grant.createdAt.toISOString(),
          revokedAt: grant.revokedAt ? grant.revokedAt.toISOString() : null,
        };
      });
    },

    async listGrants(actor: ResolvedActor, workspaceId: string): Promise<WorkspaceGrantDto[]> {
      const ws = await db.workspace.findUnique({ where: { id: workspaceId } });
      if (!ws) {
        throw new WorkspaceError("workspace_not_found", "Workspace not found", 404);
      }

      if (ws.type === "individual") {
        if (ws.personalOwnerUserId !== actor.userId) {
          throw new WorkspaceError("forbidden", "Access denied", 403);
        }
      } else {
        const membership = await db.workspaceMembership.findUnique({
          where: { workspaceId_userId: { workspaceId, userId: actor.userId } },
        });
        if (!membership || membership.status === "suspended") {
          throw new WorkspaceError("forbidden", "Access denied", 403);
        }
      }

      const grants = await db.profileWorkspaceGrant.findMany({
        where: {
          workspaceId,
          revokedAt: null,
        },
        orderBy: { createdAt: "desc" },
      });

      return grants.map((g) => ({
        id: g.id,
        profileId: g.profileId,
        workspaceId: g.workspaceId,
        grantedByUserId: g.grantedByUserId,
        canReadProfile: g.canReadProfile,
        canWriteProfile: g.canWriteProfile,
        canReadContact: g.canReadContact,
        createdAt: g.createdAt.toISOString(),
        revokedAt: null,
      }));
    },

    async revokeGrant(
      actor: ResolvedActor,
      workspaceId: string,
      grantId: string,
      correlationId?: string,
    ): Promise<{ revoked: true; id: string }> {
      const grant = await db.profileWorkspaceGrant.findUnique({
        where: { id: grantId },
        include: { profile: true },
      });

      if (!grant || grant.workspaceId !== workspaceId) {
        throw new WorkspaceError("grant_not_found", "Grant not found", 404);
      }

      // Check caller authority: must be profile owner or workspace owner/admin
      const isProfileOwner = grant.profile.userId === actor.userId;
      let isWorkspaceAdmin = false;

      const ws = await db.workspace.findUnique({ where: { id: workspaceId } });
      if (ws?.type === "individual") {
        isWorkspaceAdmin = ws.personalOwnerUserId === actor.userId;
      } else if (ws) {
        const mem = await db.workspaceMembership.findUnique({
          where: { workspaceId_userId: { workspaceId, userId: actor.userId } },
        });
        isWorkspaceAdmin =
          mem?.status === "active" && (mem.role === "owner" || mem.role === "admin");
      }

      if (!isProfileOwner && !isWorkspaceAdmin) {
        throw new WorkspaceError("forbidden", "Access denied to revoke grant", 403);
      }

      return db.$transaction(async (tx) => {
        const revoked = await tx.profileWorkspaceGrant.update({
          where: { id: grantId },
          data: { revokedAt: new Date() },
        });

        await recordAuditEventAndOutbox(tx, {
          actorUserId: actor.userId,
          workspaceType: ws?.type as WorkspaceType,
          workspaceId,
          targetUserId: grant.profile.userId,
          action: "profile.access_revoked",
          resourceType: "profile_workspace_grant",
          resourceId: grantId,
          metadata: { profileId: grant.profileId },
          correlationId,
        });

        return { revoked: true, id: revoked.id };
      });
    },

    // ── Audit Event Viewer (F15) ───────────────────────────────────────────
    async listAuditEvents(
      actor: ResolvedActor,
      workspaceId: string,
      query: AuditEventsQuery,
    ): Promise<AuditEventsResponseDto> {
      const ws = await db.workspace.findUnique({ where: { id: workspaceId } });
      if (!ws) {
        throw new WorkspaceError("workspace_not_found", "Workspace not found", 404);
      }

      // Check audit.view permission
      let hasAuditView = false;
      if (ws.type === "individual") {
        hasAuditView = ws.personalOwnerUserId === actor.userId;
      } else {
        const mem = await db.workspaceMembership.findUnique({
          where: { workspaceId_userId: { workspaceId, userId: actor.userId } },
        });
        if (mem && mem.status === "active") {
          const permissions = resolveWorkspacePermissions(
            ws.type as WorkspaceType,
            mem.role as WorkspaceRole,
          );
          hasAuditView = hasPermission(permissions, "audit.view");
        }
      }

      if (!hasAuditView) {
        throw new WorkspaceError("forbidden", "Requires audit.view permission", 403);
      }

      const limit = query.limit ?? 50;

      const whereClause: {
        workspaceId: string;
        action?: string;
        timestamp?: { lt: Date };
      } = { workspaceId };

      if (query.action) {
        whereClause.action = query.action;
      }

      if (query.cursor) {
        const cursorDate = new Date(query.cursor);
        if (!isNaN(cursorDate.getTime())) {
          whereClause.timestamp = { lt: cursorDate };
        }
      }

      const events = await db.auditEvent.findMany({
        where: whereClause,
        orderBy: { timestamp: "desc" },
        take: limit + 1,
      });

      const hasNext = events.length > limit;
      const items = hasNext ? events.slice(0, limit) : events;
      const nextCursor =
        hasNext && items.length > 0
          ? items[items.length - 1]?.timestamp.toISOString() ?? null
          : null;

      return {
        items: items.map((e) => ({
          id: e.id,
          actorUserId: e.actorUserId,
          workspaceType: e.workspaceType as WorkspaceType,
          workspaceId: e.workspaceId,
          targetUserId: e.targetUserId,
          action: e.action,
          resourceType: e.resourceType,
          resourceId: e.resourceId,
          metadata: (e.metadata as Record<string, unknown>) ?? null,
          outcome: e.outcome,
          correlationId: e.correlationId,
          timestamp: e.timestamp.toISOString(),
        })),
        nextCursor,
      };
    },
  };
}
