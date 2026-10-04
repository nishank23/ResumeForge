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
const databaseName = `rf_certification_test_${suffix}`;
const names = runtimeRoleNames(`rf_crt_${suffix.slice(0, 12)}`);
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

test("owned Certifications with real actor transport, revisioned persistence and atomic audit", async (t) => {
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
      prefix: `rf_crt_${suffix.slice(0, 12)}`,
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
                          certifications: {
                            create: {
                              name: "CKA: Certified Kubernetes Administrator",
                              issuer: "Cloud Native Computing Foundation",
                              issueDate: "2023-01",
                              expiryDate: "2026-01",
                              credentialUrl: "https://example.invalid/bob-cka",
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

    const endpoint = `http://127.0.0.1:${profileServer.address().port}/api/v1/profile/certifications`;
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
      "GET returns only owned certifications and a consistent revision",
      async () => {
        const res = await request("alice");
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.data.profileId, people.alice.profile.id);
        assert.equal(body.data.revision, 1);
        assert.deepEqual(body.data.entries, []);
      },
    );

    let aliceCertId;

    await t.test(
      "POST adds owned certification, increments parent revision and logs audit",
      async () => {
        const res = await request("alice", {
          method: "POST",
          body: {
            expectedRevision: 1,
            name: "  AWS Solutions Architect  ",
            issuer: "  Amazon Web Services  ",
            issueDate: "2023-05",
            expiryDate: "2026-05",
            credentialUrl: "https://example.invalid/cert-aws",
          },
        });
        assert.equal(res.status, 201);
        const body = await res.json();
        assert.equal(body.data.profileId, people.alice.profile.id);
        assert.equal(body.data.revision, 2);
        assert.equal(body.data.entry.name, "AWS Solutions Architect");
        assert.equal(body.data.entry.issuer, "Amazon Web Services");
        assert.equal(body.data.entry.issueDate, "2023-05");
        assert.equal(body.data.entry.expiryDate, "2026-05");
        assert.equal(
          body.data.entry.credentialUrl,
          "https://example.invalid/cert-aws",
        );
        aliceCertId = body.data.entry.id;

        const parent = await owner.userProfile.findUnique({
          where: { id: people.alice.profile.id },
        });
        assert.equal(parent.revision, 2);

        const audit = await owner.auditOutbox.findFirst({
          where: {
            payload: {
              path: ["metadata", "status"],
              equals: "certification_added",
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
            name: "Stale Cert",
            issuer: "Should fail",
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
            name: "Bad URL Cert",
            issuer: "Issuer",
            credentialUrl: "not-a-valid-url",
          },
        });
        assert.equal(badUrl.status, 422);

        // Reversed date range
        const badDates = await request("alice", {
          method: "POST",
          body: {
            expectedRevision: 2,
            name: "Bad Date Cert",
            issuer: "Issuer",
            issueDate: "2026-05",
            expiryDate: "2023-05",
          },
        });
        assert.equal(badDates.status, 422);

        // Mass assignment / forbidden field
        const massAssign = await request("alice", {
          method: "POST",
          body: {
            expectedRevision: 2,
            name: "Mass Assign Cert",
            issuer: "Issuer",
            id: randomUUID(),
          },
        });
        assert.equal(massAssign.status, 422);
      },
    );

    await t.test(
      "PUT /certifications/:id updates certification, increments revision and logs audit",
      async () => {
        const res = await request("alice", {
          method: "PUT",
          target: `${endpoint}/${aliceCertId}`,
          body: {
            expectedRevision: 2,
            name: "AWS Solutions Architect Professional",
            issuer: "Amazon Web Services Inc.",
            issueDate: "2023-06",
            expiryDate: "2026-06",
            credentialUrl: "https://example.invalid/updated-cert",
          },
        });
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.data.revision, 3);
        assert.equal(
          body.data.entry.name,
          "AWS Solutions Architect Professional",
        );
        assert.equal(body.data.entry.issuer, "Amazon Web Services Inc.");
        assert.equal(body.data.entry.issueDate, "2023-06");
        assert.equal(body.data.entry.expiryDate, "2026-06");

        const parent = await owner.userProfile.findUnique({
          where: { id: people.alice.profile.id },
        });
        assert.equal(parent.revision, 3);

        const audit = await owner.auditOutbox.findFirst({
          where: {
            payload: {
              path: ["metadata", "status"],
              equals: "certification_updated",
            },
          },
        });
        assert.ok(audit);
      },
    );

    await t.test(
      "PUT /certifications/:id rejects stale expectedRevision with 409",
      async () => {
        const res = await request("alice", {
          method: "PUT",
          target: `${endpoint}/${aliceCertId}`,
          body: {
            expectedRevision: 2, // Current is 3
            name: "Stale Update",
            issuer: "Issuer",
            issueDate: null,
            expiryDate: null,
            credentialUrl: null,
          },
        });
        assert.equal(res.status, 409);
        const body = await res.json();
        assert.equal(body.error.code, "revision_conflict");
      },
    );

    await t.test(
      "PUT /certifications/:id returns 404 on missing or foreign certification ID",
      async () => {
        const res = await request("alice", {
          method: "PUT",
          target: `${endpoint}/${randomUUID()}`,
          body: {
            expectedRevision: 3,
            name: "Ghost Cert",
            issuer: "Does not exist",
            issueDate: null,
            expiryDate: null,
            credentialUrl: null,
          },
        });
        assert.equal(res.status, 404);
      },
    );

    await t.test(
      "ordinary certification additions preserve completed onboarding",
      async () => {
        const before = await owner.userProfile.findUnique({
          where: { id: people.bob.profile.id },
        });
        assert.ok(before.onboardingCompletedAt);

        const res = await request("bob", {
          method: "POST",
          body: {
            expectedRevision: 1,
            name: "Certified Kubernetes Security Specialist",
            issuer: "CNCF",
            issueDate: "2023-06",
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
