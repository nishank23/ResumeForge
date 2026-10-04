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
const databaseName = `rf_gap_test_${suffix}`;
const adminUrl = new URL(base);
adminUrl.pathname = "/postgres";
const lifecycle = new Client({ connectionString: adminUrl.href });
const url = new URL(base);
url.pathname = `/${databaseName}`;
const owner = createDatabaseClient(url.href);

const SAMPLE_RESUME_TEXT = `
ALICE DEVELOPER
alice@example.invalid | +1 555-0199 | San Francisco, CA

SUMMARY
Senior Software Engineer specializing in TypeScript, Node.js, and containerized backend architectures.

EXPERIENCE
Senior Backend Engineer | CloudTech | 2021 - Present
- Designed and built microservices using TypeScript and Node.js.
- Containerized development workflows using Docker.

SKILLS
TypeScript, Node.js, Docker

EDUCATION
B.S. in Computer Science | UC Berkeley | 2015 - 2019
`;

const SAMPLE_JD_TEXT = `
Title: Lead Distributed Systems Architect
Company: ScaleGrid Corp
Employment Type: Full-time

About the role:
We are looking for an experienced engineer to lead our distributed platform engineering team.

Required Qualifications:
- 5+ years building backend systems with TypeScript
- Hands-on production experience with Kubernetes (k8s)
- Strong experience with Rust for performance-critical systems

Preferred Qualifications:
- Experience with PostgreSQL and schema design
- Experience with Kafka event streaming architectures

Responsibilities:
- Build fault-tolerant microservices
- Oversee Kubernetes infrastructure and continuous delivery
`;

test("Keyword & skill gap analysis and JD history deletion with real PostgreSQL", async (t) => {
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
        name: "Alice Developer",
        personalWorkspace: {
          create: {
            type: "individual",
          },
        },
        profile: {
          create: {
            fullName: "Alice Developer",
            location: "San Francisco, CA",
            professionalSummary: "Backend specialist with deep experience in cloud platforms.",
            revision: 5,
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
        name: "Bob Foreign",
        personalWorkspace: {
          create: {
            type: "individual",
          },
        },
        profile: {
          create: {
            fullName: "Bob Foreign",
          },
        },
      },
      include: {
        personalWorkspace: true,
        profile: true,
      },
    });

    assert.ok(aliceUser.personalWorkspace);
    assert.ok(aliceUser.profile);
    assert.ok(bobUser.personalWorkspace);
    assert.ok(bobUser.profile);

    // 3. Seed Alice's Master Profile facts (Experience, Skills, Projects, Certifications)
    // Note: UserContact is separate and should NEVER be leaked
    await owner.experience.create({
      data: {
        profileId: aliceUser.profile.id,
        company: "CloudTech",
        title: "Senior Backend Engineer",
        bulletPoints: [
          "Designed and built microservices using TypeScript and Node.js.",
          "Maintained production Kubernetes clusters (k8s) and helm charts across 3 AWS regions.",
        ],
        sortOrder: 0,
      },
    });

    await owner.skill.createMany({
      data: [
        {
          profileId: aliceUser.profile.id,
          name: "TypeScript",
          category: "Languages",
          proficiency: "expert",
        },
        {
          profileId: aliceUser.profile.id,
          name: "Node.js",
          category: "Frameworks",
          proficiency: "expert",
        },
        {
          profileId: aliceUser.profile.id,
          name: "PostgreSQL",
          category: "Databases",
          proficiency: "advanced",
        },
      ],
    });

    await owner.userProject.create({
      data: {
        profileId: aliceUser.profile.id,
        name: "Telemetry Pipeline",
        description: "High-throughput log pipeline",
        technologies: ["Kafka", "Go", "Docker"],
      },
    });

    await owner.certification.create({
      data: {
        profileId: aliceUser.profile.id,
        name: "Certified Kubernetes Administrator",
        issuer: "Cloud Native Computing Foundation",
      },
    });

    // 4. Configure real service & app
    const resolveActor = async (authorization) => {
      if (authorization === "Bearer alice-token") {
        return {
          status: "authenticated",
          actor: {
            userId: aliceUser.id,
            personalWorkspaceId: aliceUser.personalWorkspace.id,
            expiresAt: Date.now() + 60_000,
          },
        };
      }
      if (authorization === "Bearer bob-token") {
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

    const resumes = createResumeUseCases(owner);
    const app = createResumeApp({ resolveActor, resumes });

    let aliceResume1Id;
    let aliceResume2Id;
    let aliceResume3Id;
    let aliceJdId;

    // 5. Alice imports Resume 1
    await t.test("Alice imports Resume 1", async () => {
      const res = await app.request("/api/v1/resume/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer alice-token",
        },
        body: JSON.stringify({
          fileName: "Alice_Resume_1.txt",
          mimeType: "text/plain",
          rawText: SAMPLE_RESUME_TEXT,
          title: "Alice Target Resume 1",
        }),
      });
      assert.equal(res.status, 201);
      const body = await res.json();
      aliceResume1Id = body.data.id;
      assert.ok(aliceResume1Id);
      assert.equal(body.data.currentVersion, 1);
    });

    // 6. Alice imports Resume 2 and Resume 3 (multi-resume verification)
    await t.test("Alice imports Resume 2 and Resume 3 for multi-resume isolation", async () => {
      const res2 = await app.request("/api/v1/resume/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer alice-token",
        },
        body: JSON.stringify({
          fileName: "Alice_Resume_2.txt",
          mimeType: "text/plain",
          rawText: "Alice Developer\nalice@example.invalid\nSummary\nJunior Resume",
          title: "Alice Resume 2",
        }),
      });
      assert.equal(res2.status, 201);
      const b2 = await res2.json();
      aliceResume2Id = b2.data.id;

      const res3 = await app.request("/api/v1/resume/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer alice-token",
        },
        body: JSON.stringify({
          fileName: "Alice_Resume_3.txt",
          mimeType: "text/plain",
          rawText: "Alice Developer\nalice@example.invalid\nSummary\nSenior Resume",
          title: "Alice Resume 3",
        }),
      });
      assert.equal(res3.status, 201);
      const b3 = await res3.json();
      aliceResume3Id = b3.data.id;

      const listRes = await app.request("/api/v1/resume", {
        method: "GET",
        headers: { Authorization: "Bearer alice-token" },
      });
      assert.equal(listRes.status, 200);
      const listBody = await listRes.json();
      assert.equal(listBody.data.length, 3);
    });

    // 7. Alice saves a JD and tailors Resume 1 to link it
    await t.test("Alice saves JD and links it to Resume 1 via tailoring", async () => {
      const jdRes = await app.request("/api/v1/jd", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer alice-token",
        },
        body: JSON.stringify({
          rawJD: SAMPLE_JD_TEXT,
          jobTitle: "Lead Distributed Systems Architect",
          company: "ScaleGrid Corp",
        }),
      });
      assert.equal(jdRes.status, 201);
      const jdBody = await jdRes.json();
      aliceJdId = jdBody.data.id;
      assert.ok(aliceJdId);

      // Tailor Resume 1 to link jdHistoryId
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
      assert.equal(tailorBody.data.jdHistoryId, aliceJdId);

      // Verify DB link
      const r1 = await owner.resume.findUnique({ where: { id: aliceResume1Id } });
      assert.equal(r1.jdHistoryId, aliceJdId);
    });

    // 8. Run Keyword & Skill Gap Analysis on Resume 1
    await t.test("POST /api/v1/resume/:id/gap-analysis classifies matched, supported_missing, and unsupported_missing", async () => {
      const gapRes = await app.request(`/api/v1/resume/${aliceResume1Id}/gap-analysis`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer alice-token",
        },
        body: JSON.stringify({
          jdHistoryId: aliceJdId,
        }),
      });

      assert.equal(gapRes.status, 200);
      const gapBody = await gapRes.json();
      const data = gapBody.data;

      assert.equal(data.resumeId, aliceResume1Id);
      assert.equal(data.jdHistoryId, aliceJdId);
      assert.equal(data.profileRevision, 5);

      // Verify matched keywords: TypeScript is present in Resume 1
      const tsMatch = data.matched.find((m) => m.keyword.toLowerCase().includes("typescript"));
      assert.ok(tsMatch, "TypeScript must be in matched");

      // Verify supported missing: Kubernetes is in Master Profile (experience & cert), but NOT in Resume 1
      const k8sMissing = data.supportedMissing.find((m) =>
        m.keyword.toLowerCase().includes("kubernetes") || m.keyword.toLowerCase().includes("k8s"),
      );
      assert.ok(k8sMissing, "Kubernetes must be in supportedMissing");
      assert.equal(k8sMissing.profileRevision, 5);
      assert.ok(k8sMissing.supportingEvidence.length > 0);

      // Verify supported missing: PostgreSQL is in Master Profile (skills), but NOT in Resume 1
      const pgMissing = data.supportedMissing.find((m) =>
        m.keyword.toLowerCase().includes("postgresql") || m.keyword.toLowerCase().includes("postgres"),
      );
      assert.ok(pgMissing, "PostgreSQL must be in supportedMissing");
      assert.equal(pgMissing.supportingSourceSection, "skills");

      // Verify unsupported missing: Rust is NOT in Resume 1 and NOT in Master Profile
      const rustMissing = data.unsupportedMissing.find((m) =>
        m.keyword.toLowerCase().includes("rust"),
      );
      assert.ok(rustMissing, "Rust must be in unsupportedMissing");
      assert.equal(rustMissing.explanation, "Not found in this profile.");

      // Check invariant: contact facts never leaked
      const serialized = JSON.stringify(data);
      assert.ok(!serialized.includes("alice@example.invalid"));
      assert.ok(!serialized.includes("+1 555-0199"));
    });

    // 9. GET /api/v1/resume/:id/gap-analysis uses linked JD automatically
    await t.test("GET /api/v1/resume/:id/gap-analysis resolves linked JD and returns 200", async () => {
      const getGapRes = await app.request(`/api/v1/resume/${aliceResume1Id}/gap-analysis`, {
        method: "GET",
        headers: { Authorization: "Bearer alice-token" },
      });
      assert.equal(getGapRes.status, 200);
      const getGapBody = await getGapRes.json();
      assert.equal(getGapBody.data.resumeId, aliceResume1Id);
      assert.equal(getGapBody.data.jdHistoryId, aliceJdId);
      assert.ok(getGapBody.data.matched.length > 0);
    });

    // 10. Foreign user (Bob) is denied gap analysis and JD deletion
    await t.test("Bob cannot run gap analysis on Alice's resume or delete Alice's JD", async () => {
      const bobGap = await app.request(`/api/v1/resume/${aliceResume1Id}/gap-analysis`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer bob-token",
        },
        body: JSON.stringify({ jdHistoryId: aliceJdId }),
      });
      assert.equal(bobGap.status, 404);

      const bobDeleteJd = await app.request(`/api/v1/jd/${aliceJdId}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer bob-token" },
      });
      assert.equal(bobDeleteJd.status, 404);
    });

    // 11. Multi-resume isolation: updating Resume 1 leaves Resume 2 and Resume 3 untouched
    await t.test("Multi-resume isolation: updating Resume 1 does not affect Resume 2 or Resume 3", async () => {
      const r2Before = await owner.resume.findUnique({ where: { id: aliceResume2Id } });
      const r3Before = await owner.resume.findUnique({ where: { id: aliceResume3Id } });

      const getR1 = await app.request(`/api/v1/resume/${aliceResume1Id}`, {
        method: "GET",
        headers: { Authorization: "Bearer alice-token" },
      });
      assert.equal(getR1.status, 200);
      const r1Json = await getR1.json();
      const updatedContent = {
        ...r1Json.data.content,
        title: "Alice Target Resume 1 - Updated",
      };

      const updateRes = await app.request(`/api/v1/resume/${aliceResume1Id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer alice-token",
        },
        body: JSON.stringify({
          expectedVersion: 1,
          title: "Alice Target Resume 1 - Updated",
          content: updatedContent,
        }),
      });
      assert.equal(updateRes.status, 200);

      const r1After = await owner.resume.findUnique({ where: { id: aliceResume1Id } });
      const r2After = await owner.resume.findUnique({ where: { id: aliceResume2Id } });
      const r3After = await owner.resume.findUnique({ where: { id: aliceResume3Id } });

      assert.equal(r1After.currentVersion, 2, "Resume 1 must increment to version 2");
      assert.equal(r2After.currentVersion, r2Before.currentVersion, "Resume 2 version must remain unchanged");
      assert.equal(r3After.currentVersion, r3Before.currentVersion, "Resume 3 version must remain unchanged");
    });

    // 12. JD History Deletion: deletes JDHistory and safely nullifies Resume.jdHistoryId
    await t.test("DELETE /api/v1/jd/:id deletes JDHistory and nullifies Resume 1 reference", async () => {
      // Prior to deletion, Resume 1 references aliceJdId
      const r1Before = await owner.resume.findUnique({ where: { id: aliceResume1Id } });
      assert.equal(r1Before.jdHistoryId, aliceJdId);

      const delRes = await app.request(`/api/v1/jd/${aliceJdId}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer alice-token" },
      });
      assert.equal(delRes.status, 200);
      const delBody = await delRes.json();
      assert.equal(delBody.data.deleted, true);
      assert.equal(delBody.data.id, aliceJdId);

      // Verify JDHistory is completely gone from DB
      const jdAfter = await owner.jDHistory.findUnique({ where: { id: aliceJdId } });
      assert.equal(jdAfter, null, "JDHistory record must be deleted");

      // Verify Resume 1.jdHistoryId was safely nullified
      const r1After = await owner.resume.findUnique({ where: { id: aliceResume1Id } });
      assert.equal(r1After.jdHistoryId, null, "Resume.jdHistoryId must be nullified without error");

      // Verify AuditOutbox record
      const auditEntries = await owner.auditOutbox.findMany();
      const match = auditEntries.find((entry) => {
        const p = entry.payload;
        return p && p.resourceId === aliceJdId && p.action === "resume.deleted";
      });
      assert.ok(match, "AuditOutbox record for jd deletion must exist");
    });
  } finally {
    await owner.$disconnect();
    await lifecycle.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${databaseName}' AND pid <> pg_backend_pid()`,
    );
    await lifecycle.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    await lifecycle.end();
  }
});
