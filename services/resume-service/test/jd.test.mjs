import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";
import { createDatabaseClient } from "@resume-forge/prisma-client";
import { Client } from "../../../scripts/runtime-roles.mjs";
import { createResumeUseCases } from "../dist/resume.js";
import { createResumeApp } from "../dist/app.js";

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
const databaseName = `rf_jd_test_${suffix}`;
const adminUrl = new URL(base);
adminUrl.pathname = "/postgres";
const lifecycle = new Client({ connectionString: adminUrl.href });
const url = new URL(base);
url.pathname = `/${databaseName}`;
const owner = createDatabaseClient(url.href);

const SAMPLE_JD_TEXT = `
Title: Senior Backend Systems Engineer
Company: CloudScale Systems
Employment Type: Full-time

About CloudScale Systems:
We design and operate cloud-native infrastructure for millions of enterprise developers.

Requirements:
- 5+ years of software development experience with backend systems
- Expert proficiency in TypeScript, Node.js, and PostgreSQL
- Strong hands-on experience with Docker, AWS, and Microservices architecture
- Solid knowledge of Distributed Systems and CI/CD pipelines
- Strong communication and mentoring skills

Preferred:
- Experience with Kubernetes and Redis
- Familiarity with GraphQL and Python

Responsibilities:
- Build high-throughput, low-latency microservices handling millions of requests
- Architect reliable database schemas and optimize PostgreSQL queries
- Collaborate with cross-functional teams in an Agile development environment
- Mentor junior engineers and participate in code reviews
`;

const SAMPLE_RESUME_TEXT = `
ALEX DEVELOPER
alex@example.invalid | 555-0199 | San Francisco, CA

SUMMARY
Senior Backend Systems Engineer with 6+ years of experience engineering high-performance microservices in TypeScript, Node.js, and PostgreSQL.

EXPERIENCE
Senior Software Engineer | CloudScale Tech | 2021 - Present
- Designed and maintained scalable microservices using Node.js and TypeScript, reducing latency by 40%.
- Optimized complex PostgreSQL database queries and migrated storage to AWS RDS.
- Managed containerized services with Docker and automated deployments using CI/CD pipelines.
- Mentored junior engineers and led code reviews within an Agile engineering team.

SKILLS
Technical: TypeScript, Node.js, PostgreSQL, Docker, AWS, Microservices, CI/CD, Distributed Systems
Practices: Agile, Code Review, Mentoring, Communication

EDUCATION
B.S. in Computer Science | UC Berkeley | 2015 - 2019
`;

test("Job Description parsing, JDHistory persistence, and ATS tailoring with real PostgreSQL", async (t) => {
  await lifecycle.connect();

  try {
    // 1. Setup disposable database
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
    assert.equal(migration.status, 0, "Prisma migrations must deploy cleanly");

    // 2. Provision synthetic users and workspaces
    const aliceUser = await owner.user.create({
      data: {
        email: "alice@example.invalid",
        name: "Alice Engineer",
        personalWorkspace: {
          create: {
            type: "individual",
          },
        },
        profile: {
          create: {
            fullName: "Alice Engineer",
          },
        },
      },
      include: {
        personalWorkspace: true,
        profile: true,
      },
    });

    const bobUser = await owner.user.create({
      data: {
        email: "bob@example.invalid",
        name: "Bob Designer",
        personalWorkspace: {
          create: {
            type: "individual",
          },
        },
        profile: {
          create: {
            fullName: "Bob Designer",
          },
        },
      },
      include: {
        personalWorkspace: true,
        profile: true,
      },
    });

    assert.ok(aliceUser.personalWorkspace);
    assert.ok(bobUser.personalWorkspace);

    const useCases = createResumeUseCases(owner);

    const resolveActor = async (auth) => {
      if (auth === "Bearer alice-token") {
        return {
          status: "authenticated",
          actor: {
            userId: aliceUser.id,
            personalWorkspaceId: aliceUser.personalWorkspace.id,
            expiresAt: Date.now() + 60_000,
          },
        };
      }
      if (auth === "Bearer bob-token") {
        return {
          status: "authenticated",
          actor: {
            userId: bobUser.id,
            personalWorkspaceId: bobUser.personalWorkspace.id,
            expiresAt: Date.now() + 60_000,
          },
        };
      }
      return { status: "unauthenticated" };
    };

    const app = createResumeApp({
      resolveActor,
      resumes: useCases,
    });

    // Subtest 1: POST /api/v1/jd/parse (public parse preview)
    await t.test("POST /api/v1/jd/parse extracts structured JD content without DB persistence", async () => {
      const res = await app.request("/api/v1/jd/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawJD: SAMPLE_JD_TEXT }),
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.data.jobTitle, "Senior Backend Systems Engineer");
      assert.equal(body.data.company, "CloudScale Systems");
      assert.equal(body.data.experienceLevel, "senior");
      assert.ok(Array.isArray(body.data.keywords));
      assert.ok(body.data.keywords.length >= 5);
      assert.ok(body.data.requirements.length >= 3);
    });

    // Subtest 2: POST /api/v1/jd (Alice creates and persists JD)
    let aliceJdId;
    await t.test("POST /api/v1/jd persists JDHistory and creates audit event", async () => {
      const res = await app.request("/api/v1/jd", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer alice-token",
        },
        body: JSON.stringify({
          rawJD: SAMPLE_JD_TEXT,
        }),
      });

      assert.equal(res.status, 201);
      const body = await res.json();
      aliceJdId = body.data.id;
      assert.ok(aliceJdId);
      assert.equal(body.data.jobTitle, "Senior Backend Systems Engineer");
      assert.equal(body.data.company, "CloudScale Systems");
      assert.equal(body.data.workspaceId, aliceUser.personalWorkspace.id);

      // Verify row in database
      const dbRecord = await owner.jDHistory.findUnique({
        where: { id: aliceJdId },
      });
      assert.ok(dbRecord);
      assert.equal(dbRecord.createdByUserId, aliceUser.id);
      assert.equal(dbRecord.workspaceId, aliceUser.personalWorkspace.id);
      assert.equal(dbRecord.jobTitle, "Senior Backend Systems Engineer");

      // Verify audit outbox event
      const audit = await owner.auditOutbox.findFirst({
        where: {
          payload: {
            path: ["action"],
            equals: "resume.created",
          },
        },
      });
      assert.ok(audit, "Audit event for JD creation must be written to auditOutbox");
    });

    // Subtest 3: GET /api/v1/jd/history lists Alice's JDs
    await t.test("GET /api/v1/jd/history lists owned JD histories in descending order", async () => {
      const res = await app.request("/api/v1/jd/history", {
        method: "GET",
        headers: { Authorization: "Bearer alice-token" },
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(Array.isArray(body.data));
      assert.equal(body.data.length, 1);
      assert.equal(body.data[0].id, aliceJdId);
      assert.equal(body.data[0].jobTitle, "Senior Backend Systems Engineer");
    });

    // Subtest 4: GET /api/v1/jd/:id gets single JD
    await t.test("GET /api/v1/jd/:id retrieves full JD details for owner", async () => {
      const res = await app.request(`/api/v1/jd/${aliceJdId}`, {
        method: "GET",
        headers: { Authorization: "Bearer alice-token" },
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.data.id, aliceJdId);
      assert.equal(body.data.company, "CloudScale Systems");
      assert.ok(Array.isArray(body.data.parsedKeywords));
    });

    // Subtest 5: Foreign-owner isolation (Bob cannot see or fetch Alice's JD)
    await t.test("Foreign actor (Bob) cannot view Alice's JD or list Alice's history", async () => {
      // Bob tries to fetch Alice's JD by ID
      const foreignGetRes = await app.request(`/api/v1/jd/${aliceJdId}`, {
        method: "GET",
        headers: { Authorization: "Bearer bob-token" },
      });
      assert.equal(foreignGetRes.status, 404, "Foreign JD access must return 404");

      // Bob lists his own JD history
      const bobListRes = await app.request("/api/v1/jd/history", {
        method: "GET",
        headers: { Authorization: "Bearer bob-token" },
      });
      assert.equal(bobListRes.status, 200);
      const bobBody = await bobListRes.json();
      assert.equal(bobBody.data.length, 0, "Bob must see 0 JD histories");
    });

    // Subtest 6: Resume creation & tailoring
    let aliceResume1Id;
    let aliceResume2Id;

    await t.test("POST /api/v1/resume/import creates 2 resumes for Alice", async () => {
      // Import Resume 1
      const res1 = await app.request("/api/v1/resume/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer alice-token",
        },
        body: JSON.stringify({
          fileName: "alice_backend.txt",
          mimeType: "text/plain",
          rawText: SAMPLE_RESUME_TEXT,
          title: "Alice Backend Resume",
        }),
      });
      assert.equal(res1.status, 201);
      const body1 = await res1.json();
      aliceResume1Id = body1.data.id;
      assert.equal(body1.data.atsScore, null);

      // Import Resume 2
      const res2 = await app.request("/api/v1/resume/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer alice-token",
        },
        body: JSON.stringify({
          fileName: "alice_frontend.txt",
          mimeType: "text/plain",
          rawText: "ALEX DEVELOPER\nFrontend Developer with HTML, CSS, JavaScript.",
          title: "Alice Frontend Resume",
        }),
      });
      assert.equal(res2.status, 201);
      const body2 = await res2.json();
      aliceResume2Id = body2.data.id;
      assert.equal(body2.data.atsScore, null);
    });

    // Subtest 7: Tailor Resume 1 against Alice's JD
    await t.test("POST /api/v1/resume/:id/tailor scores Resume 1 and persists ATS breakdown", async () => {
      const tailorRes = await app.request(`/api/v1/resume/${aliceResume1Id}/tailor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer alice-token",
        },
        body: JSON.stringify({
          jdHistoryId: aliceJdId,
        }),
      });

      assert.equal(tailorRes.status, 200);
      const tailorBody = await tailorRes.json();
      assert.equal(tailorBody.data.resumeId, aliceResume1Id);
      assert.equal(tailorBody.data.jdHistoryId, aliceJdId);
      assert.ok(tailorBody.data.atsScore >= 70, `Expected score >= 70, got ${tailorBody.data.atsScore}`);
      assert.equal(tailorBody.data.atsBreakdown.rubricVersion, "1.0.0");
      assert.ok(tailorBody.data.atsBreakdown.keywordMatch.matched.includes("TypeScript"));
      assert.ok(tailorBody.data.atsBreakdown.keywordMatch.matched.includes("PostgreSQL"));

      // Verify Resume 1 in DB has atsScore, atsBreakdown, and jdHistoryId
      const resume1Db = await owner.resume.findUnique({
        where: { id: aliceResume1Id },
      });
      assert.ok(resume1Db);
      assert.equal(resume1Db.atsScore, tailorBody.data.atsScore);
      assert.equal(resume1Db.jdHistoryId, aliceJdId);
      assert.ok(resume1Db.atsBreakdown);

      // Verify latest ResumeVersion also has atsScore
      const versionDb = await owner.resumeVersion.findFirst({
        where: { resumeId: aliceResume1Id },
        orderBy: { versionNumber: "desc" },
      });
      assert.ok(versionDb);
      assert.equal(versionDb.atsScore, tailorBody.data.atsScore);

      // Strict ID Isolation: Resume 2 must NOT be altered!
      const resume2Db = await owner.resume.findUnique({
        where: { id: aliceResume2Id },
      });
      assert.ok(resume2Db);
      assert.equal(resume2Db.atsScore, null, "Resume 2 atsScore must remain null");
      assert.equal(resume2Db.jdHistoryId, null, "Resume 2 jdHistoryId must remain null");

      // Verify audit outbox has resume.updated event for tailoring
      const audit = await owner.auditOutbox.findFirst({
        where: {
          payload: {
            path: ["metadata", "reasonCode"],
            equals: "tailor_resume",
          },
        },
      });
      assert.ok(audit, "Audit event for tailor_resume must be captured");
    });

    // Subtest 8: Foreign tailor attempt is denied
    await t.test("Bob cannot tailor Alice's resume", async () => {
      const foreignTailorRes = await app.request(`/api/v1/resume/${aliceResume1Id}/tailor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer bob-token",
        },
        body: JSON.stringify({ jdHistoryId: aliceJdId }),
      });
      assert.equal(foreignTailorRes.status, 404, "Bob tailoring Alice's resume must return 404");
    });
  } finally {
    await owner.$disconnect();
    try {
      await lifecycle.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${databaseName}'`,
      );
      await lifecycle.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    } catch {
      // ignore teardown errors
    }
    await lifecycle.end();
  }
});
