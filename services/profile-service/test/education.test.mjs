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
const databaseName = `rf_education_test_${suffix}`;
const names = runtimeRoleNames(`rf_edu_${suffix.slice(0, 12)}`);
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

test("owned Education with real actor transport, revisioned persistence and atomic audit", async (t) => {
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
      prefix: `rf_edu_${suffix.slice(0, 12)}`,
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
                    ...(name === "bob"
                      ? {
                          onboardingCompletedAt: new Date(),
                          educations: {
                            create: {
                              institution:
                                "Synthetic Bob exclusive institution",
                              degree: "Synthetic Bob degree",
                              fieldOfStudy: "Synthetic Bob fieldOfStudy",
                              gpa: "3.9",
                              description: "Synthetic Bob description",
                            },
                          },
                        }
                      : {}),
                    contact: {
                      create: {
                        email: `${name}-private@example.invalid`,
                        phone: "synthetic-private-phone",
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
    const root = `http://127.0.0.1:${profileServer.address().port}/api/v1/profile`;
    const endpoint = `${root}/education`;
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
      institution: "Synthetic University",
      degree: "Bachelor of Science",
      fieldOfStudy: "Computer Science",
      ...extra,
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
        assert.equal(await owner.education.count(), 1);
        assert.equal(await owner.auditOutbox.count(), before);
      },
    );

    await t.test(
      "GET returns only owned professional entries and a consistent revision, including empty sections",
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
          status: "education_read",
        });
        const bob = await (await request("bob")).json();
        assert.equal(bob.data.entries.length, 1);
        assert.deepEqual(
          Object.keys(bob.data.entries[0]).sort(),
          [
            "id",
            "institution",
            "degree",
            "fieldOfStudy",
            "startDate",
            "endDate",
            "gpa",
            "description",
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
            institution: "  Synthetic University  ",
            degree: "  Bachelor of Science  ",
            fieldOfStudy: "  Computer Science  ",
            startDate: "2018-09",
            endDate: "2022-05",
            gpa: "  3.9/4.0  ",
            description: "  Graduated with honours.  ",
          }),
        });
        assert.equal(response.status, 201);
        assert.equal(response.headers.get("Cache-Control"), "no-store");
        const { data, requestId } = await response.json();
        assert.equal(data.profileId, before.id);
        assert.equal(data.revision, before.revision + 1);
        assert.deepEqual(data.entry, {
          id: data.entry.id,
          institution: "Synthetic University",
          degree: "Bachelor of Science",
          fieldOfStudy: "Computer Science",
          startDate: "2018-09",
          endDate: "2022-05",
          gpa: "3.9/4.0",
          description: "Graduated with honours.",
          sortOrder: 0,
        });
        const after = await record();
        assert.equal(after.revision, before.revision + 1);
        assert.equal(after.fullName, before.fullName);
        assert.equal(after.professionalSummary, before.professionalSummary);
        assert.deepEqual(
          await owner.userContact.findUniqueOrThrow({
            where: { profileId: before.id },
          }),
          contact,
        );
        assert.deepEqual(await record("bob"), other);
        const row = await owner.education.findUniqueOrThrow({
          where: { id: data.entry.id },
        });
        assert.equal(row.profileId, before.id);
        assert.equal(row.institution, "Synthetic University");
        assert.equal(row.degree, "Bachelor of Science");
        assert.equal(row.fieldOfStudy, "Computer Science");
        assert.equal(row.startDate, "2018-09");
        assert.equal(row.endDate, "2022-05");
        assert.equal(row.gpa, "3.9/4.0");
        assert.equal(row.description, "Graduated with honours.");
        assert.equal(row.sortOrder, 0);
        const event = await eventFor(requestId);
        assert.equal(event.payload.action, "profile.updated");
        assert.deepEqual(event.payload.metadata, {
          permission: "profile.update",
          status: "education_added",
        });
        assert.equal(
          JSON.stringify(event.payload).includes("Synthetic University"),
          false,
        );
      },
    );

    await t.test(
      "omitted optional facts survive reload; stale retries do not duplicate",
      async () => {
        const before = await record();
        const response = await request("alice", {
          method: "POST",
          body: await input({
            institution: "Synthetic College",
            degree: "Associate Degree",
            fieldOfStudy: "Information Technology",
          }),
        });
        assert.equal(response.status, 201);
        const { data } = await response.json();
        assert.equal(data.entry.startDate, null);
        assert.equal(data.entry.endDate, null);
        assert.equal(data.entry.gpa, null);
        assert.equal(data.entry.description, null);
        assert.equal(data.entry.sortOrder, 1);
        const reloaded = await request("alice");
        assert.equal(reloaded.status, 200);
        const list = (await reloaded.json()).data;
        assert.equal(list.entries.length, 2);
        assert.deepEqual(list.entries[1], data.entry);
        assert.equal(list.revision, before.revision + 1);
        const stale = await request("alice", {
          method: "POST",
          body: {
            expectedRevision: before.revision,
            institution: "Synthetic College",
            degree: "Associate Degree",
            fieldOfStudy: "Information Technology",
          },
        });
        assert.equal(stale.status, 409);
        assert.equal((await stale.json()).error.code, "revision_conflict");
        assert.equal(
          await owner.education.count({ where: { profileId: before.id } }),
          2,
        );
        assert.equal((await record()).revision, before.revision + 1);
      },
    );

    await t.test(
      "strict bounds, date ranges and mass assignment reject without touching revision, rows or audit",
      async () => {
        const before = await record();
        const rows = await owner.education.count({
          where: { profileId: before.id },
        });
        const auditCount = await owner.auditOutbox.count();
        const badInputs = [
          { institution: "x".repeat(201) },
          { degree: "x".repeat(201) },
          { fieldOfStudy: "x".repeat(201) },
          { institution: "" },
          { institution: "   " },
          { degree: "" },
          { degree: "   " },
          { fieldOfStudy: "" },
          { fieldOfStudy: "   " },
          { gpa: "x".repeat(51) },
          { description: "x".repeat(1001) },
          { startDate: "2020-13" },
          { startDate: "2020-00" },
          { startDate: "20-01" },
          { startDate: "2020-1-1" },
          { endDate: "2019-01", startDate: "2020-01" },
          { endDate: "2019", startDate: "2020" },
          { endDate: "2020-01", startDate: null },
          { expectedRevision: 0 },
          { expectedRevision: -1 },
          { expectedRevision: 2147483647 },
          { id: randomUUID() },
          { profileId: randomUUID() },
          { userId: randomUUID() },
          { workspaceId: randomUUID() },
          { sortOrder: 1 },
          { revision: 1 },
          { contact: { email: "leak@example.invalid" } },
          { email: "leak@example.invalid" },
          { phone: "12345" },
          { isCurrent: true },
          { bulletPoints: ["leak"] },
          { keywords: ["leak"] },
          { metrics: { gpa: "4.0" } },
        ];
        for (const bad of badInputs) {
          const body = { ...(await input()), ...bad };
          const response = await request("alice", {
            method: "POST",
            body,
          });
          assert.equal(
            response.status,
            422,
            `Expected 422 for input ${JSON.stringify(bad)}, got ${response.status}`,
          );
        }
        assert.deepEqual(await record(), before);
        assert.equal(
          await owner.education.count({ where: { profileId: before.id } }),
          rows,
        );
        assert.equal(await owner.auditOutbox.count(), auditCount);
      },
    );

    await t.test(
      "concurrent adds and professional draft edits share one winning revision without orphan rows/events",
      async () => {
        for (const competingDraft of [false, true]) {
          const body = await input();
          const count = await owner.auditOutbox.count();
          const entries = await owner.education.count({
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
                  body: { ...body, institution: "Synthetic second contender" },
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
            await owner.education.count({
              where: { profileId: people.alice.profile.id },
            }),
            entries + (winner.status === 201 ? 1 : 0),
          );
          assert.equal(await owner.auditOutbox.count(), count + 1);
        }
      },
    );

    await t.test(
      "forged workspace, profile and identity selectors cannot expose or append another owner's entries",
      async () => {
        const other = await record("bob");
        const otherEntries = await owner.education.findMany({
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
          await owner.education.findMany({ where: { profileId: other.id } }),
          otherEntries,
        );
      },
    );

    await t.test(
      "entry capacity rolls back parent revision; oversized legacy lists fail closed without truncation",
      async () => {
        const before = await record();
        const existing = await owner.education.findMany({
          where: { profileId: before.id },
        });
        const ids = Array.from({ length: 50 - existing.length }, () =>
          randomUUID(),
        );
        const overflowId = randomUUID();
        try {
          await owner.education.createMany({
            data: ids.map((id, index) => ({
              id,
              profileId: before.id,
              institution: "Capacity University",
              degree: "Degree",
              fieldOfStudy: "Field",
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
            await owner.education.count({ where: { profileId: before.id } }),
            50,
          );

          await owner.education.create({
            data: {
              id: overflowId,
              profileId: before.id,
              institution: "Legacy Overflow University",
              degree: "Degree",
              fieldOfStudy: "Field",
              sortOrder: 50,
            },
          });
          const legacy = await request("alice");
          assert.equal(legacy.status, 503);
          assert.equal("data" in (await legacy.json()), false);
        } finally {
          await owner.education.deleteMany({
            where: { id: { in: [...ids, overflowId] } },
          });
        }
      },
    );

    await t.test(
      "exhausted append order rolls back without overwriting existing entries",
      async () => {
        const before = await record();
        const count = await owner.auditOutbox.count();
        const id = randomUUID();
        await owner.education.create({
          data: {
            id,
            profileId: before.id,
            institution: "Last Order University",
            degree: "Degree",
            fieldOfStudy: "Field",
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
            (await owner.education.findUniqueOrThrow({ where: { id } }))
              .sortOrder,
            2147483647,
          );
        } finally {
          await owner.education.delete({ where: { id } });
        }
      },
    );

    await t.test(
      "audit COMMIT failure withholds reads and rolls back parent/entry creation, then retry recovers",
      async () => {
        const before = await record();
        const count = await owner.auditOutbox.count();
        const rows = await owner.education.findMany({
          where: { profileId: before.id },
          orderBy: { sortOrder: "asc" },
        });
        await admin.query(
          "CREATE FUNCTION reject_education_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic private audit failure'; END; $$",
        );
        await admin.query(
          'CREATE CONSTRAINT TRIGGER reject_education_audit AFTER INSERT ON "AuditOutbox" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reject_education_audit()',
        );
        try {
          for (const options of [
            {},
            { method: "POST", body: await input() },
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
            await owner.education.findMany({
              where: { profileId: before.id },
              orderBy: { sortOrder: "asc" },
            }),
            rows,
          );
          assert.equal(await owner.auditOutbox.count(), count);
        } finally {
          await admin.query(
            'DROP TRIGGER reject_education_audit ON "AuditOutbox"',
          );
          await admin.query("DROP FUNCTION reject_education_audit()");
        }
        assert.equal((await request()).status, 200);
        assert.equal(
          (await request("alice", { method: "POST", body: await input() }))
            .status,
          201,
        );
      },
    );

    await t.test(
      "a list snapshot holds its parent revision while an actual concurrent append waits",
      async () => {
        const before = await record();
        const rows = await owner.education.count({
          where: { profileId: before.id },
        });
        let release, started;
        const gate = new Promise((resolve) => {
          release = resolve;
        });
        const ready = new Promise((resolve) => {
          started = resolve;
        });
        const paused = new Proxy(runtime.profile, {
          get(db, key) {
            if (key !== "$transaction") return Reflect.get(db, key);
            return (operation) =>
              db.$transaction((tx) =>
                operation(
                  new Proxy(tx, {
                    get(transaction, field) {
                      if (field !== "education")
                        return Reflect.get(transaction, field);
                      return new Proxy(transaction.education, {
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
        const pausedApp = createProfileApp({
          resolveActor,
          profiles: createProfileUseCases(paused),
        });
        const pausedServer = serve({
          fetch: pausedApp.fetch,
          hostname: "127.0.0.1",
          port: 0,
        });
        servers.push(pausedServer);
        await once(pausedServer, "listening");
        const pausedEndpoint = `http://127.0.0.1:${pausedServer.address().port}/api/v1/profile/education`;
        try {
          const listPromise = request("alice", { target: pausedEndpoint });
          await ready;
          const appendPromise = request("alice", {
            method: "POST",
            body: await input({ institution: "Concurrent Blocked University" }),
          });
          await waitForLock();
          release();
          const [listResponse, appendResponse] = await Promise.all([
            listPromise,
            appendPromise,
          ]);
          assert.equal(listResponse.status, 200);
          assert.equal(appendResponse.status, 201);
          const listData = (await listResponse.json()).data;
          const appendData = (await appendResponse.json()).data;
          assert.equal(listData.revision, before.revision);
          assert.equal(listData.entries.length, rows);
          assert.equal(appendData.revision, before.revision + 1);
        } finally {
          await close(pausedServer);
          servers.splice(servers.indexOf(pausedServer), 1);
        }
      },
    );

    await t.test(
      "ordinary education additions preserve completed onboarding instead of reopening it",
      async () => {
        const before = await record("bob");
        assert.notEqual(before.onboardingCompletedAt, null);
        const response = await request("bob", {
          method: "POST",
          body: await input(
            { institution: "Completed Onboarding Univ" },
            "bob",
          ),
        });
        assert.equal(response.status, 201);
        const after = await record("bob");
        assert.notEqual(after.onboardingCompletedAt, null);
        assert.equal(
          after.onboardingCompletedAt.toISOString(),
          before.onboardingCompletedAt.toISOString(),
        );
        assert.equal(after.revision, before.revision + 1);
      },
    );

    await t.test(
      "education read/add audit events deliver through the restricted HTTP ledger without content",
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
          events.some((event) => event.metadata.status === "education_read"),
        );
        assert.ok(
          events.some((event) => event.metadata.status === "education_added"),
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
      "expiry/revocation and auth outage withhold education access before domain work",
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
        await assert.rejects(profiles.listEducation(context), {
          code: "unauthenticated",
        });
        await assert.rejects(profiles.addEducation(context, await input()), {
          code: "unauthenticated",
        });
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
