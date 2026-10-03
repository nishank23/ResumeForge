import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";
import { once } from "node:events";
import { serve } from "@hono/node-server";
import {
  createDatabaseClient,
  runtimeRoleNames,
  assertRuntimeDatabaseRole,
  deliverAuditOutbox,
  createLocalAuditHttpTransport,
} from "@resume-forge/prisma-client";
import { createLocalActorResolver } from "@resume-forge/access-policy/server";
import {
  Client,
  provisionRuntimeRoles,
} from "../../../scripts/runtime-roles.mjs";
import { createAuthApp } from "../../auth-service/dist/app.js";
import { createWorkspaceAuditApp } from "../../workspace-service/dist/app.js";
import { createProfileApp } from "../dist/app.js";
import { createProfileUseCases } from "../dist/profile.js";

const base = new URL(
  parseEnv(
    readFileSync(
      new URL("../../../.local/database.env", import.meta.url),
      "utf8",
    ),
  ).DATABASE_URL,
);
assert.equal(base.hostname, "127.0.0.1");
assert.equal(base.port, "55432");
const suffix = randomUUID().replaceAll("-", "");
const databaseName = `rf_profile_test_${suffix}`;
const prefix = `rf_profile_${suffix.slice(0, 12)}`;
const names = runtimeRoleNames(prefix);
const passwords = Object.fromEntries(
  Object.keys(names).map((service) => [
    service,
    randomBytes(32).toString("hex"),
  ]),
);
const adminUrl = new URL(base);
adminUrl.pathname = "/postgres";
const lifecycle = new Client({ connectionString: adminUrl.href });
const url = new URL(base);
url.pathname = `/${databaseName}`;
const admin = new Client({ connectionString: url.href });
const owner = createDatabaseClient(url.href);
const runtime = Object.fromEntries(
  ["auth", "profile", "auditRelay", "auditIngest"].map((service) => {
    const target = new URL(url);
    target.username = names[service];
    target.password = passwords[service];
    return [service, createDatabaseClient(target.href)];
  }),
);
const close = (server) =>
  new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  });
const cookie = (response, name) =>
  response.headers
    .getSetCookie()
    .find((value) => value.startsWith(`${name}=`))
    ?.split(";")[0];

test("private profile API with real actor transport, restricted persistence and atomic audit", async (t) => {
  const servers = [];
  await lifecycle.connect();
  try {
    await lifecycle.query(`CREATE DATABASE "${databaseName}"`);
    const migration = spawnSync(
      "pnpm",
      ["exec", "prisma", "migrate", "deploy"],
      {
        cwd: new URL("../../../packages/prisma-client/", import.meta.url),
        env: { ...process.env, DATABASE_URL: url.href },
        encoding: "utf8",
      },
    );
    assert.equal(migration.status, 0, "Fresh migrations must apply");
    await admin.connect();
    await provisionRuntimeRoles(admin, { databaseName, prefix, passwords });
    for (const service of Object.keys(runtime))
      await assertRuntimeDatabaseRole(
        runtime[service],
        service,
        names[service],
      );
    const people = {};
    for (const name of ["alice", "bob", "charlie"])
      people[name] = await owner.user.create({
        data: {
          email: `${name}@example.invalid`,
          name: `Synthetic ${name} identity`,
          accounts: {
            create: {
              provider: "google",
              providerSubject: `synthetic-${name}`,
            },
          },
          personalWorkspace: { create: { type: "individual" } },
          ...(name === "charlie"
            ? {}
            : {
                profile: {
                  create: {
                    fullName: `Synthetic ${name}`,
                    professionalSummary: `Synthetic ${name} summary`,
                    contact: {
                      create: {
                        email: `${name}-private@example.invalid`,
                        phone: "synthetic-private-phone",
                        address: "synthetic-private-address",
                      },
                    },
                  },
                },
              }),
        },
        include: { personalWorkspace: true, profile: true },
      });
    let identity = "alice";
    const key = randomBytes(32).toString("hex");
    const auth = createAuthApp({
      db: runtime.auth,
      profileServiceKey: key,
      appOrigin: "http://localhost:3000",
      provider: {
        authorizationURL(state) {
          return `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`;
        },
        async identity() {
          return {
            sub: `synthetic-${identity}`,
            email: `${identity}@example.invalid`,
            email_verified: true,
            name: `Synthetic ${identity}`,
          };
        },
      },
    });
    const authServer = serve({
      fetch: auth.fetch,
      hostname: "127.0.0.1",
      port: 0,
    });
    servers.push(authServer);
    await once(authServer, "listening");
    const resolveActor = createLocalActorResolver({
      endpoint: `http://127.0.0.1:${authServer.address().port}/internal/auth/resolve`,
      key,
    });
    const profiles = createProfileUseCases(runtime.profile);
    const app = createProfileApp({ resolveActor, profiles });
    const profileServer = serve({
      fetch: app.fetch,
      hostname: "127.0.0.1",
      port: 0,
    });
    servers.push(profileServer);
    await once(profileServer, "listening");
    const endpoint = `http://127.0.0.1:${profileServer.address().port}/api/v1/profile`;
    const credentials = {};
    for (const name of Object.keys(people)) {
      identity = name;
      const start = await auth.request("/api/v1/auth/google/url");
      const state = new URL((await start.json()).url).searchParams.get("state");
      const signedIn = await auth.request(
        `/api/v1/auth/google/callback?state=${state}&code=synthetic-code`,
        { headers: { Cookie: cookie(start, "oauth_binding") } },
      );
      const refreshed = await auth.request("/api/v1/auth/refresh", {
        method: "POST",
        headers: {
          Cookie: cookie(signedIn, "refresh_token"),
          Origin: "http://localhost:3000",
        },
      });
      assert.equal(refreshed.status, 200);
      credentials[name] = {
        token: (await refreshed.json()).data.accessToken,
        cookie: cookie(refreshed, "refresh_token"),
      };
    }
    const request = (
      name = "alice",
      { body, headers = {}, path = "", ...options } = {},
    ) =>
      fetch(endpoint + path, {
        ...options,
        headers: {
          Authorization: `Bearer ${credentials[name].token}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    const update = async (override = {}) => ({
      expectedRevision: (
        await owner.userProfile.findUniqueOrThrow({
          where: { id: people.alice.profile.id },
        })
      ).revision,
      fullName: "Updated Synthetic Alice",
      location: null,
      professionalSummary: "Supported synthetic professional facts",
      ...override,
    });
    await t.test(
      "anonymous and unknown credentials expose no profile",
      async () => {
        const before = await owner.auditOutbox.count();
        assert.equal((await fetch(endpoint)).status, 401);
        assert.equal(
          (
            await fetch(endpoint, {
              headers: {
                Cookie: credentials.alice.cookie,
                "X-User-Id": people.alice.id,
              },
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await fetch(endpoint, {
              headers: { Authorization: `Bearer ${"0".repeat(64)}` },
            })
          ).status,
          401,
        );
        assert.equal(await owner.auditOutbox.count(), before);
      },
    );
    await t.test(
      "GET projects only owned professional fields and captures a content-free read",
      async () => {
        const response = await request();
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("Cache-Control"), "no-store");
        const body = await response.json();
        assert.deepEqual(body.data, {
          id: people.alice.profile.id,
          fullName: "Synthetic alice",
          location: null,
          professionalSummary: "Synthetic alice summary",
          revision: 1,
        });
        assert.equal(response.headers.get("X-Request-Id"), body.requestId);
        const event = await owner.auditOutbox.findFirstOrThrow({
          where: {
            payload: { path: ["correlationId"], equals: body.requestId },
          },
        });
        assert.equal(event.payload.action, "profile.viewed");
        assert.deepEqual(event.payload.metadata, {});
        assert.equal(
          JSON.stringify(event.payload).includes("Synthetic alice"),
          false,
        );
        assert.equal(JSON.stringify(body).includes("private"), false);
      },
    );
    await t.test(
      "PUT persists normalized fields/revision with audit and preserves contacts/onboarding/other users",
      async () => {
        const contact = await owner.userContact.findUniqueOrThrow({
          where: { profileId: people.alice.profile.id },
        });
        const response = await request("alice", {
          method: "PUT",
          body: await update({ fullName: "  Updated Synthetic Alice  " }),
        });
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.data.fullName, "Updated Synthetic Alice");
        assert.equal(body.data.revision, 2);
        const reloaded = (await (await request()).json()).data;
        assert.deepEqual(reloaded, body.data);
        assert.deepEqual(
          await owner.userContact.findUniqueOrThrow({
            where: { profileId: people.alice.profile.id },
          }),
          contact,
        );
        assert.equal(
          (
            await owner.userProfile.findUniqueOrThrow({
              where: { id: people.alice.profile.id },
            })
          ).onboardingCompletedAt,
          null,
        );
        assert.equal(
          (
            await owner.userProfile.findUniqueOrThrow({
              where: { id: people.bob.profile.id },
            })
          ).revision,
          1,
        );
        const event = await owner.auditOutbox.findFirstOrThrow({
          where: {
            payload: { path: ["correlationId"], equals: body.requestId },
          },
        });
        assert.equal(event.payload.action, "profile.updated");
        assert.equal(
          JSON.stringify(event.payload).includes(body.data.professionalSummary),
          false,
        );
      },
    );
    await t.test(
      "absent master profile returns 404 and is never created from auth data",
      async () => {
        const before = await owner.auditOutbox.count();
        assert.equal((await request("charlie")).status, 404);
        assert.equal(
          (await request("charlie", { method: "PUT", body: await update() }))
            .status,
          404,
        );
        assert.equal(await owner.userProfile.count(), 2);
        assert.equal(await owner.auditOutbox.count(), before);
      },
    );
    await t.test(
      "workspace substitution is denied and durably audited in the actor's scope",
      async () => {
        for (const selector of [
          people.bob.personalWorkspace.id,
          randomUUID(),
          "not-an-id",
          "",
        ]) {
          const response = await request("alice", {
            headers: { "X-Workspace-Id": selector },
          });
          assert.equal(response.status, 403);
          const body = await response.json();
          const event = await owner.auditOutbox.findFirstOrThrow({
            where: {
              payload: { path: ["correlationId"], equals: body.requestId },
            },
          });
          assert.equal(event.payload.action, "authorization.denied");
          assert.equal(
            event.payload.workspaceId,
            people.alice.personalWorkspace.id,
          );
          assert.equal(
            event.payload.resourceId,
            people.alice.personalWorkspace.id,
          );
          assert.equal(event.payload.outcome, "denied");
          assert.equal(event.payload.metadata.permission, "profile.read");
          if (selector)
            assert.equal(
              JSON.stringify(event.payload).includes(selector),
              false,
            );
        }
        assert.equal(
          (
            await request("alice", {
              method: "PUT",
              headers: { "X-Workspace-Id": people.bob.personalWorkspace.id },
              body: await update(),
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await request("alice", {
              headers: { "X-Workspace-Id": people.alice.personalWorkspace.id },
            })
          ).status,
          200,
        );
        await assert.rejects(
          profiles.read({
            actor: {
              userId: people.bob.id,
              personalWorkspaceId: people.alice.personalWorkspace.id,
              expiresAt: Date.now() + 300000,
            },
            correlationId: randomUUID(),
          }),
          { code: "forbidden" },
        );
      },
    );
    await t.test(
      "client profile IDs and identity/role fields cannot switch the target",
      async () => {
        assert.equal(
          (
            await request("alice", {
              path: `?profileId=${people.bob.profile.id}`,
            })
          ).status,
          422,
        );
        assert.equal(
          (await request("alice", { path: `/${people.bob.profile.id}` }))
            .status,
          404,
        );
        const forged = await request("alice", {
          headers: { "X-User-Id": people.bob.id, "X-Role": "ORG_OWNER" },
        });
        assert.equal((await forged.json()).data.id, people.alice.profile.id);
        assert.equal(
          (await (await request("bob")).json()).data.id,
          people.bob.profile.id,
        );
      },
    );
    await t.test(
      "strict bounded writes reject mass assignment and private fields without mutation",
      async () => {
        const before = await owner.userProfile.findUniqueOrThrow({
          where: { id: people.alice.profile.id },
        });
        const count = await owner.auditOutbox.count();
        for (const extra of [
          { id: people.bob.profile.id },
          { userId: people.bob.id },
          { workspaceId: people.bob.personalWorkspace.id },
          { contact: { email: "private@example.invalid" } },
          { email: "private@example.invalid" },
          { embedding: [1] },
          { grants: [] },
          { onboardingCompletedAt: new Date().toISOString() },
          { role: "USER" },
          { revision: 99 },
          { experiences: [] },
          { fullName: "  " },
          { fullName: "x".repeat(201) },
          { location: "x".repeat(201) },
          { professionalSummary: "x".repeat(5001) },
          { expectedRevision: "2" },
        ]) {
          const response = await request("alice", {
            method: "PUT",
            body: await update(extra),
          });
          assert.equal(response.status, 422);
          assert.equal(
            (await response.text()).includes("private@example.invalid"),
            false,
          );
        }
        assert.deepEqual(
          await owner.userProfile.findUniqueOrThrow({
            where: { id: people.alice.profile.id },
          }),
          before,
        );
        assert.equal(await owner.auditOutbox.count(), count);
      },
    );
    await t.test(
      "concurrent writes with one revision have one winner and one audit event",
      async () => {
        const body = await update();
        const before = await owner.auditOutbox.count();
        const replies = await Promise.all([
          request("alice", {
            method: "PUT",
            body: { ...body, professionalSummary: "Synthetic competing A" },
          }),
          request("alice", {
            method: "PUT",
            body: { ...body, professionalSummary: "Synthetic competing B" },
          }),
        ]);
        assert.deepEqual(
          replies.map((response) => response.status).sort(),
          [200, 409],
        );
        assert.equal(await owner.auditOutbox.count(), before + 1);
        const record = await owner.userProfile.findUniqueOrThrow({
          where: { id: people.alice.profile.id },
        });
        assert.equal(record.revision, body.expectedRevision + 1);
        assert.equal(
          (await request("alice", { method: "PUT", body })).status,
          409,
        );
        assert.equal(await owner.auditOutbox.count(), before + 1);
      },
    );
    await t.test(
      "audit COMMIT failure withholds reads, rolls back writes and denials, then recovers",
      async () => {
        const before = await owner.userProfile.findUniqueOrThrow({
          where: { id: people.alice.profile.id },
        });
        const count = await owner.auditOutbox.count();
        await admin.query(
          `CREATE FUNCTION reject_profile_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic private audit error'; END; $$`,
        );
        await admin.query(
          `CREATE CONSTRAINT TRIGGER reject_profile_audit AFTER INSERT ON "AuditOutbox" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reject_profile_audit()`,
        );
        try {
          for (const options of [
            {},
            { method: "PUT", body: await update() },
            { headers: { "X-Workspace-Id": people.bob.personalWorkspace.id } },
          ]) {
            const response = await request("alice", options);
            assert.equal(response.status, 503);
            const body = await response.json();
            assert.equal(body.error.code, "profile_unavailable");
            assert.equal("data" in body, false);
            assert.equal(JSON.stringify(body).includes("private"), false);
          }
          assert.deepEqual(
            await owner.userProfile.findUniqueOrThrow({
              where: { id: people.alice.profile.id },
            }),
            before,
          );
          assert.equal(await owner.auditOutbox.count(), count);
        } finally {
          await admin.query(
            'DROP TRIGGER reject_profile_audit ON "AuditOutbox"',
          );
          await admin.query("DROP FUNCTION reject_profile_audit()");
        }
        assert.equal((await request()).status, 200);
        assert.equal(
          (await request("alice", { method: "PUT", body: await update() }))
            .status,
          200,
        );
      },
    );
    await t.test(
      "denied and success events deliver through restricted real HTTP without widening rejected scope",
      async () => {
        const key = randomBytes(32).toString("hex");
        const recipient = createWorkspaceAuditApp({
          db: runtime.auditIngest,
          relayKey: key,
        });
        const server = serve({
          fetch: recipient.fetch,
          hostname: "127.0.0.1",
          port: 0,
        });
        servers.push(server);
        await once(server, "listening");
        const send = createLocalAuditHttpTransport({
          endpoint: `http://127.0.0.1:${server.address().port}/internal/audit/events`,
          key,
        });
        const result = await deliverAuditOutbox(runtime.auditRelay, send, {
          batchSize: 100,
          leaseMs: 120000,
        });
        assert.equal(result.blocked, 0);
        assert.equal(result.retried, 0);
        assert.equal(result.delivered, result.claimed);
        assert.ok(result.delivered > 0);
        const denied = await owner.auditEvent.findMany({
          where: { action: "authorization.denied" },
        });
        assert.equal(denied.length, 5);
        for (const event of denied) {
          assert.equal(event.outcome, "denied");
          assert.equal(event.resourceType, "workspace");
          assert.equal(event.resourceId, people.alice.personalWorkspace.id);
          assert.equal(event.workspaceId, people.alice.personalWorkspace.id);
        }
        const invalid = {
          ...(
            await owner.auditOutbox.findFirstOrThrow({
              where: {
                payload: { path: ["action"], equals: "authorization.denied" },
              },
            })
          ).payload,
          eventId: randomUUID(),
          resourceType: "profile",
          resourceId: people.bob.profile.id,
        };
        await assert.rejects(send(invalid), { code: "invalid_scope" });
        await assert.rejects(
          send({
            ...invalid,
            resourceType: "workspace",
            resourceId: people.bob.personalWorkspace.id,
          }),
          { code: "invalid_scope" },
        );
        const valid = {
          ...invalid,
          resourceType: "workspace",
          resourceId: people.alice.personalWorkspace.id,
        };
        await send(valid);
        await send(valid);
        assert.equal(
          await owner.auditEvent.count({ where: { id: valid.eventId } }),
          1,
        );
        await assert.rejects(
          send({
            ...valid,
            metadata: { ...valid.metadata, reasonCode: "changed_reason" },
          }),
          { code: "event_conflict" },
        );
      },
    );
    await t.test(
      "revocation/expiry prevents profile access without affecting the other owner",
      async () => {
        const before = await owner.auditOutbox.count();
        await assert.rejects(
          profiles.read({
            actor: {
              userId: people.alice.id,
              personalWorkspaceId: people.alice.personalWorkspace.id,
              expiresAt: Date.now() - 1,
            },
            correlationId: randomUUID(),
          }),
          { code: "unauthenticated" },
        );
        await auth.request("/api/v1/auth/logout", {
          method: "POST",
          headers: {
            Cookie: credentials.alice.cookie,
            Origin: "http://localhost:3000",
          },
        });
        assert.equal((await request()).status, 401);
        assert.equal(
          (await request("alice", { method: "PUT", body: await update() }))
            .status,
          401,
        );
        assert.equal(await owner.auditOutbox.count(), before);
        assert.equal((await request("bob")).status, 200);
      },
    );
    await t.test(
      "auth transport outage yields unavailable without private data or domain work",
      async () => {
        await close(authServer);
        servers.splice(servers.indexOf(authServer), 1);
        const before = await owner.auditOutbox.count();
        const response = await request("bob");
        assert.equal(response.status, 503);
        const body = await response.json();
        assert.equal("data" in body, false);
        assert.equal(await owner.auditOutbox.count(), before);
      },
    );
  } finally {
    for (const server of servers) await close(server);
    await Promise.all([
      owner.$disconnect(),
      ...Object.values(runtime).map((db) => db.$disconnect()),
    ]);
    await admin.end();
    await lifecycle.query(
      `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`,
    );
    for (const role of Object.values(names))
      await lifecycle.query(`DROP ROLE IF EXISTS "${role}"`);
    await lifecycle.end();
  }
});
