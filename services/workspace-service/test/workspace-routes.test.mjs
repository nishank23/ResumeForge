import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createWorkspaceApp } from "../dist/app.js";
import { WorkspaceError } from "../dist/contracts.js";

const mockActor = {
  userId: randomUUID(),
  personalWorkspaceId: randomUUID(),
  expiresAt: Date.now() + 60_000,
};

function createMockApp(overrides = {}) {
  const resolveActor =
    overrides.resolveActor ??
    (async (auth) => {
      if (auth === "Bearer valid-token") {
        return { status: "authenticated", actor: mockActor };
      }
      return { status: "unauthenticated" };
    });

  const mockUseCases = {
    createWorkspace: async (_actor, input) => ({
      id: randomUUID(),
      type: input.type,
      name: input.name,
      slug: input.slug ?? "test-slug",
      role: "owner",
      status: "active",
      memberCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    listWorkspaces: async () => [
      {
        id: mockActor.personalWorkspaceId,
        type: "individual",
        name: "Personal Workspace",
        role: "owner",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    getWorkspace: async (_actor, id) => {
      if (id === "missing") throw new WorkspaceError("workspace_not_found", "Not found", 404);
      return {
        id,
        type: "organization",
        name: "Acme Corp",
        role: "owner",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    },
    updateWorkspace: async (_actor, id, input) => ({
      id,
      type: "organization",
      name: input.name ?? "Acme Updated",
      role: "owner",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    switchContext: async (_actor, id) => ({
      workspaceId: id,
      type: "organization",
      name: "Acme Corp",
      role: "owner",
      status: "active",
      permissions: ["resume.read", "resume.create"],
    }),
    listMembers: async () => [
      {
        id: randomUUID(),
        workspaceId: randomUUID(),
        userId: mockActor.userId,
        role: "owner",
        status: "active",
        user: { id: mockActor.userId, name: "Alice", email: "alice@example.com" },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    inviteMember: async (_actor, _wsId, input) => ({
      id: randomUUID(),
      workspaceId: _wsId,
      userId: randomUUID(),
      role: input.role,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    updateMember: async (_actor, _wsId, _memberId, input) => {
      if (input.role !== "owner") {
        throw new WorkspaceError("last_owner_protection", "Cannot demote last owner", 409);
      }
      return {
        id: _memberId,
        workspaceId: _wsId,
        userId: randomUUID(),
        role: input.role,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    },
    removeMember: async (_actor, _wsId, _memberId) => {
      if (_memberId === "last-owner") {
        throw new WorkspaceError("last_owner_protection", "Cannot remove last owner", 409);
      }
      return { removed: true, id: _memberId };
    },
    createGrant: async (_actor, wsId, input) => ({
      id: randomUUID(),
      profileId: input.profileId,
      workspaceId: wsId,
      grantedByUserId: mockActor.userId,
      canReadProfile: input.canReadProfile,
      canWriteProfile: input.canWriteProfile,
      canReadContact: input.canReadContact,
      createdAt: new Date().toISOString(),
      revokedAt: null,
    }),
    listGrants: async () => [],
    revokeGrant: async (_actor, _wsId, grantId) => ({ revoked: true, id: grantId }),
    listAuditEvents: async () => ({ items: [], nextCursor: null }),
    ...overrides.useCases,
  };

  return createWorkspaceApp({
    db: {},
    resolveActor,
    useCases: mockUseCases,
  });
}

test("health endpoint returns ok without authentication", async () => {
  const app = createMockApp();
  const res = await app.request("/api/v1/health");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.status, "ok");
  assert.equal(body.data.service, "workspace-service");
});

test("unauthenticated request returns 401 unauthenticated", async () => {
  const app = createMockApp();
  const res = await app.request("/api/v1/workspaces");
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.error.code, "unauthenticated");
});

test("POST /api/v1/workspaces validates type and name", async () => {
  const app = createMockApp();
  const authHeaders = {
    authorization: "Bearer valid-token",
    "content-type": "application/json",
  };

  // Missing name
  const res1 = await app.request("/api/v1/workspaces", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ type: "organization" }),
  });
  assert.equal(res1.status, 422);

  // Invalid type
  const res2 = await app.request("/api/v1/workspaces", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ type: "individual", name: "My Org" }),
  });
  assert.equal(res2.status, 422);

  // Valid creation
  const res3 = await app.request("/api/v1/workspaces", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ type: "organization", name: "ScaleGrid" }),
  });
  assert.equal(res3.status, 201);
  const body3 = await res3.json();
  assert.equal(body3.data.name, "ScaleGrid");
  assert.equal(body3.data.type, "organization");
  assert.equal(body3.data.role, "owner");
});

test("GET /api/v1/workspaces lists user workspaces", async () => {
  const app = createMockApp();
  const res = await app.request("/api/v1/workspaces", {
    headers: { authorization: "Bearer valid-token" },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.data));
  assert.equal(body.data[0].type, "individual");
});

test("last-owner protection rejection returns 409", async () => {
  const app = createMockApp();
  const authHeaders = {
    authorization: "Bearer valid-token",
    "content-type": "application/json",
  };

  // Demote owner
  const res1 = await app.request(`/api/v1/workspaces/${randomUUID()}/members/m1`, {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({ role: "member" }),
  });
  assert.equal(res1.status, 409);
  const body1 = await res1.json();
  assert.equal(body1.error.code, "last_owner_protection");

  // Remove last owner
  const res2 = await app.request(`/api/v1/workspaces/${randomUUID()}/members/last-owner`, {
    method: "DELETE",
    headers: authHeaders,
  });
  assert.equal(res2.status, 409);
  const body2 = await res2.json();
  assert.equal(body2.error.code, "last_owner_protection");
});

test("GET /api/v1/workspaces/:id/context returns active permissions", async () => {
  const app = createMockApp();
  const wsId = randomUUID();
  const res = await app.request(`/api/v1/workspaces/${wsId}/context`, {
    headers: { authorization: "Bearer valid-token" },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.workspaceId, wsId);
  assert.ok(body.data.permissions.includes("resume.read"));
});
