import assert from "node:assert/strict";
import test from "node:test";

import {
  PERMISSION_NAMES,
  authorizePersonalScope,
  authorizePersonalProfileAction,
} from "../dist/index.js";

const ownWorkspace = {
  id: "ws-personal-alice",
  type: "individual",
  personalOwnerUserId: "user-alice",
};

const ownResource = {
  id: "profile-alice",
  workspaceId: ownWorkspace.id,
  ownerUserId: "user-alice",
};

test("keeps the canonical permission catalog exact and unique", () => {
  assert.equal(PERMISSION_NAMES.length, 27);
  assert.equal(new Set(PERMISSION_NAMES).size, 27);
  assert.ok(PERMISSION_NAMES.includes("profile.contact.read"));
  assert.ok(PERMISSION_NAMES.includes("audit.view"));
});

test("allows an authenticated owner inside the authoritative personal scope", () => {
  assert.deepEqual(
    authorizePersonalScope({
      actorUserId: "user-alice",
      workspace: ownWorkspace,
      clientSelectedWorkspaceId: ownWorkspace.id,
      resource: ownResource,
    }),
    {
      allowed: true,
      scope: {
        actorUserId: "user-alice",
        workspaceId: ownWorkspace.id,
        resourceId: ownResource.id,
      },
    },
  );
});

test("denies a missing authenticated actor", () => {
  assert.deepEqual(
    authorizePersonalScope({ actorUserId: null, workspace: ownWorkspace }),
    { allowed: false, code: "unauthenticated" },
  );
});

test("denies access to another user's personal workspace", () => {
  assert.deepEqual(
    authorizePersonalScope({
      actorUserId: "user-bob",
      workspace: ownWorkspace,
    }),
    { allowed: false, code: "personal_ownership_required" },
  );
});

test("treats the client workspace selector as untrusted input", () => {
  assert.deepEqual(
    authorizePersonalScope({
      actorUserId: "user-alice",
      workspace: ownWorkspace,
      clientSelectedWorkspaceId: "ws-personal-bob",
    }),
    { allowed: false, code: "workspace_selector_mismatch" },
  );
});

test("does not activate organization or vendor workspace access", () => {
  assert.deepEqual(
    authorizePersonalScope({
      actorUserId: "user-alice",
      workspace: { ...ownWorkspace, type: "organization" },
    }),
    { allowed: false, code: "unsupported_workspace_type" },
  );
});

test("denies a resource from another workspace", () => {
  assert.deepEqual(
    authorizePersonalScope({
      actorUserId: "user-alice",
      workspace: ownWorkspace,
      resource: { ...ownResource, workspaceId: "ws-personal-bob" },
    }),
    { allowed: false, code: "resource_scope_mismatch" },
  );
});

test("denies a resource owned by another user in the same workspace", () => {
  assert.deepEqual(
    authorizePersonalScope({
      actorUserId: "user-alice",
      workspace: ownWorkspace,
      resource: { ...ownResource, ownerUserId: "user-bob" },
    }),
    { allowed: false, code: "resource_ownership_mismatch" },
  );
});

test("fails closed for blank authoritative identifiers", () => {
  assert.deepEqual(
    authorizePersonalScope({
      actorUserId: "user-alice",
      workspace: { ...ownWorkspace, id: "  " },
    }),
    { allowed: false, code: "invalid_scope" },
  );
});

test("only professional read/update actions are enabled for the personal owner", () => {
  for (const permission of ["profile.read", "profile.update"])
    assert.equal(
      authorizePersonalProfileAction({
        permission,
        actorUserId: "user-alice",
        workspace: ownWorkspace,
        resource: ownResource,
      }).allowed,
      true,
    );
  for (const permission of [
    "profile.create",
    "profile.contact.read",
    "profile.delete",
    "coverletter.read",
    "audit.view",
    "unknown",
  ])
    assert.deepEqual(
      authorizePersonalProfileAction({
        permission,
        actorUserId: "user-alice",
        workspace: ownWorkspace,
      }),
      { allowed: false, code: "action_not_allowed" },
    );
});

test("an enabled action never bypasses owner/resource or shared-workspace scope checks", () => {
  for (const request of [
    { actorUserId: "user-bob", workspace: ownWorkspace },
    {
      actorUserId: "user-alice",
      workspace: { ...ownWorkspace, type: "organization" },
    },
    {
      actorUserId: "user-alice",
      workspace: { ...ownWorkspace, type: "vendor" },
    },
    {
      actorUserId: "user-alice",
      workspace: ownWorkspace,
      resource: { ...ownResource, ownerUserId: "user-bob" },
    },
  ])
    assert.equal(
      authorizePersonalProfileAction({ permission: "profile.read", ...request })
        .allowed,
      false,
    );
});
