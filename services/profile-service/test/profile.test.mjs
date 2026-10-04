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
    for (const name of ["alice", "bob", "charlie", "dana", "erin"])
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
          ...(["charlie", "dana", "erin"].includes(name)
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
        assert.equal(
          (
            await request("charlie", {
              path: "/draft",
              method: "PUT",
              body: {
                expectedRevision: 1,
                professionalSummary: "Synthetic draft",
              },
            })
          ).status,
          404,
        );
        assert.equal(await owner.userProfile.count(), 2);
        assert.equal(await owner.auditOutbox.count(), before);
      },
    );
    await t.test(
      "creation rejects incomplete/oversized fields and authority/contact mass assignment before saving",
      async () => {
        const before = await owner.auditOutbox.count();
        const userBefore = await owner.user.findUniqueOrThrow({
          where: { id: people.charlie.id },
        });
        const invalid = [
          {},
          { fullName: " " },
          { fullName: "x".repeat(201) },
          { fullName: "Synthetic", location: "x".repeat(201) },
          { fullName: "Synthetic", professionalSummary: "x".repeat(5001) },
          { fullName: "Synthetic", location: 1 },
          ...Object.entries({
            id: randomUUID(),
            userId: people.bob.id,
            workspaceId: people.bob.personalWorkspace.id,
            contact: { email: "private@example.invalid" },
            email: "private@example.invalid",
            phone: "synthetic-private",
            address: "synthetic-private",
            role: "ORG_OWNER",
            onboardingCompletedAt: new Date().toISOString(),
            embedding: [1, 2, 3],
            expectedRevision: 1,
          }).map(([key, value]) => ({ fullName: "Synthetic", [key]: value })),
        ];
        for (const body of invalid)
          assert.equal(
            (await request("charlie", { method: "POST", body })).status,
            422,
          );
        assert.equal(
          await owner.userProfile.count({
            where: { userId: people.charlie.id },
          }),
          0,
        );
        assert.equal(await owner.auditOutbox.count(), before);
        assert.deepEqual(
          await owner.user.findUniqueOrThrow({
            where: { id: people.charlie.id },
          }),
          userBefore,
        );
      },
    );
    await t.test(
      "creation denies a foreign workspace before a missing profile and records only owned scope",
      async () => {
        for (const selector of [
          people.bob.personalWorkspace.id,
          "",
          "malformed-selector",
        ]) {
          const response = await request("charlie", {
            method: "POST",
            body: { fullName: "Synthetic" },
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
            people.charlie.personalWorkspace.id,
          );
          assert.equal(
            event.payload.resourceId,
            people.charlie.personalWorkspace.id,
          );
          assert.equal(event.payload.metadata.permission, "profile.create");
          if (selector)
            assert.equal(
              JSON.stringify(event.payload).includes(selector),
              false,
            );
        }
        assert.equal(
          await owner.userProfile.count({
            where: { userId: people.charlie.id },
          }),
          0,
        );
      },
    );
    await t.test(
      "POST creates an explicitly supplied professional profile with atomic content-free audit and reload",
      async () => {
        const userBefore = await owner.user.findUniqueOrThrow({
          where: { id: people.charlie.id },
        });
        const contacts = await owner.userContact.count();
        const response = await request("charlie", {
          method: "POST",
          body: { fullName: "  User supplied synthetic name  " },
        });
        assert.equal(response.status, 201);
        assert.equal(response.headers.get("Cache-Control"), "no-store");
        const { data, requestId } = await response.json();
        assert.deepEqual(data, {
          id: data.id,
          fullName: "User supplied synthetic name",
          location: null,
          professionalSummary: null,
          revision: 1,
        });
        const row = await owner.userProfile.findUniqueOrThrow({
          where: { userId: people.charlie.id },
        });
        assert.equal(row.id, data.id);
        assert.equal(row.onboardingCompletedAt, null);
        assert.equal(await owner.userContact.count(), contacts);
        assert.deepEqual(
          await owner.user.findUniqueOrThrow({
            where: { id: people.charlie.id },
          }),
          userBefore,
        );
        const event = await owner.auditOutbox.findFirstOrThrow({
          where: { payload: { path: ["correlationId"], equals: requestId } },
        });
        assert.equal(event.payload.action, "profile.updated");
        assert.equal(event.payload.resourceId, data.id);
        assert.equal(event.payload.actorUserId, people.charlie.id);
        assert.deepEqual(event.payload.metadata, {
          permission: "profile.create",
          status: "initialized",
        });
        assert.equal(
          JSON.stringify(event.payload).includes(data.fullName),
          false,
        );
        assert.deepEqual((await (await request("charlie")).json()).data, data);
        const saved = await request("charlie", {
          method: "PUT",
          body: {
            fullName: data.fullName,
            location: "Synthetic city",
            professionalSummary: null,
            expectedRevision: 1,
          },
        });
        assert.equal(saved.status, 200);
        assert.equal((await saved.json()).data.revision, 2);
      },
    );
    await t.test(
      "repeated or concurrent creation creates one profile and event without overwriting an existing profile",
      async () => {
        const before = await owner.auditOutbox.count();
        const replies = await Promise.all([
          request("dana", {
            method: "POST",
            body: { fullName: "Synthetic competing A" },
          }),
          request("dana", {
            method: "POST",
            body: {
              fullName: "Synthetic competing B",
              location: "Synthetic city",
              professionalSummary: "User supplied synthetic facts",
            },
          }),
        ]);
        assert.deepEqual(
          replies.map((response) => response.status).sort(),
          [201, 409],
        );
        const rejected = replies.find((response) => response.status === 409);
        assert.equal((await rejected.json()).error.code, "profile_exists");
        assert.equal(
          await owner.userProfile.count({ where: { userId: people.dana.id } }),
          1,
        );
        assert.equal(await owner.auditOutbox.count(), before + 1);
        const existing = await owner.userProfile.findUniqueOrThrow({
          where: { userId: people.dana.id },
        });
        assert.equal(
          (
            await request("dana", {
              method: "POST",
              body: { fullName: "Attempted overwrite" },
            })
          ).status,
          409,
        );
        assert.deepEqual(
          await owner.userProfile.findUniqueOrThrow({
            where: { userId: people.dana.id },
          }),
          existing,
        );
        assert.equal(await owner.auditOutbox.count(), before + 1);
      },
    );
    await t.test(
      "audit COMMIT failure rolls back new profile creation and retry recovers without contacts or completion",
      async () => {
        const before = await owner.auditOutbox.count();
        await admin.query(
          "CREATE FUNCTION reject_creation_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic private audit error'; END; $$",
        );
        await admin.query(
          'CREATE CONSTRAINT TRIGGER reject_creation_audit AFTER INSERT ON "AuditOutbox" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reject_creation_audit()',
        );
        try {
          const response = await request("erin", {
            method: "POST",
            body: { fullName: "Synthetic retry name" },
          });
          assert.equal(response.status, 503);
          const body = await response.json();
          assert.equal("data" in body, false);
          assert.equal(JSON.stringify(body).includes("private"), false);
          assert.equal(
            await owner.userProfile.count({
              where: { userId: people.erin.id },
            }),
            0,
          );
          assert.equal(await owner.auditOutbox.count(), before);
        } finally {
          await admin.query(
            'DROP TRIGGER reject_creation_audit ON "AuditOutbox"',
          );
          await admin.query("DROP FUNCTION reject_creation_audit()");
        }
        assert.equal(
          (
            await request("erin", {
              method: "POST",
              body: { fullName: "Synthetic retry name" },
            })
          ).status,
          201,
        );
        assert.equal(
          await owner.userProfile.count({ where: { userId: people.erin.id } }),
          1,
        );
        assert.equal(await owner.auditOutbox.count(), before + 1);
      },
    );
    await t.test(
      "draft saves normalize only supplied fields, reload, clear nullable values and preserve private/unrelated data",
      async () => {
        const before = await owner.userProfile.findUniqueOrThrow({
          where: { id: people.alice.profile.id },
        });
        const contact = await owner.userContact.findUniqueOrThrow({
          where: { profileId: before.id },
        });
        const other = await owner.userProfile.findUniqueOrThrow({
          where: { id: people.bob.profile.id },
        });
        const response = await request("alice", {
          path: "/draft",
          method: "PUT",
          body: {
            expectedRevision: before.revision,
            location: "  Synthetic City  ",
            professionalSummary: "  Synthetic résumé facts — user supplied.  ",
          },
        });
        assert.equal(response.status, 200);
        const { data, requestId } = await response.json();
        assert.deepEqual(data, {
          id: before.id,
          fullName: before.fullName,
          location: "Synthetic City",
          professionalSummary: "Synthetic résumé facts — user supplied.",
          revision: before.revision + 1,
        });
        const event = await owner.auditOutbox.findFirstOrThrow({
          where: { payload: { path: ["correlationId"], equals: requestId } },
        });
        assert.equal(event.payload.action, "profile.updated");
        assert.equal(event.payload.resourceId, before.id);
        assert.deepEqual(event.payload.metadata, {
          permission: "profile.update",
          status: "draft_saved",
        });
        assert.equal(
          JSON.stringify(event.payload).includes("Synthetic"),
          false,
        );
        assert.deepEqual((await (await request()).json()).data, data);
        const renamed = await request("alice", {
          path: "/draft",
          method: "PUT",
          body: {
            expectedRevision: data.revision,
            fullName: "  Synthetic renamed draft  ",
          },
        });
        assert.equal(renamed.status, 200);
        const renamedData = (await renamed.json()).data;
        assert.deepEqual(renamedData, {
          ...data,
          fullName: "Synthetic renamed draft",
          revision: data.revision + 1,
        });
        const cleared = await request("alice", {
          path: "/draft",
          method: "PUT",
          body: {
            expectedRevision: renamedData.revision,
            location: null,
            professionalSummary: null,
          },
        });
        assert.equal(cleared.status, 200);
        const clearedData = (await cleared.json()).data;
        assert.deepEqual(clearedData, {
          ...renamedData,
          location: null,
          professionalSummary: null,
          revision: renamedData.revision + 1,
        });
        assert.deepEqual((await (await request()).json()).data, clearedData);
        assert.deepEqual(
          await owner.userContact.findUniqueOrThrow({
            where: { profileId: before.id },
          }),
          contact,
        );
        const after = await owner.userProfile.findUniqueOrThrow({
          where: { id: before.id },
        });
        assert.deepEqual(after, {
          ...before,
          ...clearedData,
          updatedAt: after.updatedAt,
        });
        assert.equal(after.onboardingCompletedAt, null);
        assert.deepEqual(
          await owner.userProfile.findUniqueOrThrow({
            where: { id: other.id },
          }),
          other,
        );
      },
    );
    await t.test(
      "draft patches reject empty, invalid and authority/contact fields without advancing revisions or capturing success",
      async () => {
        const before = await owner.userProfile.findUniqueOrThrow({
          where: { id: people.alice.profile.id },
        });
        const count = await owner.auditOutbox.count();
        const valid = {
          expectedRevision: before.revision,
          professionalSummary: "Synthetic draft",
        };
        for (const body of [
          null,
          [],
          {},
          { expectedRevision: before.revision },
          { professionalSummary: "Missing revision" },
          ...[
            { expectedRevision: 0 },
            { expectedRevision: 1.5 },
            { expectedRevision: "1" },
            { expectedRevision: 2147483647 },
            { fullName: null },
            { fullName: " " },
            { fullName: "x".repeat(201) },
            { location: 1 },
            { location: "x".repeat(201) },
            { professionalSummary: "x".repeat(5001) },
            { id: people.bob.profile.id },
            { userId: people.bob.id },
            { workspaceId: people.bob.personalWorkspace.id },
            { contact: { email: "private@example.invalid" } },
            { email: "private@example.invalid" },
            { phone: "synthetic-private" },
            { onboardingCompletedAt: new Date().toISOString() },
            { revision: 99 },
            { role: "ORG_OWNER" },
            { grants: [] },
            { embedding: [1, 2, 3] },
            { experiences: [] },
          ].map((extra) => ({ ...valid, ...extra })),
        ]) {
          const response = await request("alice", {
            path: "/draft",
            method: "PUT",
            body,
          });
          assert.equal(response.status, 422);
          assert.equal((await response.text()).includes("private"), false);
        }
        assert.deepEqual(
          await owner.userProfile.findUniqueOrThrow({
            where: { id: before.id },
          }),
          before,
        );
        assert.equal(await owner.auditOutbox.count(), count);
      },
    );
    await t.test(
      "draft and full saves share one revision with one concurrent winner and recover through GET",
      async () => {
        for (const secondPath of ["/draft", ""]) {
          const before = await owner.userProfile.findUniqueOrThrow({
            where: { id: people.alice.profile.id },
          });
          const count = await owner.auditOutbox.count();
          const draft = {
            expectedRevision: before.revision,
            professionalSummary: "Synthetic draft contender",
          };
          const replies = await Promise.all([
            request("alice", { path: "/draft", method: "PUT", body: draft }),
            request("alice", {
              path: secondPath,
              method: "PUT",
              body: {
                ...(secondPath
                  ? {}
                  : { fullName: before.fullName, location: before.location }),
                expectedRevision: before.revision,
                professionalSummary: "Synthetic second contender",
              },
            }),
          ]);
          assert.deepEqual(
            replies.map((response) => response.status).sort(),
            [200, 409],
          );
          const winning = (
            await replies.find((response) => response.status === 200).json()
          ).data;
          assert.equal(
            (await replies.find((response) => response.status === 409).json())
              .error.code,
            "revision_conflict",
          );
          assert.equal(winning.revision, before.revision + 1);
          assert.equal(await owner.auditOutbox.count(), count + 1);
          const stale = await request("alice", {
            path: "/draft",
            method: "PUT",
            body: draft,
          });
          assert.equal(stale.status, 409);
          assert.equal((await stale.json()).error.code, "revision_conflict");
          assert.equal(await owner.auditOutbox.count(), count + 1);
          assert.deepEqual((await (await request()).json()).data, winning);
        }
      },
    );
    await t.test(
      "completion racing a draft save rejects it without reopening setup; normal completed-profile edits still work",
      async () => {
        const before = await owner.userProfile.findUniqueOrThrow({
          where: { userId: people.erin.id },
        });
        const count = await owner.auditOutbox.count();
        const completedAt = new Date("2026-10-04T00:00:00.000Z");
        let pending;
        let transactionOpen = true;
        await admin.query("BEGIN");
        try {
          // Hold the row lock so the draft reaches the database before completion commits.
          await admin.query(
            'UPDATE "UserProfile" SET "onboardingCompletedAt" = $1 WHERE id = $2',
            [completedAt.toISOString(), before.id],
          );
          pending = request("erin", {
            path: "/draft",
            method: "PUT",
            body: {
              expectedRevision: before.revision,
              professionalSummary: "Attempted reopened draft",
            },
          });
          let blocked = false;
          for (let attempt = 0; attempt < 100; attempt++) {
            const result = await admin.query(
              "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND usename = $1 AND wait_event_type = 'Lock') AS blocked",
              [names.profile],
            );
            if (result.rows[0].blocked) {
              blocked = true;
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
          assert.equal(
            blocked,
            true,
            "Draft must be waiting on the completion row lock",
          );
          await admin.query("COMMIT");
          transactionOpen = false;
        } finally {
          if (transactionOpen) await admin.query("ROLLBACK");
        }
        const response = await pending;
        assert.equal(response.status, 409);
        assert.equal((await response.json()).error.code, "onboarding_complete");
        const completed = await owner.userProfile.findUniqueOrThrow({
          where: { id: before.id },
        });
        assert.deepEqual(completed, {
          ...before,
          onboardingCompletedAt: completedAt,
        });
        for (const expectedRevision of [before.revision, before.revision + 1]) {
          const retry = await request("erin", {
            path: "/draft",
            method: "PUT",
            body: {
              expectedRevision,
              location: "Attempted completed draft",
            },
          });
          assert.equal(retry.status, 409);
          assert.equal((await retry.json()).error.code, "onboarding_complete");
        }
        assert.equal(await owner.auditOutbox.count(), count);
        const normal = await request("erin", {
          method: "PUT",
          body: {
            expectedRevision: before.revision,
            fullName: before.fullName,
            location: "Synthetic completed edit",
            professionalSummary: null,
          },
        });
        assert.equal(normal.status, 200);
        assert.equal((await normal.json()).data.revision, before.revision + 1);
        assert.deepEqual(
          (
            await owner.userProfile.findUniqueOrThrow({
              where: { id: before.id },
            })
          ).onboardingCompletedAt,
          completedAt,
        );
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
              path: "/draft",
              method: "PUT",
              headers: { "X-Workspace-Id": people.bob.personalWorkspace.id },
              body: {
                expectedRevision: (await update()).expectedRevision,
                professionalSummary: "Synthetic denied draft",
              },
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
            {
              path: "/draft",
              method: "PUT",
              body: {
                expectedRevision: before.revision,
                professionalSummary: "Synthetic rolled back draft",
              },
            },
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
        assert.equal(
          (
            await request("alice", {
              path: "/draft",
              method: "PUT",
              body: {
                expectedRevision: (await update()).expectedRevision,
                professionalSummary: "Synthetic retry draft",
              },
            })
          ).status,
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
        assert.equal(denied.length, 9);
        assert.equal(
          denied.filter((event) => event.actorUserId === people.alice.id)
            .length,
          6,
        );
        assert.equal(
          denied.filter((event) => event.actorUserId === people.charlie.id)
            .length,
          3,
        );
        for (const event of denied) {
          const person = Object.values(people).find(
            (person) => person.id === event.actorUserId,
          );
          assert.ok(person);
          assert.equal(event.outcome, "denied");
          assert.equal(event.resourceType, "workspace");
          assert.equal(event.resourceId, person.personalWorkspace.id);
          assert.equal(event.workspaceId, person.personalWorkspace.id);
        }
        const initialized = await owner.auditEvent.findMany({
          where: {
            action: "profile.updated",
            metadata: { path: ["permission"], equals: "profile.create" },
          },
        });
        assert.equal(initialized.length, 3);
        for (const event of initialized) {
          const person = Object.values(people).find(
            (person) => person.id === event.actorUserId,
          );
          const profile = await owner.userProfile.findUniqueOrThrow({
            where: { userId: person.id },
          });
          assert.equal(event.workspaceId, person.personalWorkspace.id);
          assert.equal(event.resourceType, "profile");
          assert.equal(event.resourceId, profile.id);
          assert.deepEqual(event.metadata, {
            permission: "profile.create",
            status: "initialized",
          });
        }
        const drafts = await owner.auditEvent.findMany({
          where: {
            action: "profile.updated",
            metadata: { path: ["status"], equals: "draft_saved" },
          },
        });
        const capturedDrafts = await owner.auditOutbox.count({
          where: {
            payload: { path: ["metadata", "status"], equals: "draft_saved" },
          },
        });
        assert.ok(drafts.length >= 5);
        assert.equal(drafts.length, capturedDrafts);
        for (const event of drafts) {
          assert.equal(event.actorUserId, people.alice.id);
          assert.equal(event.workspaceId, people.alice.personalWorkspace.id);
          assert.equal(event.resourceId, people.alice.profile.id);
          assert.deepEqual(event.metadata, {
            permission: "profile.update",
            status: "draft_saved",
          });
        }
        const invalid = {
          ...(
            await owner.auditOutbox.findFirstOrThrow({
              where: {
                AND: [
                  {
                    payload: {
                      path: ["action"],
                      equals: "authorization.denied",
                    },
                  },
                  {
                    payload: { path: ["actorUserId"], equals: people.alice.id },
                  },
                ],
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
        await assert.rejects(
          profiles.saveDraft(
            {
              actor: {
                userId: people.alice.id,
                personalWorkspaceId: people.alice.personalWorkspace.id,
                expiresAt: Date.now() - 1,
              },
              correlationId: randomUUID(),
            },
            { expectedRevision: 1, professionalSummary: null },
          ),
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
          (
            await request("alice", {
              method: "POST",
              body: { fullName: "Synthetic revoked actor" },
            })
          ).status,
          401,
        );
        assert.equal(
          (await request("alice", { method: "PUT", body: await update() }))
            .status,
          401,
        );
        assert.equal(
          (
            await request("alice", {
              path: "/draft",
              method: "PUT",
              body: { expectedRevision: 1, professionalSummary: null },
            })
          ).status,
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
