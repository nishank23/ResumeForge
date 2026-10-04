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
const databaseName = `rf_project_test_${suffix}`;
const names = runtimeRoleNames(`rf_prj_${suffix.slice(0, 12)}`);
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

test("owned Projects with real actor transport, revisioned persistence and atomic audit", async (t) => {
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
      prefix: `rf_prj_${suffix.slice(0, 12)}`,
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
                          projects: {
                            create: {
                              name: "Existing Project",
                              description: "Existing project description",
                              url: "https://example.invalid/bob-project",
                              technologies: ["Node.js", "Docker"],
                              startDate: "2023-01",
                              endDate: "2023-08",
                            },
                          },
                        }
                      : {}),
                    contact: {
                      create: {
                        email: `${name}.contact@example.invalid`,
                        phone: "+15555550100",
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
            emailVerified: true,
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

    const endpoint = `http://127.0.0.1:${profileServer.address().port}/api/v1/profile/projects`;
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

    await t.test(
      "missing profile and unauthenticated requests do not expose data",
      async () => {
        const unauth = await fetch(endpoint);
        assert.equal(unauth.status, 401);

        const noProfile = await request("charlie");
        assert.equal(noProfile.status, 404);
      },
    );

    await t.test(
      "GET returns only owned projects and a consistent revision",
      async () => {
        const res = await request("alice");
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.data.profileId, people.alice.profile.id);
        assert.equal(body.data.revision, 1);
        assert.deepEqual(body.data.entries, []);
      },
    );

    let aliceProjectId;

    await t.test(
      "POST adds owned project, increments parent revision and logs audit",
      async () => {
        const res = await request("alice", {
          method: "POST",
          body: {
            expectedRevision: 1,
            name: "  Resume Forge  ",
            description: "  AI resume management and builder  ",
            url: "https://example.invalid/resume-forge",
            technologies: ["TypeScript", "React", "PostgreSQL"],
            startDate: "2024-01",
            endDate: "2024-06",
          },
        });
        assert.equal(res.status, 201);
        const body = await res.json();
        assert.equal(body.data.profileId, people.alice.profile.id);
        assert.equal(body.data.revision, 2);
        assert.equal(body.data.entry.name, "Resume Forge");
        assert.equal(
          body.data.entry.description,
          "AI resume management and builder",
        );
        assert.equal(
          body.data.entry.url,
          "https://example.invalid/resume-forge",
        );
        assert.deepEqual(body.data.entry.technologies, [
          "TypeScript",
          "React",
          "PostgreSQL",
        ]);
        assert.equal(body.data.entry.startDate, "2024-01");
        assert.equal(body.data.entry.endDate, "2024-06");
        aliceProjectId = body.data.entry.id;

        const parent = await owner.userProfile.findUnique({
          where: { id: people.alice.profile.id },
        });
        assert.equal(parent.revision, 2);

        const audit = await owner.auditOutbox.findFirst({
          where: {
            payload: {
              path: ["metadata", "status"],
              equals: "project_added",
            },
          },
        });
        assert.ok(audit);
      },
    );

    await t.test(
      "POST rejects stale expectedRevision with 409 revision_conflict",
      async () => {
        const res = await request("alice", {
          method: "POST",
          body: {
            expectedRevision: 1, // Current is 2
            name: "Stale Project",
            description: "Should fail",
          },
        });
        assert.equal(res.status, 409);
        const body = await res.json();
        assert.equal(body.error.code, "revision_conflict");
      },
    );

    await t.test(
      "POST rejects invalid bounds and forbidden fields",
      async () => {
        // Bad URL
        const badUrl = await request("alice", {
          method: "POST",
          body: {
            expectedRevision: 2,
            name: "Bad URL Project",
            description: "Has invalid url",
            url: "not-a-valid-url",
          },
        });
        assert.equal(badUrl.status, 422);

        // Reversed date range
        const badDates = await request("alice", {
          method: "POST",
          body: {
            expectedRevision: 2,
            name: "Bad Date Project",
            description: "Has reversed dates",
            startDate: "2024-06",
            endDate: "2024-01",
          },
        });
        assert.equal(badDates.status, 422);

        // Mass assignment / forbidden field
        const massAssign = await request("alice", {
          method: "POST",
          body: {
            expectedRevision: 2,
            name: "Mass Assign",
            description: "Tries injecting id",
            id: randomUUID(),
          },
        });
        assert.equal(massAssign.status, 422);
      },
    );

    await t.test(
      "PUT /projects/:id updates project, increments revision and logs audit",
      async () => {
        const res = await request("alice", {
          method: "PUT",
          target: `${endpoint}/${aliceProjectId}`,
          body: {
            expectedRevision: 2,
            name: "Updated Resume Forge",
            description: "Updated description for resume builder",
            url: "https://example.invalid/updated-forge",
            technologies: ["TypeScript", "Next.js"],
            startDate: "2024-02",
            endDate: "2024-07",
          },
        });
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.data.revision, 3);
        assert.equal(body.data.entry.name, "Updated Resume Forge");
        assert.equal(
          body.data.entry.description,
          "Updated description for resume builder",
        );
        assert.equal(
          body.data.entry.url,
          "https://example.invalid/updated-forge",
        );
        assert.deepEqual(body.data.entry.technologies, [
          "TypeScript",
          "Next.js",
        ]);

        const parent = await owner.userProfile.findUnique({
          where: { id: people.alice.profile.id },
        });
        assert.equal(parent.revision, 3);

        const audit = await owner.auditOutbox.findFirst({
          where: {
            payload: {
              path: ["metadata", "status"],
              equals: "project_updated",
            },
          },
        });
        assert.ok(audit);
      },
    );

    await t.test(
      "PUT /projects/:id rejects stale expectedRevision with 409",
      async () => {
        const res = await request("alice", {
          method: "PUT",
          target: `${endpoint}/${aliceProjectId}`,
          body: {
            expectedRevision: 2, // Current is 3
            name: "Stale Update",
            description: "Should fail with 409",
            url: null,
            technologies: [],
            startDate: null,
            endDate: null,
          },
        });
        assert.equal(res.status, 409);
        const body = await res.json();
        assert.equal(body.error.code, "revision_conflict");
      },
    );

    await t.test(
      "PUT /projects/:id returns 404 on missing or foreign project ID",
      async () => {
        const res = await request("alice", {
          method: "PUT",
          target: `${endpoint}/${randomUUID()}`,
          body: {
            expectedRevision: 3,
            name: "Ghost Project",
            description: "Does not exist",
            url: null,
            technologies: [],
            startDate: null,
            endDate: null,
          },
        });
        assert.equal(res.status, 404);
      },
    );

    await t.test(
      "ordinary project additions preserve completed onboarding",
      async () => {
        const before = await owner.userProfile.findUnique({
          where: { id: people.bob.profile.id },
        });
        assert.ok(before.onboardingCompletedAt);

        const res = await request("bob", {
          method: "POST",
          body: {
            expectedRevision: 1,
            name: "Bob's Second Project",
            description: "Second project after onboarding completed",
            technologies: ["Python"],
          },
        });
        assert.equal(res.status, 201);

        const after = await owner.userProfile.findUnique({
          where: { id: people.bob.profile.id },
        });
        assert.equal(
          after.onboardingCompletedAt.toISOString(),
          before.onboardingCompletedAt.toISOString(),
        );
      },
    );
  } finally {
    for (const server of servers) await close(server);
    await owner.$disconnect();
    for (const service of Object.keys(runtime))
      await runtime[service].$disconnect();
    await admin.end();
    await lifecycle.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    await lifecycle.end();
  }
});
