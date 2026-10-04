import test from "node:test";
import assert from "node:assert/strict";
import { resolveWorkspacePermissions, hasPermission } from "../dist/rbac.js";
import { PERMISSION_NAMES } from "../dist/contracts.js";

test("resolveWorkspacePermissions for individual workspace", () => {
  const perms = resolveWorkspacePermissions("individual", "owner");
  assert.ok(perms.includes("profile.read"));
  assert.ok(perms.includes("resume.read"));
  assert.ok(perms.includes("resume.create"));
  assert.ok(perms.includes("resume.update"));
  assert.ok(perms.includes("resume.delete"));
  assert.ok(perms.includes("profile.contact.read"));
  assert.ok(perms.includes("profile.contact.update"));
  assert.ok(perms.includes("audit.view"));
});

test("resolveWorkspacePermissions for organization workspace", () => {
  const ownerPerms = resolveWorkspacePermissions("organization", "owner");
  const adminPerms = resolveWorkspacePermissions("organization", "admin");
  const memberPerms = resolveWorkspacePermissions("organization", "member");

  // Owner has full suite including contact and member management
  assert.ok(hasPermission(ownerPerms, "profile.contact.read"));
  assert.ok(hasPermission(ownerPerms, "user.invite"));
  assert.ok(hasPermission(ownerPerms, "user.remove"));
  assert.ok(hasPermission(ownerPerms, "workspace.members.manage"));
  assert.ok(hasPermission(ownerPerms, "audit.view"));

  // Admin has member management and audit.view
  assert.ok(hasPermission(adminPerms, "user.invite"));
  assert.ok(hasPermission(adminPerms, "workspace.members.manage"));
  assert.ok(hasPermission(adminPerms, "audit.view"));

  // Member has read/write resume and profile but no admin/audit capabilities
  assert.ok(hasPermission(memberPerms, "resume.read"));
  assert.ok(hasPermission(memberPerms, "resume.create"));
  assert.ok(hasPermission(memberPerms, "resume.update"));
  assert.ok(hasPermission(memberPerms, "workspace.members.view"));
  assert.equal(hasPermission(memberPerms, "audit.view"), false);
  assert.equal(hasPermission(memberPerms, "user.invite"), false);
  assert.equal(hasPermission(memberPerms, "user.remove"), false);
  assert.equal(hasPermission(memberPerms, "workspace.members.manage"), false);
});

test("resolveWorkspacePermissions for vendor workspace - contact privacy enforcement (D05)", () => {
  const ownerPerms = resolveWorkspacePermissions("vendor", "owner");
  const adminPerms = resolveWorkspacePermissions("vendor", "admin");
  const memberPerms = resolveWorkspacePermissions("vendor", "member");

  // Vendor roles are explicitly denied contact access per D05 draft in authorization-model.md
  assert.equal(hasPermission(ownerPerms, "profile.contact.read"), false);
  assert.equal(hasPermission(ownerPerms, "profile.contact.update"), false);
  assert.equal(hasPermission(adminPerms, "profile.contact.read"), false);
  assert.equal(hasPermission(adminPerms, "profile.contact.update"), false);
  assert.equal(hasPermission(memberPerms, "profile.contact.read"), false);

  // Vendor owners and admins still have management and audit view
  assert.ok(hasPermission(ownerPerms, "audit.view"));
  assert.ok(hasPermission(ownerPerms, "user.invite"));
  assert.ok(hasPermission(adminPerms, "audit.view"));
  assert.ok(hasPermission(adminPerms, "user.invite"));
});

test("permission catalog strictly preserves all 27 canonical permissions", () => {
  assert.equal(PERMISSION_NAMES.length, 27);
  const expected = [
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
  ];
  for (const perm of expected) {
    assert.ok(PERMISSION_NAMES.includes(perm), `Missing expected permission: ${perm}`);
  }
});
