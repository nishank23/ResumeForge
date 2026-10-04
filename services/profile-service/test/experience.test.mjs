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

// Only disposable databases on the managed local cluster; never a root/hosted URL.
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
const databaseName = `rf_experience_test_${suffix}`;
const names = runtimeRoleNames(`rf_exp_${suffix.slice(0, 12)}`);
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
  Object.keys(names).map((service) => {
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
const cookie = (response, key) =>
  response.headers
    .getSetCookie()
    .find((value) => value.startsWith(`${key}=`))
    ?.split(";")[0];

test("owned Work Experience with real actor transport, revisioned persistence and atomic audit", async (t) => {
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
    await provisionRuntimeRoles(admin, {
      databaseName,
      prefix: `rf_exp_${suffix.slice(0, 12)}`,
      passwords,
    });
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
                    professionalSummary: "Synthetic master summary",
                    contact: {
                      create: {
                        email: `${name}-private@example.invalid`,
                        phone: "synthetic-private-phone",
                      },
                    },
                    ...(name === "bob"
                      ? {
                          experiences: {
                            create: {
                              company: "Synthetic Bob exclusive",
                              title: "Synthetic Bob role",
                              keywords: ["synthetic-private-keyword"],
                              metrics: { private: "synthetic-private-metric" },
                            },
                          },
                        }
                      : {}),
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
    const root = `http://127.0.0.1:${profileServer.address().port}/api/v1/profile`;
    const endpoint = `${root}/experience`;
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
      { body, headers = {}, target = endpoint, ...options } = {},
    ) =>
      fetch(target, {
        ...options,
        headers: {
          Authorization: `Bearer ${credentials[name].token}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    const record = (name = "alice") =>
      owner.userProfile.findUniqueOrThrow({
        where: { userId: people[name].id },
      });
    const input = async (extra = {}, name = "alice") => ({
      expectedRevision: (await record(name)).revision,
      company: "Synthetic company",
      title: "Synthetic engineer",
      ...extra,
    });
    const replacement = async (extra = {}, name = "alice") => ({
      ...(await input({}, name)),
      location: null,
      startDate: null,
      endDate: null,
      isCurrent: false,
      bulletPoints: [],
      ...extra,
    });
    const firstEntry = (name = "alice") =>
      owner.experience.findFirstOrThrow({
        where: { profileId: people[name].profile.id },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      });
    const eventFor = (requestId) =>
      owner.auditOutbox.findFirstOrThrow({
        where: { payload: { path: ["correlationId"], equals: requestId } },
      });
    const waitForLock = async () => {
      for (let attempt = 0; attempt < 100; attempt++) {
        const result = await admin.query(
          "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND usename = $1 AND wait_event_type = 'Lock') AS blocked",
          [names.profile],
        );
        if (result.rows[0].blocked) return;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.fail("Concurrent write must be waiting on the parent lock");
    };

    await t.test(
      "missing profile and unauthenticated requests do not create rows or expose data",
      async () => {
        const before = await owner.auditOutbox.count();
        for (const method of ["GET", "POST"]) {
          assert.equal(
            (
              await request("charlie", {
                method,
                ...(method === "POST" ? { body: await input() } : {}),
              })
            ).status,
            404,
          );
          assert.equal(
            (
              await fetch(endpoint, {
                method,
                ...(method === "POST"
                  ? {
                      body: "malformed",
                      headers: { "Content-Type": "application/json" },
                    }
                  : {}),
              })
            ).status,
            401,
          );
        }
        assert.equal(await owner.userProfile.count(), 2);
        assert.equal(await owner.experience.count(), 1);
        assert.equal(await owner.auditOutbox.count(), before);
      },
    );
    await t.test(
      "GET returns only owned professional entries and a consistent revision, including empty/null-bullet sections",
      async () => {
        const response = await request();
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("Cache-Control"), "no-store");
        const { data, requestId } = await response.json();
        assert.deepEqual(data, {
          profileId: people.alice.profile.id,
          revision: 1,
          entries: [],
        });
        assert.equal(response.headers.get("X-Request-Id"), requestId);
        const event = await eventFor(requestId);
        assert.equal(event.payload.action, "profile.viewed");
        assert.deepEqual(event.payload.metadata, {
          permission: "profile.read",
          status: "experience_read",
        });
        const bob = await (await request("bob")).json();
        assert.equal(bob.data.entries.length, 1);
        assert.deepEqual(bob.data.entries[0].bulletPoints, []);
        assert.deepEqual(
          Object.keys(bob.data.entries[0]).sort(),
          [
            "id",
            "company",
            "title",
            "location",
            "startDate",
            "endDate",
            "isCurrent",
            "bulletPoints",
            "sortOrder",
          ].sort(),
        );
        assert.equal(JSON.stringify(bob).includes("private"), false);
      },
    );
    await t.test(
      "POST trims explicit user facts, appends a stable owned entry and advances only the master revision with audit",
      async () => {
        const before = await record();
        const contact = await owner.userContact.findUniqueOrThrow({
          where: { profileId: before.id },
        });
        const other = await record("bob");
        const response = await request("alice", {
          method: "POST",
          body: await input({
            company: "  Synthetic company  ",
            title: "  Synthetic résumé role  ",
            location: "  Synthetic City  ",
            startDate: "2020-02",
            endDate: "2022-01",
            bulletPoints: ["  Explicit synthetic fact.  "],
          }),
        });
        assert.equal(response.status, 201);
        const { data, requestId } = await response.json();
        assert.deepEqual(data, {
          profileId: before.id,
          revision: before.revision + 1,
          entry: {
            id: data.entry.id,
            company: "Synthetic company",
            title: "Synthetic résumé role",
            location: "Synthetic City",
            startDate: "2020-02",
            endDate: "2022-01",
            isCurrent: false,
            bulletPoints: ["Explicit synthetic fact."],
            sortOrder: 0,
          },
        });
        const row = await owner.experience.findUniqueOrThrow({
          where: { id: data.entry.id },
        });
        assert.equal(row.profileId, before.id);
        assert.equal(row.keywords, null);
        assert.equal(row.metrics, null);
        const after = await record();
        assert.deepEqual(after, {
          ...before,
          revision: before.revision + 1,
          updatedAt: after.updatedAt,
        });
        assert.deepEqual(await record("bob"), other);
        assert.deepEqual(
          await owner.userContact.findUniqueOrThrow({
            where: { profileId: before.id },
          }),
          contact,
        );
        const event = await eventFor(requestId);
        assert.equal(event.payload.action, "profile.updated");
        assert.equal(event.payload.resourceId, before.id);
        assert.deepEqual(event.payload.metadata, {
          permission: "profile.update",
          status: "experience_added",
        });
        assert.equal(
          JSON.stringify(event.payload).includes("Synthetic"),
          false,
        );
        assert.deepEqual((await (await request()).json()).data, {
          profileId: before.id,
          revision: data.revision,
          entries: [data.entry],
        });
      },
    );
    await t.test(
      "current roles/year precision and omitted optional facts survive reload; stale retries do not duplicate",
      async () => {
        const body = await input({ isCurrent: true, startDate: "2023" });
        const before = await owner.auditOutbox.count();
        const response = await request("alice", { method: "POST", body });
        assert.equal(response.status, 201);
        const { data } = await response.json();
        assert.equal(data.entry.startDate, "2023");
        assert.equal(data.entry.endDate, null);
        assert.equal(data.entry.location, null);
        assert.equal(data.entry.isCurrent, true);
        assert.deepEqual(data.entry.bulletPoints, []);
        assert.equal(data.entry.sortOrder, 1);
        const retry = await request("alice", { method: "POST", body });
        assert.equal(retry.status, 409);
        assert.equal((await retry.json()).error.code, "revision_conflict");
        assert.equal(
          await owner.experience.count({
            where: { profileId: people.alice.profile.id },
          }),
          2,
        );
        assert.equal(await owner.auditOutbox.count(), before + 1);
        assert.deepEqual(
          (await (await request()).json()).data.entries[1],
          data.entry,
        );
      },
    );
    await t.test(
      "strict bounds, date ranges and mass assignment reject without touching revision, rows or audit",
      async () => {
        const before = await record();
        const count = await owner.auditOutbox.count();
        const valid = await input();
        const invalid = [
          null,
          [],
          {},
          { ...valid, expectedRevision: undefined },
          ...[
            { company: " " },
            { company: "x".repeat(201) },
            { title: "" },
            { title: "x".repeat(201) },
            { location: "x".repeat(201) },
            { startDate: "2024-13" },
            { startDate: "2024-00" },
            { startDate: "0000" },
            { startDate: "24-01" },
            { startDate: "2024-1" },
            { startDate: "2024-02-01" },
            { startDate: "2024-02-01T00:00:00Z" },
            { startDate: "2024", endDate: "2023" },
            { startDate: "2024-06", endDate: "2024-05" },
            { endDate: "2024-01" },
            { isCurrent: true, startDate: "2020", endDate: "2024" },
            { isCurrent: "true" },
            { bulletPoints: null },
            { bulletPoints: [" "] },
            { bulletPoints: ["x".repeat(1001)] },
            { bulletPoints: Array(21).fill("Synthetic") },
            { expectedRevision: 0 },
            { expectedRevision: 1.5 },
            { expectedRevision: "1" },
            { expectedRevision: 2147483647 },
            { id: randomUUID() },
            { profileId: people.bob.profile.id },
            { userId: people.bob.id },
            { workspaceId: people.bob.personalWorkspace.id },
            { sortOrder: 10 },
            { revision: 99 },
            { contact: { phone: "synthetic-private" } },
            { email: "private@example.invalid" },
            { onboardingCompletedAt: new Date().toISOString() },
            { role: "ORG_OWNER" },
            { keywords: ["Invented"] },
            { metrics: { invented: 99 } },
            { technologies: ["Invented"] },
            { employmentType: "Full time" },
            { description: { type: "doc" } },
            { embedding: [1, 2] },
          ].map((extra) => ({ ...valid, ...extra })),
        ];
        for (const body of invalid) {
          const response = await request("alice", { method: "POST", body });
          assert.equal(response.status, 422);
          assert.equal((await response.text()).includes("private"), false);
        }
        assert.deepEqual(await record(), before);
        assert.equal(
          await owner.experience.count({ where: { profileId: before.id } }),
          2,
        );
        assert.equal(await owner.auditOutbox.count(), count);
      },
    );
    await t.test(
      "concurrent adds and professional draft edits share one winning revision without orphan rows/events",
      async () => {
        for (const competingDraft of [false, true]) {
          const body = await input();
          const count = await owner.auditOutbox.count();
          const entries = await owner.experience.count({
            where: { profileId: people.alice.profile.id },
          });
          const replies = await Promise.all([
            request("alice", { method: "POST", body }),
            competingDraft
              ? request("alice", {
                  target: `${root}/draft`,
                  method: "PUT",
                  body: {
                    expectedRevision: body.expectedRevision,
                    professionalSummary: "Synthetic competing draft",
                  },
                })
              : request("alice", {
                  method: "POST",
                  body: { ...body, title: "Synthetic second contender" },
                }),
          ]);
          assert.equal(
            replies.filter((response) => response.status === 409).length,
            1,
          );
          assert.equal(
            (await replies.find((response) => response.status === 409).json())
              .error.code,
            "revision_conflict",
          );
          const winner = replies.find((response) => response.status !== 409);
          assert.ok([200, 201].includes(winner.status));
          assert.equal(
            (await winner.json()).data.revision,
            body.expectedRevision + 1,
          );
          assert.equal(
            await owner.experience.count({
              where: { profileId: people.alice.profile.id },
            }),
            entries + (winner.status === 201 ? 1 : 0),
          );
          assert.equal(await owner.auditOutbox.count(), count + 1);
        }
        const reloaded = (await (await request()).json()).data;
        assert.deepEqual(
          reloaded.entries.map((entry) => entry.sortOrder),
          reloaded.entries.map((_, index) => index),
        );
      },
    );
    await t.test(
      "forged workspace, profile and identity selectors cannot expose or append another owner's entries",
      async () => {
        const other = await record("bob");
        const otherEntries = await owner.experience.findMany({
          where: { profileId: other.id },
        });
        for (const selector of [
          people.bob.personalWorkspace.id,
          "",
          "malformed",
        ]) {
          for (const method of ["GET", "POST"]) {
            const response = await request("alice", {
              method,
              headers: { "X-Workspace-Id": selector },
              ...(method === "POST" ? { body: await input() } : {}),
            });
            assert.equal(response.status, 403);
            const event = await eventFor((await response.json()).requestId);
            assert.equal(
              event.payload.workspaceId,
              people.alice.personalWorkspace.id,
            );
            assert.equal(
              event.payload.resourceId,
              people.alice.personalWorkspace.id,
            );
            assert.equal(event.payload.action, "authorization.denied");
            assert.equal(
              event.payload.metadata.permission,
              method === "GET" ? "profile.read" : "profile.update",
            );
            if (selector)
              assert.equal(
                JSON.stringify(event.payload).includes(selector),
                false,
              );
          }
        }
        assert.equal(
          (
            await request("alice", {
              target: `${endpoint}?profileId=${other.id}`,
            })
          ).status,
          422,
        );
        assert.equal(
          (
            await request("alice", {
              target: `${endpoint}/${otherEntries[0].id}`,
            })
          ).status,
          404,
        );
        const response = await request("alice", {
          headers: { "X-User-Id": people.bob.id, "X-Role": "ORG_OWNER" },
        });
        assert.equal(
          (await response.json()).data.profileId,
          people.alice.profile.id,
        );
        assert.deepEqual(await record("bob"), other);
        assert.deepEqual(
          await owner.experience.findMany({ where: { profileId: other.id } }),
          otherEntries,
        );
      },
    );
    await t.test(
      "entry capacity rolls back parent revision; oversized legacy lists fail closed without truncation",
      async () => {
        const before = await record();
        const existing = await owner.experience.findMany({
          where: { profileId: before.id },
        });
        const ids = Array.from({ length: 50 - existing.length }, () =>
          randomUUID(),
        );
        const overflowId = randomUUID();
        try {
          await owner.experience.createMany({
            data: ids.map((id, index) => ({
              id,
              profileId: before.id,
              company: "Synthetic capacity",
              title: "Synthetic role",
              sortOrder: existing.length + index,
            })),
          });
          const count = await owner.auditOutbox.count();
          const response = await request("alice", {
            method: "POST",
            body: await input(),
          });
          assert.equal(response.status, 409);
          assert.equal((await response.json()).error.code, "section_limit");
          assert.deepEqual(await record(), before);
          assert.equal(await owner.auditOutbox.count(), count);
          assert.equal(
            (await (await request()).json()).data.entries.length,
            50,
          );
          const edited = await request("alice", {
            target: `${endpoint}/${existing[0].id}`,
            method: "PUT",
            body: await replacement({ title: "Synthetic update at capacity" }),
          });
          assert.equal(edited.status, 200);
          assert.equal((await record()).revision, before.revision + 1);
          assert.equal(
            await owner.experience.count({ where: { profileId: before.id } }),
            50,
          );
          await owner.experience.create({
            data: {
              id: overflowId,
              profileId: before.id,
              company: "Synthetic overflow",
              title: "Synthetic role",
            },
          });
          const afterRead = await owner.auditOutbox.count();
          const overflow = await request();
          assert.equal(overflow.status, 503);
          assert.equal("data" in (await overflow.json()), false);
          assert.equal(await owner.auditOutbox.count(), afterRead);
        } finally {
          await owner.experience.deleteMany({
            where: { id: { in: [...ids, overflowId] }, profileId: before.id },
          });
        }
      },
    );
    await t.test(
      "exhausted append order rolls back without overwriting existing entries",
      async () => {
        const id = randomUUID();
        const before = await record();
        const count = await owner.auditOutbox.count();
        await owner.experience.create({
          data: {
            id,
            profileId: before.id,
            company: "Synthetic last order",
            title: "Synthetic role",
            sortOrder: 2147483647,
          },
        });
        try {
          const response = await request("alice", {
            method: "POST",
            body: await input(),
          });
          assert.equal(response.status, 409);
          assert.equal((await response.json()).error.code, "section_limit");
          assert.deepEqual(await record(), before);
          assert.equal(await owner.auditOutbox.count(), count);
          assert.equal(
            (await owner.experience.findUniqueOrThrow({ where: { id } }))
              .sortOrder,
            2147483647,
          );
        } finally {
          await owner.experience.delete({ where: { id } });
        }
      },
    );
    await t.test(
      "invalid legacy bullet JSON withholds the whole section and records no successful read",
      async () => {
        const id = randomUUID();
        const before = await owner.auditOutbox.count();
        await owner.experience.create({
          data: {
            id,
            profileId: people.alice.profile.id,
            company: "Synthetic invalid",
            title: "Synthetic role",
            bulletPoints: { unsupported: "synthetic-private" },
          },
        });
        try {
          const response = await request();
          assert.equal(response.status, 503);
          const body = await response.json();
          assert.equal("data" in body, false);
          assert.equal(JSON.stringify(body).includes("private"), false);
          assert.equal(await owner.auditOutbox.count(), before);
        } finally {
          await owner.experience.delete({ where: { id } });
        }
      },
    );
    await t.test(
      "audit COMMIT failure withholds reads and rolls back parent/entry creation, then retry recovers",
      async () => {
        const before = await record();
        const count = await owner.auditOutbox.count();
        const rows = await owner.experience.findMany({
          where: { profileId: before.id },
          orderBy: { sortOrder: "asc" },
        });
        await admin.query(
          "CREATE FUNCTION reject_experience_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic private audit failure'; END; $$",
        );
        await admin.query(
          'CREATE CONSTRAINT TRIGGER reject_experience_audit AFTER INSERT ON "AuditOutbox" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reject_experience_audit()',
        );
        try {
          for (const options of [
            {},
            { method: "POST", body: await input() },
            {
              target: `${endpoint}/${rows[0].id}`,
              method: "PUT",
              body: await replacement({
                title: "Synthetic rollback replacement",
              }),
            },
            { headers: { "X-Workspace-Id": people.bob.personalWorkspace.id } },
          ]) {
            const response = await request("alice", options);
            assert.equal(response.status, 503);
            const body = await response.json();
            assert.equal("data" in body, false);
            assert.equal(JSON.stringify(body).includes("private"), false);
          }
          assert.deepEqual(await record(), before);
          assert.deepEqual(
            await owner.experience.findMany({
              where: { profileId: before.id },
              orderBy: { sortOrder: "asc" },
            }),
            rows,
          );
          assert.equal(await owner.auditOutbox.count(), count);
        } finally {
          await admin.query(
            'DROP TRIGGER reject_experience_audit ON "AuditOutbox"',
          );
          await admin.query("DROP FUNCTION reject_experience_audit()");
        }
        assert.equal((await request()).status, 200);
        assert.equal(
          (await request("alice", { method: "POST", body: await input() }))
            .status,
          201,
        );
        assert.equal(
          (
            await request("alice", {
              target: `${endpoint}/${rows[0].id}`,
              method: "PUT",
              body: await replacement({ title: "Synthetic retry replacement" }),
            })
          ).status,
          200,
        );
      },
    );
    await t.test(
      "a list snapshot holds its parent revision while an actual concurrent append waits",
      async () => {
        const before = await record();
        const rows = await owner.experience.count({
          where: { profileId: before.id },
        });
        let release, started;
        const gate = new Promise((resolve) => {
          release = resolve;
        });
        const ready = new Promise((resolve) => {
          started = resolve;
        });
        // Pause only between the real parent lock and real child query; all SQL/audit still uses the restricted client.
        const paused = new Proxy(runtime.profile, {
          get(db, key) {
            if (key !== "$transaction") return Reflect.get(db, key);
            return (operation) =>
              db.$transaction((tx) =>
                operation(
                  new Proxy(tx, {
                    get(transaction, field) {
                      if (field !== "experience")
                        return Reflect.get(transaction, field);
                      return new Proxy(transaction.experience, {
                        get(model, query) {
                          if (query !== "findMany")
                            return Reflect.get(model, query);
                          return async (args) => {
                            started();
                            await gate;
                            return model.findMany(args);
                          };
                        },
                      });
                    },
                  }),
                ),
              );
          },
        });
        const resolved = await resolveActor(
          `Bearer ${credentials.alice.token}`,
        );
        assert.equal(resolved.status, "authenticated");
        const read = createProfileUseCases(paused).listExperience({
          actor: resolved.actor,
          correlationId: randomUUID(),
        });
        let write;
        try {
          await Promise.race([
            ready,
            read.then(() =>
              assert.fail("List must reach the locked snapshot pause"),
            ),
          ]);
          write = request("alice", { method: "POST", body: await input() });
          await waitForLock();
        } finally {
          release();
        }
        const snapshot = await read;
        assert.equal(snapshot.revision, before.revision);
        assert.equal(snapshot.entries.length, rows);
        assert.equal((await write).status, 201);
        const next = (await (await request()).json()).data;
        assert.equal(next.revision, before.revision + 1);
        assert.equal(next.entries.length, rows + 1);
      },
    );
    await t.test(
      "entry replacement preserves identity, order, metadata, contacts and unrelated facts",
      async () => {
        const target = await firstEntry();
        await owner.experience.update({
          where: { id: target.id },
          data: {
            keywords: ["synthetic-private-keyword"],
            metrics: { private: "synthetic-private-metric" },
          },
        });
        const original = await firstEntry();
        const before = await record();
        const unrelated = await owner.experience.findMany({
          where: { NOT: { id: target.id } },
        });
        const contacts = await owner.userContact.findMany();
        const body = await replacement({
          company: "  Synthetic replacement company  ",
          title: " Synthetic replacement role ",
          location: " Synthetic city ",
          startDate: "2022",
          endDate: "2024-03",
          bulletPoints: [
            " Synthetic user-supplied achievement ",
            "Synthetic second achievement",
          ],
        });
        const response = await request("alice", {
          target: `${endpoint}/${target.id}`,
          method: "PUT",
          body,
        });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("Cache-Control"), "no-store");
        const result = await response.json();
        const after = await record();
        assert.deepEqual(after, {
          ...before,
          revision: before.revision + 1,
          updatedAt: after.updatedAt,
        });
        const row = await firstEntry();
        const { expectedRevision: _revision, ...fields } = body;
        const normalized = {
          ...fields,
          company: fields.company.trim(),
          title: fields.title.trim(),
          location: fields.location.trim(),
          bulletPoints: fields.bulletPoints.map((value) => value.trim()),
        };
        assert.deepEqual(row, { ...original, ...normalized });
        const {
          keywords: _keywords,
          metrics: _metrics,
          profileId: _profileId,
          ...dto
        } = row;
        assert.deepEqual(result.data, {
          profileId: before.id,
          revision: after.revision,
          entry: dto,
        });
        assert.deepEqual(
          await owner.experience.findMany({
            where: { NOT: { id: target.id } },
          }),
          unrelated,
        );
        assert.deepEqual(await owner.userContact.findMany(), contacts);
        const event = await eventFor(result.requestId);
        assert.deepEqual(event.payload.metadata, {
          permission: "profile.update",
          status: "experience_updated",
        });
        assert.equal(event.payload.resourceId, before.id);
        assert.equal(
          JSON.stringify(event.payload).includes("Synthetic"),
          false,
        );
        const reload = (await (await request()).json()).data;
        assert.deepEqual(
          reload.entries.find((entry) => entry.id === target.id),
          dto,
        );
        const cleared = await request("alice", {
          target: `${endpoint}/${target.id}`,
          method: "PUT",
          body: await replacement(),
        });
        assert.equal(cleared.status, 200);
        const clearedEntry = (await cleared.json()).data.entry;
        assert.equal(clearedEntry.location, null);
        assert.equal(clearedEntry.startDate, null);
        assert.equal(clearedEntry.endDate, null);
        assert.deepEqual(clearedEntry.bulletPoints, []);
        assert.equal(clearedEntry.id, target.id);
        assert.equal(clearedEntry.sortOrder, original.sortOrder);
      },
    );

    await t.test(
      "replacement requires every professional field and rejects invalid dates, bounds and mass assignment",
      async () => {
        const target = await firstEntry();
        const before = await record();
        const count = await owner.auditOutbox.count();
        const valid = await replacement();
        const invalid = [
          ...[
            "company",
            "title",
            "location",
            "startDate",
            "endDate",
            "isCurrent",
            "bulletPoints",
            "expectedRevision",
          ].map((key) => {
            const copy = { ...valid };
            delete copy[key];
            return copy;
          }),
          ...[
            { company: " " },
            { title: "x".repeat(201) },
            { location: "x".repeat(201) },
            { startDate: "2024-13" },
            { startDate: "2024-01-01" },
            { endDate: "2024" },
            { startDate: "2024-02", endDate: "2023-12" },
            { startDate: "2024", endDate: "2024", isCurrent: true },
            { isCurrent: "true" },
            { bulletPoints: [""] },
            { bulletPoints: ["x".repeat(1001)] },
            { bulletPoints: Array(21).fill("Synthetic bullet") },
            { bulletPoints: null },
            { expectedRevision: 0 },
            { expectedRevision: 2147483647 },
            { id: target.id },
            { profileId: people.bob.profile.id },
            { userId: people.bob.id },
            { workspaceId: people.bob.personalWorkspace.id },
            { sortOrder: 99 },
            { keywords: ["private"] },
            { metrics: {} },
            { email: "private@example.invalid" },
            { onboardingCompletedAt: "2026-10-04" },
            { revision: valid.expectedRevision },
            { description: "unmapped rich text" },
          ].map((extra) => ({ ...valid, ...extra })),
        ];
        for (const body of invalid) {
          const response = await request("alice", {
            target: `${endpoint}/${target.id}`,
            method: "PUT",
            body,
          });
          assert.equal(response.status, 422);
          assert.equal("data" in (await response.json()), false);
        }
        for (const path of [
          `${endpoint}/malformed`,
          `${endpoint}/${target.id}?profileId=${people.bob.profile.id}`,
        ])
          assert.equal(
            (
              await request("alice", {
                target: path,
                method: "PUT",
                body: valid,
              })
            ).status,
            422,
          );
        assert.deepEqual(await firstEntry(), target);
        assert.deepEqual(await record(), before);
        assert.equal(await owner.auditOutbox.count(), count);
      },
    );

    await t.test(
      "missing and foreign entry IDs share 404 and cannot advance the owner's revision",
      async () => {
        const other = await firstEntry("bob");
        const before = await record();
        const otherProfile = await record("bob");
        const count = await owner.auditOutbox.count();
        for (const id of [randomUUID(), other.id]) {
          const response = await request("alice", {
            target: `${endpoint}/${id}`,
            method: "PUT",
            body: await replacement(),
            headers: { "X-User-Id": people.bob.id, "X-Role": "ORG_OWNER" },
          });
          assert.equal(response.status, 404);
          assert.equal((await response.json()).error.code, "not_found");
        }
        assert.deepEqual(await record(), before);
        assert.deepEqual(await record("bob"), otherProfile);
        assert.deepEqual(await firstEntry("bob"), other);
        assert.equal(await owner.auditOutbox.count(), count);
        const own = await firstEntry();
        const denied = await request("alice", {
          target: `${endpoint}/${own.id}`,
          method: "PUT",
          body: await replacement(),
          headers: { "X-Workspace-Id": people.bob.personalWorkspace.id },
        });
        assert.equal(denied.status, 403);
        const event = await eventFor((await denied.json()).requestId);
        assert.equal(event.payload.action, "authorization.denied");
        assert.equal(
          event.payload.resourceId,
          people.alice.personalWorkspace.id,
        );
        assert.deepEqual(await record(), before);
        const missingMaster = await request("charlie", {
          target: `${endpoint}/${own.id}`,
          method: "PUT",
          body: await replacement({ expectedRevision: 1 }),
        });
        assert.equal(missingMaster.status, 404);
      },
    );

    await t.test(
      "competing entry, add and draft writes elect one winner on the same master revision",
      async () => {
        const target = await firstEntry();
        for (const opponent of ["entry", "add", "draft"]) {
          const before = await record();
          const count = await owner.auditOutbox.count();
          const rows = await owner.experience.count({
            where: { profileId: before.id },
          });
          const body = await replacement({
            title: `Synthetic ${opponent} update`,
          });
          const rival =
            opponent === "entry"
              ? {
                  target: `${endpoint}/${target.id}`,
                  method: "PUT",
                  body: { ...body, title: "Synthetic competing entry" },
                }
              : opponent === "add"
                ? { method: "POST", body: await input() }
                : {
                    target: `${root}/draft`,
                    method: "PUT",
                    body: {
                      expectedRevision: before.revision,
                      professionalSummary: "Synthetic competing draft",
                    },
                  };
          const responses = await Promise.all([
            request("alice", {
              target: `${endpoint}/${target.id}`,
              method: "PUT",
              body,
            }),
            request("alice", rival),
          ]);
          assert.equal(responses.filter((response) => response.ok).length, 1);
          const loser = responses.find((response) => !response.ok);
          assert.equal(loser.status, 409);
          assert.equal((await loser.json()).error.code, "revision_conflict");
          assert.equal((await record()).revision, before.revision + 1);
          assert.equal(await owner.auditOutbox.count(), count + 1);
          assert.equal(
            await owner.experience.count({ where: { profileId: before.id } }),
            rows + (opponent === "add" && responses[1].ok ? 1 : 0),
          );
          if (!responses[0].ok && opponent !== "entry")
            assert.notEqual((await firstEntry()).title, body.title);
          const retryCount = await owner.auditOutbox.count();
          const retry = await request("alice", {
            target: `${endpoint}/${target.id}`,
            method: "PUT",
            body,
          });
          assert.equal(retry.status, 409);
          assert.equal(await owner.auditOutbox.count(), retryCount);
        }
      },
    );

    await t.test(
      "expiry while waiting for the parent lock rolls back an entry update and its revision",
      async () => {
        const target = await firstEntry();
        const before = await record();
        const count = await owner.auditOutbox.count();
        const resolved = await resolveActor(
          `Bearer ${credentials.alice.token}`,
        );
        assert.equal(resolved.status, "authenticated");
        let time = Date.now();
        const expiring = createProfileUseCases(runtime.profile, () => time);
        let locked;
        const ready = new Promise((resolve) => {
          locked = resolve;
        });
        let release;
        const gate = new Promise((resolve) => {
          release = resolve;
        });
        const holding = owner.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "UserProfile" WHERE "id" = ${before.id}::uuid FOR UPDATE`;
          locked();
          await gate;
        });
        await Promise.race([
          ready,
          holding.then(() => assert.fail("Parent must be locked")),
        ]);
        const write = expiring.updateExperience(
          { actor: resolved.actor, correlationId: randomUUID() },
          target.id,
          await replacement(),
        );
        const rejected = assert.rejects(write, { code: "unauthenticated" });
        try {
          await waitForLock();
          time = resolved.actor.expiresAt;
        } finally {
          release();
          await holding;
        }
        await rejected;
        assert.deepEqual(await firstEntry(), target);
        assert.deepEqual(await record(), before);
        assert.equal(await owner.auditOutbox.count(), count);
      },
    );

    await t.test(
      "ordinary experience additions preserve completed onboarding instead of reopening it",
      async () => {
        await owner.userProfile.update({
          where: { id: people.bob.profile.id },
          data: { onboardingCompletedAt: new Date("2026-10-04T00:00:00Z") },
        });
        const before = await record("bob");
        const response = await request("bob", {
          method: "POST",
          body: await input({}, "bob"),
        });
        assert.equal(response.status, 201);
        const after = await record("bob");
        assert.deepEqual(after, {
          ...before,
          revision: before.revision + 1,
          updatedAt: after.updatedAt,
        });
      },
    );
    await t.test(
      "ordinary entry replacements preserve completed onboarding and hidden metadata",
      async () => {
        const before = await record("bob");
        assert.notEqual(before.onboardingCompletedAt, null);
        const target = await firstEntry("bob");
        const body = await replacement(
          { startDate: "2020-12", endDate: "2020" },
          "bob",
        );
        const response = await request("bob", {
          target: `${endpoint}/${target.id}`,
          method: "PUT",
          body,
        });
        assert.equal(response.status, 200);
        const result = (await response.json()).data;
        assert.equal(result.entry.id, target.id);
        assert.equal(result.entry.sortOrder, target.sortOrder);
        assert.equal(result.entry.startDate, "2020-12");
        assert.equal(result.entry.endDate, "2020");
        const after = await record("bob");
        assert.deepEqual(after, {
          ...before,
          revision: before.revision + 1,
          updatedAt: after.updatedAt,
        });
        const row = await firstEntry("bob");
        assert.deepEqual(row.keywords, target.keywords);
        assert.deepEqual(row.metrics, target.metrics);
        assert.equal("keywords" in result.entry, false);
        assert.equal("metrics" in result.entry, false);
      },
    );
    await t.test(
      "experience read/add/update audit events deliver through the restricted HTTP ledger without content",
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
        const count = await owner.auditOutbox.count();
        const result = await deliverAuditOutbox(runtime.auditRelay, send, {
          batchSize: 100,
          leaseMs: 120000,
        });
        assert.equal(result.delivered, count);
        assert.equal(result.blocked, 0);
        assert.equal(result.retried, 0);
        const events = await owner.auditEvent.findMany();
        assert.equal(events.length, count);
        assert.ok(
          events.some((event) => event.metadata.status === "experience_read"),
        );
        assert.ok(
          events.some((event) => event.metadata.status === "experience_added"),
        );
        assert.ok(
          events.some(
            (event) => event.metadata.status === "experience_updated",
          ),
        );
        for (const event of events) {
          const person = Object.values(people).find(
            (person) => person.id === event.actorUserId,
          );
          assert.ok(person);
          assert.equal(event.workspaceId, person.personalWorkspace.id);
          assert.equal(
            event.resourceId,
            event.action === "authorization.denied"
              ? person.personalWorkspace.id
              : person.profile.id,
          );
          assert.equal(
            JSON.stringify(event.metadata).includes("Synthetic"),
            false,
          );
          assert.equal(
            JSON.stringify(event.metadata).includes("private"),
            false,
          );
        }
      },
    );
    await t.test(
      "expiry/revocation and auth outage withhold experience access before domain work",
      async () => {
        const before = await owner.auditOutbox.count();
        const context = {
          actor: {
            userId: people.alice.id,
            personalWorkspaceId: people.alice.personalWorkspace.id,
            expiresAt: Date.now() - 1,
          },
          correlationId: randomUUID(),
        };
        await assert.rejects(profiles.listExperience(context), {
          code: "unauthenticated",
        });
        await assert.rejects(profiles.addExperience(context, await input()), {
          code: "unauthenticated",
        });
        const aliceEntry = await firstEntry();
        await assert.rejects(
          profiles.updateExperience(
            context,
            aliceEntry.id,
            await replacement(),
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
        for (const method of ["GET", "POST"])
          assert.equal(
            (
              await request("alice", {
                method,
                ...(method === "POST" ? { body: await input() } : {}),
              })
            ).status,
            401,
          );
        assert.equal(
          (
            await request("alice", {
              target: `${endpoint}/${aliceEntry.id}`,
              method: "PUT",
              body: await replacement(),
            })
          ).status,
          401,
        );
        await close(authServer);
        servers.splice(servers.indexOf(authServer), 1);
        for (const method of ["GET", "POST"]) {
          const response = await request("bob", {
            method,
            ...(method === "POST" ? { body: await input({}, "bob") } : {}),
          });
          assert.equal(response.status, 503);
          assert.equal("data" in (await response.json()), false);
        }
        const bobEntry = await firstEntry("bob");
        const unavailable = await request("bob", {
          target: `${endpoint}/${bobEntry.id}`,
          method: "PUT",
          body: await replacement({}, "bob"),
        });
        assert.equal(unavailable.status, 503);
        assert.equal("data" in (await unavailable.json()), false);
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
