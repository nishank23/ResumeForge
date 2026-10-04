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
} from "@resume-forge/prisma-client";
import { createLocalActorResolver } from "@resume-forge/access-policy/server";
import {
  Client,
  provisionRuntimeRoles,
} from "../../../scripts/runtime-roles.mjs";
import { createAuthApp } from "../../auth-service/dist/app.js";
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
const databaseName = `rf_skill_test_${suffix}`;
const names = runtimeRoleNames(`rf_skl_${suffix.slice(0, 12)}`);
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

test("owned Skills with real actor transport, revisioned persistence and atomic audit", async (t) => {
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
      prefix: `rf_skl_${suffix.slice(0, 12)}`,
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
                          skills: {
                            create: {
                              name: "Go",
                              category: "Languages",
                              proficiency: "expert",
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

    const endpoint = `http://127.0.0.1:${profileServer.address().port}/api/v1/profile/skills`;
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

    let createdSkillId;

    // 1. Missing profile and unauthenticated requests
    await t.test("missing profile and unauthenticated requests do not expose data", async () => {
      const anon = await fetch(endpoint);
      assert.equal(anon.status, 401);

      const noProfile = await request("charlie");
      assert.equal(noProfile.status, 404);
    });

    // 2. GET returns owned skills and parent revision
    await t.test("GET returns only owned skills and a consistent revision", async () => {
      const aliceGet = await request("alice");
      assert.equal(aliceGet.status, 200);
      const aliceData = await aliceGet.json();
      assert.equal(aliceData.data.revision, 1);
      assert.equal(aliceData.data.entries.length, 0);

      const bobGet = await request("bob");
      assert.equal(bobGet.status, 200);
      const bobData = await bobGet.json();
      assert.equal(bobData.data.entries.length, 1);
      assert.equal(bobData.data.entries[0].name, "Go");
      assert.equal(bobData.data.entries[0].category, "Languages");
    });

    // 3. POST adds owned skill, advances parent revision, and captures atomic audit
    await t.test("POST adds owned skill, increments parent revision and logs audit", async () => {
      const res = await request("alice", {
        method: "POST",
        body: {
          expectedRevision: 1,
          name: "TypeScript",
          category: "Languages",
          proficiency: "advanced",
        },
      });
      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.data.revision, 2);
      assert.equal(body.data.entry.name, "TypeScript");
      assert.equal(body.data.entry.category, "Languages");
      assert.equal(body.data.entry.proficiency, "advanced");
      createdSkillId = body.data.entry.id;

      // Verify DB row
      const inDb = await owner.skill.findUnique({
        where: { id: createdSkillId },
      });
      assert.ok(inDb);
      assert.equal(inDb.name, "TypeScript");

      // Verify parent revision in DB
      const parent = await record("alice");
      assert.equal(parent.revision, 2);

      // Verify AuditOutbox
      const audit = await owner.auditOutbox.findFirst({
        where: {
          payload: {
            path: ["metadata", "status"],
            equals: "skill_added",
          },
        },
      });
      assert.ok(audit);
    });

    // 4. POST rejects stale expectedRevision with 409
    await t.test("POST rejects stale expectedRevision with 409 revision_conflict", async () => {
      const staleRes = await request("alice", {
        method: "POST",
        body: {
          expectedRevision: 1, // Stale! Current is 2
          name: "Rust",
          category: "Languages",
          proficiency: "intermediate",
        },
      });
      assert.equal(staleRes.status, 409);
      const body = await staleRes.json();
      assert.equal(body.error.code, "revision_conflict");
    });

    // 5. POST rejects invalid bounds and mass assignment
    await t.test("POST rejects invalid bounds and forbidden fields", async () => {
      // Empty name
      const emptyName = await request("alice", {
        method: "POST",
        body: {
          expectedRevision: 2,
          name: "   ",
        },
      });
      assert.equal(emptyName.status, 422);

      // Oversized name
      const oversizedName = await request("alice", {
        method: "POST",
        body: {
          expectedRevision: 2,
          name: "x".repeat(101),
        },
      });
      assert.equal(oversizedName.status, 422);

      // Forbidden mass-assignment fields
      const forbidden = await request("alice", {
        method: "POST",
        body: {
          expectedRevision: 2,
          name: "Python",
          id: randomUUID(),
          profileId: randomUUID(),
        },
      });
      assert.equal(forbidden.status, 422);
    });

    // 6. PUT /api/v1/profile/skills/:id replaces skill and increments revision
    await t.test("PUT /skills/:id updates skill, increments revision and logs audit", async () => {
      const res = await request("alice", {
        method: "PUT",
        target: `${endpoint}/${createdSkillId}`,
        body: {
          expectedRevision: 2,
          name: "TypeScript",
          category: "Programming Languages",
          proficiency: "expert",
        },
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.data.revision, 3);
      assert.equal(body.data.entry.category, "Programming Languages");
      assert.equal(body.data.entry.proficiency, "expert");

      // Verify DB row
      const inDb = await owner.skill.findUnique({
        where: { id: createdSkillId },
      });
      assert.equal(inDb.category, "Programming Languages");
      assert.equal(inDb.proficiency, "expert");

      // Foreign user Bob cannot update Alice's skill
      const bobUpdate = await request("bob", {
        method: "PUT",
        target: `${endpoint}/${createdSkillId}`,
        body: {
          expectedRevision: (await record("bob")).revision,
          name: "TypeScript",
          category: "Languages",
          proficiency: "expert",
        },
      });
      assert.equal(bobUpdate.status, 404);
    });

    // 7. PUT /skills/:id rejects stale expectedRevision with 409
    await t.test("PUT /skills/:id rejects stale expectedRevision with 409", async () => {
      const staleUpdate = await request("alice", {
        method: "PUT",
        target: `${endpoint}/${createdSkillId}`,
        body: {
          expectedRevision: 1, // Stale! Current is 3
          name: "TypeScript",
          category: "Languages",
          proficiency: "expert",
        },
      });
      assert.equal(staleUpdate.status, 409);
      const body = await staleUpdate.json();
      assert.equal(body.error.code, "revision_conflict");
    });

    // 9. Ordinary skill additions preserve completed onboarding
    await t.test("ordinary skill additions preserve completed onboarding", async () => {
      const bobBefore = await record("bob");
      assert.ok(bobBefore.onboardingCompletedAt);

      const res = await request("bob", {
        method: "POST",
        body: {
          expectedRevision: bobBefore.revision,
          name: "Docker",
          category: "DevOps",
          proficiency: "advanced",
        },
      });
      assert.equal(res.status, 201);

      const bobAfter = await record("bob");
      assert.equal(bobAfter.revision, bobBefore.revision + 1);
      assert.equal(
        bobAfter.onboardingCompletedAt.toISOString(),
        bobBefore.onboardingCompletedAt.toISOString(),
      );
    });
  } finally {
    for (const server of servers) await close(server);
    await owner.$disconnect();
    for (const client of Object.values(runtime)) await client.$disconnect();
    await admin.end();
    try {
      await lifecycle.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${databaseName}'`,
      );
      await lifecycle.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      await lifecycle.query(
        `DROP ROLE IF EXISTS ${Object.values(names)
          .map((n) => `"${n}"`)
          .join(", ")}`,
      );
    } catch {
      // ignore teardown errors
    }
    await lifecycle.end();
  }
});
