import { z } from "zod";

export const PERMISSION_NAMES = [
  "profile.read",
  "profile.create",
  "profile.update",
  "profile.delete",
  "profile.contact.read",
  "profile.contact.update",
  "resume.read",
  "resume.create",
  "resume.update",
  "resume.delete",
  "resume.generate",
  "resume.download",
  "ats.run",
  "ats.view",
  "skillgap.analyze",
  "coverletter.generate",
  "coverletter.read",
  "user.invite",
  "user.manage",
  "user.remove",
  "workspace.members.view",
  "workspace.members.manage",
  "workspace.settings.view",
  "workspace.settings.manage",
  "template.manage",
  "template.view",
  "audit.view",
] as const;

export type PermissionName = (typeof PERMISSION_NAMES)[number];

export const WORKSPACE_TYPES = ["individual", "organization", "vendor"] as const;
export type WorkspaceType = (typeof WORKSPACE_TYPES)[number];

export const WORKSPACE_ROLES = ["owner", "admin", "member"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const MEMBERSHIP_STATUSES = ["active", "invited", "suspended", "removed"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export interface ResolvedActor {
  readonly userId: string;
  readonly personalWorkspaceId: string;
  readonly expiresAt: number;
}

export class WorkspaceError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "WorkspaceError";
    this.code = code;
    this.status = status;
  }
}

// ── Validation Schemas ──────────────────────────────────────────────────

export const createWorkspaceSchema = z
  .object({
    type: z.enum(["organization", "vendor"]),
    name: z.string().min(1, "Name is required").max(100, "Name too long").trim(),
    slug: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase alphanumeric characters and hyphens")
      .optional(),
    logoUrl: z.string().url().max(500).optional(),
    settings: z.record(z.unknown()).optional(),
  })
  .strict();

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const updateWorkspaceSchema = z
  .object({
    name: z.string().min(1).max(100).trim().optional(),
    logoUrl: z.string().url().max(500).nullable().optional(),
    settings: z.record(z.unknown()).optional(),
  })
  .strict();

export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

export const inviteMemberSchema = z
  .object({
    email: z.string().email().optional(),
    userId: z.string().uuid().optional(),
    role: z.enum(["admin", "member"]).default("member"),
  })
  .strict()
  .refine((data) => data.email !== undefined || data.userId !== undefined, {
    message: "Either email or userId must be provided",
  });

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberSchema = z
  .object({
    role: z.enum(["owner", "admin", "member"]).optional(),
    status: z.enum(["active", "suspended"]).optional(),
  })
  .strict()
  .refine((data) => data.role !== undefined || data.status !== undefined, {
    message: "Either role or status must be provided",
  });

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export const createGrantSchema = z
  .object({
    profileId: z.string().uuid(),
    canReadProfile: z.boolean().default(true),
    canWriteProfile: z.boolean().default(false),
    canReadContact: z.boolean().default(false),
  })
  .strict();

export type CreateGrantInput = z.infer<typeof createGrantSchema>;

export const auditEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
  action: z.string().optional(),
});

export type AuditEventsQuery = z.infer<typeof auditEventsQuerySchema>;

// ── DTOs ───────────────────────────────────────────────────────────────

export interface WorkspaceDto {
  id: string;
  type: WorkspaceType;
  name: string;
  slug?: string | null;
  logoUrl?: string | null;
  personalOwnerUserId?: string | null;
  role: WorkspaceRole;
  status: MembershipStatus;
  memberCount?: number;
  settings?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMemberDto {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  status: MembershipStatus;
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceGrantDto {
  id: string;
  profileId: string;
  workspaceId: string;
  grantedByUserId: string;
  canReadProfile: boolean;
  canWriteProfile: boolean;
  canReadContact: boolean;
  createdAt: string;
  revokedAt: string | null;
}

export interface WorkspaceContextDto {
  workspaceId: string;
  type: WorkspaceType;
  name: string;
  slug?: string | null;
  role: WorkspaceRole;
  status: MembershipStatus;
  permissions: PermissionName[];
}

export interface AuditEventItemDto {
  id: string;
  actorUserId: string;
  workspaceType: WorkspaceType;
  workspaceId: string;
  targetUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  outcome?: string | null;
  correlationId?: string | null;
  timestamp: string;
}

export interface AuditEventsResponseDto {
  items: AuditEventItemDto[];
  nextCursor: string | null;
}
