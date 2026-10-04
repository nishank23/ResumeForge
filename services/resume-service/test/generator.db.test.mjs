import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";
import { createDatabaseClient } from "@resume-forge/prisma-client";
import { Client } from "../../../scripts/runtime-roles.mjs";
import { createResumeUseCases } from "../dist/resume.js";

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
const databaseName = `rf_gen_test_${suffix}`;
const adminUrl = new URL(base);
adminUrl.pathname = "/postgres";
const lifecycle = new Client({ connectionString: adminUrl.href });
const url = new URL(base);
url.pathname = `/${databaseName}`;
const owner = createDatabaseClient(url.href);

test("Resume generation, section suggestions, and isolated suggestion application with real PostgreSQL", async (t) => {
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
            location: "San Francisco, CA",
            professionalSummary: "Staff Backend Engineer specializing in distributed databases.",
            contact: {
              create: {
                email: "alice@example.invalid",
                phone: "555-0199",
                linkedinUrl: "https://linkedin.com/in/alice-engineer",
                githubUrl: "https://github.com/alice-engineer",
              },
            },
            experiences: {
              create: [
                {
                  company: "CloudScale Inc",
                  title: "Senior Backend Engineer",
                  location: "San Francisco, CA",
                  startDate: "2021-02",
                  isCurrent: true,
                  bulletPoints: [
                    "Engineered distributed event queue processing 100k events/sec.",
                    "Optimized PostgreSQL schema reducing query latency by 45%.",
                  ],
                  sortOrder: 1,
                },
              ],
            },
            educations: {
              create: [
                {
                  institution: "Stanford University",
                  degree: "B.S. in Computer Science",
                  fieldOfStudy: "Computer Science",
                  startDate: "2016-09",
                  endDate: "2020-06",
                  gpa: "3.9",
                  sortOrder: 1,
                },
              ],
            },
            skills: {
              create: [
                { name: "TypeScript", category: "Languages", proficiency: "expert" },
                { name: "PostgreSQL", category: "Databases", proficiency: "expert" },
                { name: "Docker", category: "DevOps", proficiency: "intermediate" },
              ],
            },
            projects: {
              create: [
                {
                  name: "StreamDB",
                  description: "Embedded append-only log store built with TypeScript.",
                  url: "https://github.com/alice-engineer/streamdb",
                },
              ],
            },
            certifications: {
              create: [
                {
                  name: "AWS Solutions Architect",
                  issuer: "Amazon Web Services",
                  issueDate: "2022-03",
                },
              ],
            },
          },
        },
      },
      include: {
        personalWorkspace: true,
        profile: {
          include: {
            contact: true,
            experiences: true,
            educations: true,
            skills: true,
            projects: true,
            certifications: true,
          },
        },
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

    const aliceContext = {
      actor: {
        userId: aliceUser.id,
        personalWorkspaceId: aliceUser.personalWorkspace.id,
        expiresAt: Date.now() + 60_000,
      },
      correlationId: randomUUID(),
    };

    const bobContext = {
      actor: {
        userId: bobUser.id,
        personalWorkspaceId: bobUser.personalWorkspace.id,
        expiresAt: Date.now() + 60_000,
      },
      correlationId: randomUUID(),
    };

    let resume1Id = "";
    let resume2Id = "";
    let taskRunId = "";

    await t.test("1. generateResumeFromProfile creates resume with version 1 from master profile facts", async () => {
      const generated = await useCases.generateResumeFromProfile(aliceContext, {
        title: "Alice Master Resume",
        templateId: "default",
      });

      assert.ok(generated.id);
      resume1Id = generated.id;
      assert.equal(generated.title, "Alice Master Resume");
      assert.equal(generated.currentVersion, 1);
      assert.equal(generated.status, "draft");

      // Verify content populated from profile facts
      assert.equal(generated.content.header.fullName, "Alice Engineer");
      assert.equal(generated.content.header.city, "San Francisco");
      assert.equal(generated.content.header.state, "CA");
      assert.equal(generated.content.header.email, "alice@example.invalid");

      const expSec = generated.content.sections.find((s) => s.kind === "experience");
      assert.ok(expSec);
      assert.equal(expSec.entries.length, 1);
      assert.equal(expSec.entries[0].title, "Senior Backend Engineer");

      const skillSec = generated.content.sections.find((s) => s.kind === "skills");
      assert.ok(skillSec);
      assert.ok(skillSec.groups.length > 0);

      // Verify DB persistence of Resume and ResumeVersion
      const dbResume = await owner.resume.findUnique({
        where: { id: resume1Id },
        include: { versions: true },
      });
      assert.ok(dbResume);
      assert.equal(dbResume.currentVersion, 1);
      assert.equal(dbResume.ownerUserId, aliceUser.id);
      assert.equal(dbResume.versions.length, 1);
      assert.equal(dbResume.versions[0].versionNumber, 1);

      // Verify audit outbox
      const outboxRecords = await owner.auditOutbox.findMany();
      const match = outboxRecords.find(
        (o) => o.payload?.resourceId === resume1Id && o.payload?.action === "resume.created",
      );
      assert.ok(match);
    });

    await t.test("2. generateSectionSuggestion creates reviewable suggestion and logs TaskRun", async () => {
      const suggestion = await useCases.generateSectionSuggestion(aliceContext, resume1Id, {
        sectionKind: "experience",
        action: "improve_impact",
      });

      assert.ok(suggestion.taskRunId);
      assert.ok(suggestion.suggestionId);
      taskRunId = suggestion.taskRunId;
      assert.equal(suggestion.status, "pending_review");
      assert.ok(suggestion.suggestedContent.length > 0);
      assert.ok(suggestion.reasoning.length > 0);

      // Verify TaskRun record in PostgreSQL
      const dbTaskRun = await owner.taskRun.findUnique({
        where: { id: taskRunId },
      });
      assert.ok(dbTaskRun);
      assert.equal(dbTaskRun.kind, "section_suggestion");
      assert.equal(dbTaskRun.dispatchStatus, "completed");
      assert.equal(dbTaskRun.userId, aliceUser.id);
      assert.equal(dbTaskRun.resumeId, resume1Id);

      // Verify getTaskRunById
      const taskRunDto = await useCases.getTaskRunById(aliceContext, taskRunId);
      assert.equal(taskRunDto.id, taskRunId);
      assert.equal(taskRunDto.status, "completed");
      assert.ok(taskRunDto.result);
    });

    await t.test("3. applySectionSuggestion increments version to 2 and enforces optimistic concurrency", async () => {
      const applied = await useCases.applySectionSuggestion(aliceContext, resume1Id, {
        expectedVersion: 1,
        sectionKind: "experience",
        appliedContent: "Spearheaded distributed microservices platform processing 100k requests/sec.",
      });

      assert.equal(applied.currentVersion, 2);

      // Check DB versions
      const versions = await owner.resumeVersion.findMany({
        where: { resumeId: resume1Id },
        orderBy: { versionNumber: "asc" },
      });
      assert.equal(versions.length, 2);
      assert.equal(versions[0].versionNumber, 1);
      assert.equal(versions[1].versionNumber, 2);

      // Attempting to apply again with stale expectedVersion = 1 must throw revision_conflict
      await assert.rejects(
        useCases.applySectionSuggestion(aliceContext, resume1Id, {
          expectedVersion: 1,
          sectionKind: "experience",
          appliedContent: "Stale update should fail",
        }),
        (err) => err.code === "revision_conflict",
      );
    });

    await t.test("4. Single-resume isolation: updating Resume 1 does not affect Resume 2", async () => {
      // Create second resume for Alice
      const secondResume = await useCases.generateResumeFromProfile(aliceContext, {
        title: "Alice Second Resume",
      });
      resume2Id = secondResume.id;
      assert.equal(secondResume.currentVersion, 1);

      // Apply suggestion to Resume 1 (advancing to version 3)
      const updatedResume1 = await useCases.applySectionSuggestion(aliceContext, resume1Id, {
        expectedVersion: 2,
        sectionKind: "summary",
        appliedContent: "Lead Distributed Systems Architect with extensive PostgreSQL experience.",
      });
      assert.equal(updatedResume1.currentVersion, 3);

      // Check Resume 2 remains untouched at version 1
      const fetchedResume2 = await useCases.getResumeById(aliceContext, resume2Id);
      assert.equal(fetchedResume2.currentVersion, 1);
      assert.equal(fetchedResume2.title, "Alice Second Resume");

      const resume2Versions = await owner.resumeVersion.findMany({
        where: { resumeId: resume2Id },
      });
      assert.equal(resume2Versions.length, 1);
      assert.equal(resume2Versions[0].versionNumber, 1);
    });

    await t.test("5. Foreign actor denial: Bob cannot access or modify Alice's resumes or task runs", async () => {
      // Bob cannot generate suggestions on Alice's resume
      await assert.rejects(
        useCases.generateSectionSuggestion(bobContext, resume1Id, {
          sectionKind: "experience",
          action: "improve_impact",
        }),
        (err) => err.code === "not_found",
      );

      // Bob cannot apply suggestions to Alice's resume
      await assert.rejects(
        useCases.applySectionSuggestion(bobContext, resume1Id, {
          expectedVersion: 3,
          sectionKind: "experience",
          appliedContent: "Malicious update",
        }),
        (err) => err.code === "not_found",
      );

      // Bob cannot view Alice's task run
      await assert.rejects(
        useCases.getTaskRunById(bobContext, taskRunId),
        (err) => err.code === "not_found",
      );
    });

  } finally {
    await owner.$disconnect();
    await lifecycle.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    await lifecycle.end();
  }
});
