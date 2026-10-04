import {
  PERMISSION_NAMES,
  type PermissionName,
  type WorkspaceRole,
  type WorkspaceType,
} from "./contracts.js";

const COMMON_MEMBER_PERMISSIONS: PermissionName[] = [
  "profile.read",
  "resume.read",
  "resume.create",
  "resume.update",
  "ats.run",
  "ats.view",
  "skillgap.analyze",
  "template.view",
  "workspace.members.view",
  "workspace.settings.view",
];

const ORG_ADMIN_PERMISSIONS: PermissionName[] = [
  ...COMMON_MEMBER_PERMISSIONS,
  "profile.create",
  "profile.update",
  "profile.delete",
  "profile.contact.read",
  "profile.contact.update",
  "resume.delete",
  "resume.generate",
  "resume.download",
  "user.invite",
  "user.manage",
  "user.remove",
  "workspace.members.manage",
  "workspace.settings.manage",
  "audit.view",
];

const ORG_OWNER_PERMISSIONS: PermissionName[] = [
  ...ORG_ADMIN_PERMISSIONS,
];

// Per D05 draft in authorization-model.md: Vendor roles are denied contact access
const VENDOR_ADMIN_PERMISSIONS: PermissionName[] = [
  ...COMMON_MEMBER_PERMISSIONS,
  "profile.create",
  "profile.update",
  "profile.delete",
  "resume.delete",
  "resume.generate",
  "resume.download",
  "user.invite",
  "user.manage",
  "user.remove",
  "workspace.members.manage",
  "workspace.settings.manage",
  "audit.view",
];

const VENDOR_OWNER_PERMISSIONS: PermissionName[] = [
  ...VENDOR_ADMIN_PERMISSIONS,
];

const INDIVIDUAL_OWNER_PERMISSIONS: PermissionName[] = [
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
  "template.view",
  "workspace.settings.view",
  "workspace.settings.manage",
  "audit.view",
];

/**
 * Resolves the active permissions for an actor in a given workspace.
 * Follows the canonical 27-permission catalog from authorization-model.md.
 */
export function resolveWorkspacePermissions(
  workspaceType: WorkspaceType,
  role: WorkspaceRole,
): PermissionName[] {
  if (workspaceType === "individual") {
    return [...INDIVIDUAL_OWNER_PERMISSIONS];
  }

  if (workspaceType === "organization") {
    if (role === "owner") return [...ORG_OWNER_PERMISSIONS];
    if (role === "admin") return [...ORG_ADMIN_PERMISSIONS];
    return [...COMMON_MEMBER_PERMISSIONS];
  }

  if (workspaceType === "vendor") {
    if (role === "owner") return [...VENDOR_OWNER_PERMISSIONS];
    if (role === "admin") return [...VENDOR_ADMIN_PERMISSIONS];
    return [...COMMON_MEMBER_PERMISSIONS];
  }

  return [];
}

/**
 * Check whether a specific permission is granted by the resolved permissions list.
 */
export function hasPermission(
  permissions: readonly PermissionName[],
  required: PermissionName,
): boolean {
  return permissions.includes(required);
}

/**
 * Validates that an action is allowed for an actor; throws or returns false if not.
 */
export function assertPermission(
  permissions: readonly PermissionName[],
  required: PermissionName,
  actionDescription = "Action not permitted",
): void {
  if (!hasPermission(permissions, required)) {
    throw new Error(actionDescription);
  }
}
