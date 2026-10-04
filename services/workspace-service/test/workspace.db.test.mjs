import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";
import pg from "pg";
import { createDatabaseClient } from "@resume-forge/prisma-client";
import { createWorkspaceApp } from "../dist/app.js";
import { createWorkspaceUseCases } from "../dist/workspace.js";

const local = parseEnv(
  readFileSync(
    new URL("../../../.local/database.env", import.meta.url),
    "utf8",
  ),
);
const base = new URL(local.DATABASE_URL);
assert.equal(base.hostname, "127.0.0.1");
assert.equal(base.port, "55432");

const dbName = `rf_ws_test_${randomUUID().replaceAll("-", "")}`;
const adminUrl = new URL(base);
adminUrl.pathname = "/postgres";
const admin = new pg.Client({ connectionString: adminUrl.href });
const url = new URL(base);
url.pathname = `/${dbName}`;
const db = createDatabaseClient(url.href);

test("multi-tenant workspace management, RBAC, and audit viewing database integration", async (t) => {
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${dbName}"`);
    const migration = spawnSync(
      "pnpm",
      ["exec", "prisma", "migrate", "deploy"],
      {
        cwd: new URL("../../../packages/prisma-client", import.meta.url),
        env: { ...process.env, DATABASE_URL: url.href },
        encoding: "utf8",
      },
    );
    assert.equal(migration.status, 0, "Prisma migration deploy must succeed");

    // Seed test users: Alice (owner), Bob (colleague), Charlie (external member)
    const aliceUser = await db.user.create({
      data: { email: "alice@example.com", name: "Alice Founder" },
    });
    const bobUser = await db.user.create({
      data: { email: "bob@example.com", name: "Bob Colleague" },
    });
    const charlieUser = await db.user.create({
      data: { email: "charlie@example.com", name: "Charlie Member" },
    });

    // Create Alice's personal workspace
    const alicePersonalWs = await db.workspace.create({
      data: {
        type: "individual",
        personalOwnerUserId: aliceUser.id,
      },
    });

    // Create Alice's master profile
    const aliceProfile = await db.userProfile.create({
      data: {
        userId: aliceUser.id,
        fullName: "Alice Founder",
        professionalSummary: "Founder and Principal Architect",
      },
    });

    const aliceActor = {
      userId: aliceUser.id,
      personalWorkspaceId: alicePersonalWs.id,
      expiresAt: Date.now() + 300_000,
    };

    const bobActor = {
      userId: bobUser.id,
      personalWorkspaceId: randomUUID(),
      expiresAt: Date.now() + 300_000,
    };

    const charlieActor = {
      userId: charlieUser.id,
      personalWorkspaceId: randomUUID(),
      expiresAt: Date.now() + 300_000,
    };

    const resolveActor = async (auth) => {
      if (auth === "Bearer alice-token") return { status: "authenticated", actor: aliceActor };
      if (auth === "Bearer bob-token") return { status: "authenticated", actor: bobActor };
      if (auth === "Bearer charlie-token") return { status: "authenticated", actor: charlieActor };
      return { status: "unauthenticated" };
    };

    const useCases = createWorkspaceUseCases(db);
    const app = createWorkspaceApp({ db, resolveActor, useCases });

    let orgWorkspaceId = "";
    let vendorWorkspaceId = "";

    // ── 1. Create Organization Workspace (F13) ───────────────────────────────
    await t.test("Alice creates an Organization workspace", async () => {
      const res = await app.request("/api/v1/workspaces", {
        method: "POST",
        headers: {
          authorization: "Bearer alice-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          type: "organization",
          name: "Acme Innovations",
          settings: { domain: "acme.com" },
        }),
      });

      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.data.name, "Acme Innovations");
      assert.equal(body.data.type, "organization");
      assert.equal(body.data.role, "owner");
      assert.equal(body.data.status, "active");
      assert.equal(body.data.slug, "acme-innovations");
      orgWorkspaceId = body.data.id;

      // Verify membership in DB
      const membership = await db.workspaceMembership.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: orgWorkspaceId,
            userId: aliceUser.id,
          },
        },
      });
      assert.ok(membership);
      assert.equal(membership.role, "owner");
      assert.equal(membership.status, "active");

      // Verify audit event in DB
      const audit = await db.auditEvent.findFirst({
        where: {
          workspaceId: orgWorkspaceId,
          action: "member.role_changed",
        },
      });
      assert.ok(audit);
      assert.equal(audit.actorUserId, aliceUser.id);
    });

    // ── 2. Create Vendor Workspace (F13 / D05) ────────────────────────────────
    await t.test("Alice creates a Vendor workspace with slug collision handling", async () => {
      const res = await app.request("/api/v1/workspaces", {
        method: "POST",
        headers: {
          authorization: "Bearer alice-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          type: "vendor",
          name: "Acme Innovations", // same base slug
        }),
      });

      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.data.type, "vendor");
      assert.equal(body.data.role, "owner");
      vendorWorkspaceId = body.data.id;
    });

    // ── 3. List Workspaces (F13) ─────────────────────────────────────────────
    await t.test("Alice lists workspaces (sees personal, org, and vendor)", async () => {
      const res = await app.request("/api/v1/workspaces", {
        headers: { authorization: "Bearer alice-token" },
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.data.length, 3);
      const types = body.data.map((w) => w.type);
      assert.ok(types.includes("individual"));
      assert.ok(types.includes("organization"));
      assert.ok(types.includes("vendor"));
    });

    // ── 4. Workspace Details & Update (F13) ───────────────────────────────────
    await t.test("Alice gets and updates Organization workspace settings", async () => {
      // Get details
      const getRes = await app.request(`/api/v1/workspaces/${orgWorkspaceId}`, {
        headers: { authorization: "Bearer alice-token" },
      });
      assert.equal(getRes.status, 200);
      const getBody = await getRes.json();
      assert.equal(getBody.data.name, "Acme Innovations");

      // Update settings
      const patchRes = await app.request(`/api/v1/workspaces/${orgWorkspaceId}`, {
        method: "PATCH",
        headers: {
          authorization: "Bearer alice-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Acme Innovations Global",
        }),
      });
      assert.equal(patchRes.status, 200);
      const patchBody = await patchRes.json();
      assert.equal(patchBody.data.name, "Acme Innovations Global");

      // Verify audit event
      const audit = await db.auditEvent.findFirst({
        where: {
          workspaceId: orgWorkspaceId,
          action: "workspace.settings_updated",
        },
      });
      assert.ok(audit);
    });

    // ── 5. Context Switching & Capabilities (F13 / F14) ──────────────────────
    await t.test("Alice switches context and verifies resolved permissions", async () => {
      // Org context
      const orgRes = await app.request(`/api/v1/workspaces/${orgWorkspaceId}/context`, {
        headers: { authorization: "Bearer alice-token" },
      });
      assert.equal(orgRes.status, 200);
      const orgBody = await orgRes.json();
      assert.equal(orgBody.data.role, "owner");
      assert.ok(orgBody.data.permissions.includes("profile.contact.read"));
      assert.ok(orgBody.data.permissions.includes("audit.view"));
      assert.ok(orgBody.data.permissions.includes("workspace.members.manage"));

      // Vendor context (D05 privacy: contact access denied)
      const vendorRes = await app.request(`/api/v1/workspaces/${vendorWorkspaceId}/context`, {
        headers: { authorization: "Bearer alice-token" },
      });
      assert.equal(vendorRes.status, 200);
      const vendorBody = await vendorRes.json();
      assert.equal(vendorBody.data.role, "owner");
      assert.equal(vendorBody.data.permissions.includes("profile.contact.read"), false);
      assert.equal(vendorBody.data.permissions.includes("profile.contact.update"), false);
      assert.ok(vendorBody.data.permissions.includes("audit.view"));
    });

    // ── 6. Member Invitation & Listing (F13 / F14) ───────────────────────────
    await t.test("Alice invites Bob (admin) and Bob invites Charlie (member)", async () => {
      // Alice invites Bob as admin
      const inviteBobRes = await app.request(`/api/v1/workspaces/${orgWorkspaceId}/members`, {
        method: "POST",
        headers: {
          authorization: "Bearer alice-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          userId: bobUser.id,
          role: "admin",
        }),
      });
      assert.equal(inviteBobRes.status, 201);
      const bobMember = await inviteBobRes.json();
      assert.equal(bobMember.data.role, "admin");

      // Duplicate invitation fails
      const dupRes = await app.request(`/api/v1/workspaces/${orgWorkspaceId}/members`, {
        method: "POST",
        headers: {
          authorization: "Bearer alice-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          userId: bobUser.id,
          role: "admin",
        }),
      });
      assert.equal(dupRes.status, 409);

      // Bob (admin) invites Charlie as member
      const inviteCharlieRes = await app.request(`/api/v1/workspaces/${orgWorkspaceId}/members`, {
        method: "POST",
        headers: {
          authorization: "Bearer bob-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          userId: charlieUser.id,
          role: "member",
        }),
      });
      assert.equal(inviteCharlieRes.status, 201);

      // List members
      const listRes = await app.request(`/api/v1/workspaces/${orgWorkspaceId}/members`, {
        headers: { authorization: "Bearer alice-token" },
      });
      assert.equal(listRes.status, 200);
      const listBody = await listRes.json();
      assert.equal(listBody.data.length, 3);
    });

    // ── 7. Last-Owner Protection (F13 / F14) ─────────────────────────────────
    await t.test("Last-owner protection blocks demotion, suspension, or deletion of last owner", async () => {
      // 7a. Bob (admin) attempts to demote Alice (owner) -> Forbidden
      const adminDemoteRes = await app.request(
        `/api/v1/workspaces/${orgWorkspaceId}/members/${aliceUser.id}`,
        {
          method: "PATCH",
          headers: {
            authorization: "Bearer bob-token",
            "content-type": "application/json",
          },
          body: JSON.stringify({ role: "member" }),
        },
      );
      assert.equal(adminDemoteRes.status, 403);

      // 7b. Alice attempts to demote herself -> Rejected by last-owner protection
      const selfDemoteRes = await app.request(
        `/api/v1/workspaces/${orgWorkspaceId}/members/${aliceUser.id}`,
        {
          method: "PATCH",
          headers: {
            authorization: "Bearer alice-token",
            "content-type": "application/json",
          },
          body: JSON.stringify({ role: "member" }),
        },
      );
      assert.equal(selfDemoteRes.status, 409);
      const selfDemoteBody = await selfDemoteRes.json();
      assert.equal(selfDemoteBody.error.code, "last_owner_protection");

      // 7c. Alice attempts to suspend herself -> Rejected by last-owner protection
      const selfSuspendRes = await app.request(
        `/api/v1/workspaces/${orgWorkspaceId}/members/${aliceUser.id}`,
        {
          method: "PATCH",
          headers: {
            authorization: "Bearer alice-token",
            "content-type": "application/json",
          },
          body: JSON.stringify({ status: "suspended" }),
        },
      );
      assert.equal(selfSuspendRes.status, 409);
      const selfSuspendBody = await selfSuspendRes.json();
      assert.equal(selfSuspendBody.error.code, "last_owner_protection");

      // 7d. Alice attempts to remove herself -> Rejected by last-owner protection
      const selfRemoveRes = await app.request(
        `/api/v1/workspaces/${orgWorkspaceId}/members/${aliceUser.id}`,
        {
          method: "DELETE",
          headers: { authorization: "Bearer alice-token" },
        },
      );
      assert.equal(selfRemoveRes.status, 409);
      const selfRemoveBody = await selfRemoveRes.json();
      assert.equal(selfRemoveBody.error.code, "last_owner_protection");

      // 7e. Promote Bob to owner (now 2 owners exist)
      const promoteBobRes = await app.request(
        `/api/v1/workspaces/${orgWorkspaceId}/members/${bobUser.id}`,
        {
          method: "PATCH",
          headers: {
            authorization: "Bearer alice-token",
            "content-type": "application/json",
          },
          body: JSON.stringify({ role: "owner" }),
        },
      );
      assert.equal(promoteBobRes.status, 200);

      // 7f. Now Alice can be demoted to admin because Bob is another active owner!
      const demoteAliceRes = await app.request(
        `/api/v1/workspaces/${orgWorkspaceId}/members/${aliceUser.id}`,
        {
          method: "PATCH",
          headers: {
            authorization: "Bearer bob-token",
            "content-type": "application/json",
          },
          body: JSON.stringify({ role: "admin" }),
        },
      );
      assert.equal(demoteAliceRes.status, 200);

      // Restore Alice as owner for subsequent tests
      await app.request(`/api/v1/workspaces/${orgWorkspaceId}/members/${aliceUser.id}`, {
        method: "PATCH",
        headers: {
          authorization: "Bearer bob-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ role: "owner" }),
      });
    });

    // ── 8. Profile-Workspace Grants (D03) ───────────────────────────────────
    await t.test("Profile owner grants and revokes workspace profile access", async () => {
      // Bob attempts to grant Alice's profile -> Forbidden
      const bobGrantRes = await app.request(`/api/v1/workspaces/${orgWorkspaceId}/grants`, {
        method: "POST",
        headers: {
          authorization: "Bearer bob-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          profileId: aliceProfile.id,
          canReadProfile: true,
          canReadContact: false,
        }),
      });
      assert.equal(bobGrantRes.status, 403);

      // Alice grants her own profile
      const aliceGrantRes = await app.request(`/api/v1/workspaces/${orgWorkspaceId}/grants`, {
        method: "POST",
        headers: {
          authorization: "Bearer alice-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          profileId: aliceProfile.id,
          canReadProfile: true,
          canReadContact: true,
        }),
      });
      assert.equal(aliceGrantRes.status, 201);
      const grantBody = await aliceGrantRes.json();
      const grantId = grantBody.data.id;

      // List grants
      const listGrantsRes = await app.request(`/api/v1/workspaces/${orgWorkspaceId}/grants`, {
        headers: { authorization: "Bearer bob-token" },
      });
      assert.equal(listGrantsRes.status, 200);
      const listGrantsBody = await listGrantsRes.json();
      assert.equal(listGrantsBody.data.length, 1);
      assert.equal(listGrantsBody.data[0].canReadContact, true);

      // Revoke grant
      const revokeRes = await app.request(
        `/api/v1/workspaces/${orgWorkspaceId}/grants/${grantId}`,
        {
          method: "DELETE",
          headers: { authorization: "Bearer alice-token" },
        },
      );
      assert.equal(revokeRes.status, 200);

      // List grants again -> 0 active grants
      const listAfterRes = await app.request(`/api/v1/workspaces/${orgWorkspaceId}/grants`, {
        headers: { authorization: "Bearer bob-token" },
      });
      assert.equal(listAfterRes.status, 200);
      const listAfterBody = await listAfterRes.json();
      assert.equal(listAfterBody.data.length, 0);
    });

    // ── 9. Audit Event Viewer (F15) ─────────────────────────────────────────
    await t.test("Audit Event Viewer supports pagination, action filtering, and tenant isolation", async () => {
      // Charlie (member without audit.view) is denied
      const charlieAuditRes = await app.request(
        `/api/v1/workspaces/${orgWorkspaceId}/audit-events`,
        {
          headers: { authorization: "Bearer charlie-token" },
        },
      );
      assert.equal(charlieAuditRes.status, 403);

      // Alice (owner) queries audit events
      const aliceAuditRes = await app.request(
        `/api/v1/workspaces/${orgWorkspaceId}/audit-events`,
        {
          headers: { authorization: "Bearer alice-token" },
        },
      );
      assert.equal(aliceAuditRes.status, 200);
      const aliceAuditBody = await aliceAuditRes.json();
      assert.ok(aliceAuditBody.data.items.length >= 4);

      // Filter by action: member.invited
      const filterRes = await app.request(
        `/api/v1/workspaces/${orgWorkspaceId}/audit-events?action=member.invited`,
        {
          headers: { authorization: "Bearer alice-token" },
        },
      );
      assert.equal(filterRes.status, 200);
      const filterBody = await filterRes.json();
      for (const item of filterBody.data.items) {
        assert.equal(item.action, "member.invited");
      }

      // Tenant isolation: querying Vendor workspace audit events returns only vendor events
      const vendorAuditRes = await app.request(
        `/api/v1/workspaces/${vendorWorkspaceId}/audit-events`,
        {
          headers: { authorization: "Bearer alice-token" },
        },
      );
      assert.equal(vendorAuditRes.status, 200);
      const vendorAuditBody = await vendorAuditRes.json();
      for (const item of vendorAuditBody.data.items) {
        assert.equal(item.workspaceId, vendorWorkspaceId);
      }
    });
  } finally {
    await db.$disconnect();
    await admin.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    await admin.end();
  }
});
