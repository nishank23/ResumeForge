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
const databaseName = `rf_contact_del_test_${suffix}`;
const names = runtimeRoleNames(`rf_cd_${suffix.slice(0, 12)}`);
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

test("UserContact persistence, section entry deletions, and onboarding completion with atomic audit", async (t) => {
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
      prefix: `rf_cd_${suffix.slice(0, 12)}`,
      passwords,
    });
    for (const service of Object.keys(runtime))
      await assertRuntimeDatabaseRole(
        runtime[service],
        service,
        names[service],
      );

    const people = {};
    for (const name of ["alice", "bob", "charlie"]) {
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
                    revision: 1,
                  },
                },
              }),
        },
        include: { personalWorkspace: true, profile: true },
      });
    }

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

    const baseUrl = `http://127.0.0.1:${profileServer.address().port}/api/v1/profile`;
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
      credentials[name] = {
        authorization: `Bearer ${(await refreshed.json()).data.accessToken}`,
        workspaceId: people[name].personalWorkspace.id,
      };
    }

    const headers = (name) => ({
      Authorization: credentials[name].authorization,
      Origin: "http://localhost:3000",
      "Content-Type": "application/json",
      "X-Workspace-Id": credentials[name].workspaceId,
    });

    const getProfile = async (name) => {
      const res = await fetch(baseUrl, { headers: headers(name) });
      return (await res.json()).data;
    };

    // ==========================================
    // 1. UserContact Tests
    // ==========================================
    await t.test("GET /contact returns empty contact facts when uninitialized", async () => {
      const res = await fetch(`${baseUrl}/contact`, {
        headers: headers("alice"),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.data.id);
      assert.equal(body.data.profileId, people.alice.profile.id);
      assert.equal(body.data.email, null);
      assert.equal(body.data.phone, null);
      assert.equal(body.data.address, null);
      assert.equal(body.data.linkedinUrl, null);
      assert.equal(body.data.githubUrl, null);
      assert.equal(body.data.portfolioUrl, null);

      // Verify GET /profile does NOT leak contact fields
      const prof = await getProfile("alice");
      assert.equal(prof.email, undefined);
      assert.equal(prof.phone, undefined);
      assert.equal(prof.address, undefined);
      assert.equal(prof.linkedinUrl, undefined);
    });

    await t.test("PUT /contact upserts contact facts, enforces allowlist, and commits audit", async () => {
      const updateData = {
        email: "alice.contact@example.com",
        phone: "+1-555-0123",
        address: "123 Tech Lane, San Francisco, CA",
        linkedinUrl: "https://linkedin.com/in/alice-dev",
        githubUrl: "https://github.com/alice-dev",
        portfolioUrl: "https://alice.dev",
      };

      const res = await fetch(`${baseUrl}/contact`, {
        method: "PUT",
        headers: headers("alice"),
        body: JSON.stringify(updateData),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.data.email, updateData.email);
      assert.equal(body.data.phone, updateData.phone);
      assert.equal(body.data.address, updateData.address);
      assert.equal(body.data.linkedinUrl, updateData.linkedinUrl);
      assert.equal(body.data.githubUrl, updateData.githubUrl);
      assert.equal(body.data.portfolioUrl, updateData.portfolioUrl);

      // Verify reload through GET /contact
      const reloaded = await fetch(`${baseUrl}/contact`, {
        headers: headers("alice"),
      });
      assert.equal(reloaded.status, 200);
      const reloadedBody = await reloaded.json();
      assert.equal(reloadedBody.data.email, updateData.email);
      assert.equal(reloadedBody.data.id, body.data.id);

      // Verify UserProfile.revision was NOT changed by contact update
      const prof = await getProfile("alice");
      assert.equal(prof.revision, 1);

      // Verify outbox audit event for contact_updated
      const audit = await owner.auditOutbox.findFirst({
        where: {
          payload: {
            path: ["metadata", "status"],
            equals: "contact_updated",
          },
        },
      });
      assert.ok(audit, "contact_updated audit event must exist in outbox");
    });

    await t.test("PUT /contact rejects invalid formats and mass assignment", async () => {
      // Invalid email
      const invalidEmail = await fetch(`${baseUrl}/contact`, {
        method: "PUT",
        headers: headers("alice"),
        body: JSON.stringify({ email: "not-an-email" }),
      });
      assert.equal(invalidEmail.status, 422);

      // Invalid URL
      const invalidUrl = await fetch(`${baseUrl}/contact`, {
        method: "PUT",
        headers: headers("alice"),
        body: JSON.stringify({ linkedinUrl: "not-a-valid-url" }),
      });
      assert.equal(invalidUrl.status, 422);

      // Unknown property (mass assignment)
      const massAssign = await fetch(`${baseUrl}/contact`, {
        method: "PUT",
        headers: headers("alice"),
        body: JSON.stringify({ isAdmin: true, email: "ok@example.com" }),
      });
      assert.equal(massAssign.status, 422);
    });

    await t.test("GET/PUT /contact on missing profile (charlie) returns 404", async () => {
      const getRes = await fetch(`${baseUrl}/contact`, {
        headers: headers("charlie"),
      });
      assert.equal(getRes.status, 404);

      const putRes = await fetch(`${baseUrl}/contact`, {
        method: "PUT",
        headers: headers("charlie"),
        body: JSON.stringify({ email: "charlie@example.com" }),
      });
      assert.equal(putRes.status, 404);
    });

    // ==========================================
    // 2. Section Entry Deletions Tests
    // ==========================================
    await t.test("DELETE /experience/:id removes entry, increments revision, and logs audit", async () => {
      const revBefore = (await getProfile("alice")).revision;

      // Add an experience
      const addRes = await fetch(`${baseUrl}/experience`, {
        method: "POST",
        headers: headers("alice"),
        body: JSON.stringify({
          expectedRevision: revBefore,
          company: "Acme Corp",
          title: "Software Engineer",
          location: "San Francisco, CA",
          startDate: "2021-01",
          endDate: "2023-01",
          isCurrent: false,
          bulletPoints: ["Engineered systems"],
        }),
      });
      assert.equal(addRes.status, 201);
      const addBody = await addRes.json();
      const entryId = addBody.data.entry.id;
      const revAfterAdd = addBody.data.revision;

      // Delete with stale revision returns 409
      const staleRes = await fetch(`${baseUrl}/experience/${entryId}`, {
        method: "DELETE",
        headers: headers("alice"),
        body: JSON.stringify({ expectedRevision: revBefore }),
      });
      assert.equal(staleRes.status, 409);

      // Delete with correct expectedRevision
      const delRes = await fetch(`${baseUrl}/experience/${entryId}`, {
        method: "DELETE",
        headers: headers("alice"),
        body: JSON.stringify({ expectedRevision: revAfterAdd }),
      });
      assert.equal(delRes.status, 200);
      const delBody = await delRes.json();
      assert.equal(delBody.data.deletedEntryId, entryId);
      assert.equal(delBody.data.revision, revAfterAdd + 1);

      // Verify row no longer in database
      const row = await owner.experience.findUnique({ where: { id: entryId } });
      assert.equal(row, null);

      // Verify parent revision incremented
      assert.equal((await getProfile("alice")).revision, revAfterAdd + 1);

      // Deleting again returns 404
      const retryDel = await fetch(`${baseUrl}/experience/${entryId}`, {
        method: "DELETE",
        headers: headers("alice"),
        body: JSON.stringify({ expectedRevision: revAfterAdd + 1 }),
      });
      assert.equal(retryDel.status, 404);

      // Verify audit outbox event
      const audit = await owner.auditOutbox.findFirst({
        where: {
          payload: {
            path: ["metadata", "status"],
            equals: "experience_deleted",
          },
        },
      });
      assert.ok(audit, "experience_deleted audit event must exist");
    });

    await t.test("DELETE /education/:id removes entry, increments revision, and logs audit", async () => {
      const revBefore = (await getProfile("alice")).revision;

      const addRes = await fetch(`${baseUrl}/education`, {
        method: "POST",
        headers: headers("alice"),
        body: JSON.stringify({
          expectedRevision: revBefore,
          institution: "State University",
          degree: "B.S. Computer Science",
          fieldOfStudy: "Computer Science",
          startDate: "2017-09",
          endDate: "2021-05",
          gpa: "3.9",
          description: "Graduated with honors",
        }),
      });
      assert.equal(addRes.status, 201);
      const entryId = (await addRes.json()).data.entry.id;
      const revAfterAdd = (await getProfile("alice")).revision;

      // Delete using X-Expected-Revision header
      const delRes = await fetch(`${baseUrl}/education/${entryId}`, {
        method: "DELETE",
        headers: {
          Authorization: credentials.alice.authorization,
          Origin: "http://localhost:3000",
          "X-Workspace-Id": credentials.alice.workspaceId,
          "X-Expected-Revision": String(revAfterAdd),
        },
      });
      assert.equal(delRes.status, 200);
      assert.equal((await delRes.json()).data.deletedEntryId, entryId);
      assert.equal(await owner.education.findUnique({ where: { id: entryId } }), null);
      assert.equal((await getProfile("alice")).revision, revAfterAdd + 1);

      const audit = await owner.auditOutbox.findFirst({
        where: {
          payload: {
            path: ["metadata", "status"],
            equals: "education_deleted",
          },
        },
      });
      assert.ok(audit, "education_deleted audit event must exist");
    });

    await t.test("DELETE /skills/:id removes entry, increments revision, and logs audit", async () => {
      const revBefore = (await getProfile("alice")).revision;

      const addRes = await fetch(`${baseUrl}/skills`, {
        method: "POST",
        headers: headers("alice"),
        body: JSON.stringify({
          expectedRevision: revBefore,
          name: "TypeScript",
          category: "Languages",
          proficiency: "advanced",
        }),
      });
      assert.equal(addRes.status, 201);
      const entryId = (await addRes.json()).data.entry.id;
      const revAfterAdd = (await getProfile("alice")).revision;

      const delRes = await fetch(`${baseUrl}/skills/${entryId}`, {
        method: "DELETE",
        headers: headers("alice"),
        body: JSON.stringify({ expectedRevision: revAfterAdd }),
      });
      assert.equal(delRes.status, 200);
      assert.equal(await owner.skill.findUnique({ where: { id: entryId } }), null);
      assert.equal((await getProfile("alice")).revision, revAfterAdd + 1);

      const audit = await owner.auditOutbox.findFirst({
        where: {
          payload: {
            path: ["metadata", "status"],
            equals: "skill_deleted",
          },
        },
      });
      assert.ok(audit, "skill_deleted audit event must exist");
    });

    await t.test("DELETE /projects/:id removes entry, increments revision, and logs audit", async () => {
      const revBefore = (await getProfile("alice")).revision;

      const addRes = await fetch(`${baseUrl}/projects`, {
        method: "POST",
        headers: headers("alice"),
        body: JSON.stringify({
          expectedRevision: revBefore,
          name: "Distributed Cache",
          description: "Built Raft-based cache",
          url: "https://example.com/cache",
          technologies: ["Go", "Raft"],
          startDate: "2023-01",
          endDate: "2023-06",
        }),
      });
      assert.equal(addRes.status, 201);
      const entryId = (await addRes.json()).data.entry.id;
      const revAfterAdd = (await getProfile("alice")).revision;

      const delRes = await fetch(`${baseUrl}/projects/${entryId}`, {
        method: "DELETE",
        headers: headers("alice"),
        body: JSON.stringify({ expectedRevision: revAfterAdd }),
      });
      assert.equal(delRes.status, 200);
      assert.equal(await owner.userProject.findUnique({ where: { id: entryId } }), null);
      assert.equal((await getProfile("alice")).revision, revAfterAdd + 1);

      const audit = await owner.auditOutbox.findFirst({
        where: {
          payload: {
            path: ["metadata", "status"],
            equals: "project_deleted",
          },
        },
      });
      assert.ok(audit, "project_deleted audit event must exist");
    });

    await t.test("DELETE /certifications/:id removes entry, increments revision, and logs audit", async () => {
      const revBefore = (await getProfile("alice")).revision;

      const addRes = await fetch(`${baseUrl}/certifications`, {
        method: "POST",
        headers: headers("alice"),
        body: JSON.stringify({
          expectedRevision: revBefore,
          name: "AWS Certified Developer",
          issuer: "Amazon Web Services",
          issueDate: "2022-04",
          expiryDate: "2025-04",
        }),
      });
      assert.equal(addRes.status, 201);
      const entryId = (await addRes.json()).data.entry.id;
      const revAfterAdd = (await getProfile("alice")).revision;

      const delRes = await fetch(`${baseUrl}/certifications/${entryId}`, {
        method: "DELETE",
        headers: headers("alice"),
        body: JSON.stringify({ expectedRevision: revAfterAdd }),
      });
      assert.equal(delRes.status, 200);
      assert.equal(await owner.certification.findUnique({ where: { id: entryId } }), null);
      assert.equal((await getProfile("alice")).revision, revAfterAdd + 1);

      const audit = await owner.auditOutbox.findFirst({
        where: {
          payload: {
            path: ["metadata", "status"],
            equals: "certification_deleted",
          },
        },
      });
      assert.ok(audit, "certification_deleted audit event must exist");
    });

    await t.test("DELETE prevents cross-tenant deletion", async () => {
      // Bob adds a skill
      const bobRev = (await getProfile("bob")).revision;
      const addRes = await fetch(`${baseUrl}/skills`, {
        method: "POST",
        headers: headers("bob"),
        body: JSON.stringify({
          expectedRevision: bobRev,
          name: "Go",
          category: "Languages",
          proficiency: "advanced",
        }),
      });
      assert.equal(addRes.status, 201);
      const bobSkillId = (await addRes.json()).data.entry.id;

      // Alice attempts to delete Bob's skill -> returns 404 not found
      const aliceRev = (await getProfile("alice")).revision;
      const crossDel = await fetch(`${baseUrl}/skills/${bobSkillId}`, {
        method: "DELETE",
        headers: headers("alice"),
        body: JSON.stringify({ expectedRevision: aliceRev }),
      });
      assert.equal(crossDel.status, 404);

      // Verify Bob's skill still exists
      const bobSkill = await owner.skill.findUnique({ where: { id: bobSkillId } });
      assert.ok(bobSkill, "Bob's skill must not be deleted by Alice");

      // Verify Alice's revision was not changed
      assert.equal((await getProfile("alice")).revision, aliceRev);
    });

    // ==========================================
    // 3. Onboarding Completion Tests
    // ==========================================
    await t.test("POST /complete completes onboarding, increments revision, and rejects re-completion", async () => {
      const revBefore = (await getProfile("alice")).revision;

      // Stale expectedRevision returns 409
      const staleRes = await fetch(`${baseUrl}/complete`, {
        method: "POST",
        headers: headers("alice"),
        body: JSON.stringify({ expectedRevision: revBefore - 1 }),
      });
      assert.equal(staleRes.status, 409);

      // Successful completion
      const completeRes = await fetch(`${baseUrl}/complete`, {
        method: "POST",
        headers: headers("alice"),
        body: JSON.stringify({ expectedRevision: revBefore }),
      });
      assert.equal(completeRes.status, 200);
      const completeBody = await completeRes.json();
      assert.equal(completeBody.data.id, people.alice.profile.id);
      assert.ok(completeBody.data.onboardingCompletedAt);
      assert.equal(completeBody.data.revision, revBefore + 1);

      // Verify in PostgreSQL database
      const dbProfile = await owner.userProfile.findUnique({
        where: { id: people.alice.profile.id },
      });
      assert.ok(dbProfile.onboardingCompletedAt instanceof Date);
      assert.equal(dbProfile.revision, revBefore + 1);

      // Verify audit outbox event
      const audit = await owner.auditOutbox.findFirst({
        where: {
          payload: {
            path: ["metadata", "status"],
            equals: "onboarding_completed",
          },
        },
      });
      assert.ok(audit, "onboarding_completed audit event must exist");

      // Completing again returns 409 onboarding_complete
      const reComplete = await fetch(`${baseUrl}/complete`, {
        method: "POST",
        headers: headers("alice"),
        body: JSON.stringify({ expectedRevision: revBefore + 1 }),
      });
      assert.equal(reComplete.status, 409);
      assert.equal((await reComplete.json()).error.code, "onboarding_complete");

      // Draft PUT now returns 409 onboarding_complete
      const draftRes = await fetch(`${baseUrl}/draft`, {
        method: "PUT",
        headers: headers("alice"),
        body: JSON.stringify({
          expectedRevision: revBefore + 1,
          location: "New York, NY",
        }),
      });
      assert.equal(draftRes.status, 409);
      assert.equal((await draftRes.json()).error.code, "onboarding_complete");
    });
  } finally {
    for (const server of servers) await close(server);
    await owner.$disconnect();
    for (const service of Object.keys(runtime))
      await runtime[service].$disconnect();
    await admin.end();
    await lifecycle.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await lifecycle.end();
  }
});
