import type { WorkspaceType } from "@resume-forge/shared-types";

/**
 * The approved capability vocabulary. Role bundles remain intentionally absent
 * until D05 is resolved; defining a permission does not activate a feature.
 */
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

export type PersonalScopeDenialCode =
  | "unauthenticated"
  | "invalid_scope"
  | "unsupported_workspace_type"
  | "personal_ownership_required"
  | "workspace_selector_mismatch"
  | "resource_scope_mismatch"
  | "resource_ownership_mismatch";

export interface PersonalWorkspaceIdentity {
  /** Authoritative workspace ID loaded by the server. */
  readonly id: string;
  readonly type: WorkspaceType;
  /** User ID recorded as the personal workspace owner. */
  readonly personalOwnerUserId: string;
}

export interface PersonalResourceIdentity {
  readonly id: string;
  /** Immutable scope recorded when the resource was created. */
  readonly workspaceId: string;
  /** Owning user for Phase 1 personal profile/resume resources. */
  readonly ownerUserId: string;
}

export interface PersonalScopeRequest {
  /** Authenticated server session actor. Missing actors are denied. */
  readonly actorUserId: string | null | undefined;
  /** Workspace loaded from the authoritative persistence layer. */
  readonly workspace: PersonalWorkspaceIdentity;
  /** Optional untrusted route/header selector supplied by the client. */
  readonly clientSelectedWorkspaceId?: string;
  /** Optional profile, contact, resume, version, or task parent identity. */
  readonly resource?: PersonalResourceIdentity;
}

export interface AuthorizedPersonalScope {
  readonly actorUserId: string;
  readonly workspaceId: string;
  readonly resourceId?: string;
}

export type PersonalScopeDecision =
  | {
      readonly allowed: true;
      readonly scope: AuthorizedPersonalScope;
    }
  | {
      readonly allowed: false;
      readonly code: PersonalScopeDenialCode;
    };

function hasIdentifier(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function deny(code: PersonalScopeDenialCode): PersonalScopeDecision {
  return { allowed: false, code };
}

/**
 * Establishes Phase 1 personal workspace/resource scope.
 *
 * This helper performs the ownership stage of authorization only. Callers must
 * still check the requested capability, project permitted fields, execute the
 * authorized use case, and capture the required audit event. A client selector
 * is compared with authoritative scope and can never grant or move access.
 */
export function authorizePersonalScope(
  request: PersonalScopeRequest,
): PersonalScopeDecision {
  if (!hasIdentifier(request.actorUserId)) {
    return deny("unauthenticated");
  }

  const { actorUserId, workspace, resource, clientSelectedWorkspaceId } =
    request;

  if (
    !hasIdentifier(workspace.id) ||
    !hasIdentifier(workspace.personalOwnerUserId) ||
    (clientSelectedWorkspaceId !== undefined &&
      !hasIdentifier(clientSelectedWorkspaceId))
  ) {
    return deny("invalid_scope");
  }

  if (workspace.type !== "individual") {
    return deny("unsupported_workspace_type");
  }

  if (workspace.personalOwnerUserId !== actorUserId) {
    return deny("personal_ownership_required");
  }

  if (
    clientSelectedWorkspaceId !== undefined &&
    clientSelectedWorkspaceId !== workspace.id
  ) {
    return deny("workspace_selector_mismatch");
  }

  if (resource !== undefined) {
    if (
      !hasIdentifier(resource.id) ||
      !hasIdentifier(resource.workspaceId) ||
      !hasIdentifier(resource.ownerUserId)
    ) {
      return deny("invalid_scope");
    }

    if (resource.workspaceId !== workspace.id) {
      return deny("resource_scope_mismatch");
    }

    if (resource.ownerUserId !== actorUserId) {
      return deny("resource_ownership_mismatch");
    }
  }

  return {
    allowed: true,
    scope: {
      actorUserId,
      workspaceId: workspace.id,
      ...(resource === undefined ? {} : { resourceId: resource.id }),
    },
  };
}

/** Activate only professional profile create/read/update in owned personal scope. */
export function authorizePersonalProfileAction(
  request: PersonalScopeRequest & { readonly permission: string },
):
  | PersonalScopeDecision
  | { readonly allowed: false; readonly code: "action_not_allowed" } {
  const scope = authorizePersonalScope(request);
  if (!scope.allowed) return scope;
  if (
    request.permission !== "profile.read" &&
    request.permission !== "profile.create" &&
    request.permission !== "profile.update"
  )
    return { allowed: false, code: "action_not_allowed" };
  return scope;
}
