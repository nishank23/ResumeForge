import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";
import { deflateSync, deflateRawSync } from "node:zlib";
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
const databaseName = `rf_resume_test_${suffix}`;
const adminUrl = new URL(base);
adminUrl.pathname = "/postgres";
const lifecycle = new Client({ connectionString: adminUrl.href });
const url = new URL(base);
url.pathname = `/${databaseName}`;
const owner = createDatabaseClient(url.href);

test("Resume import, parsing and transactional persistence with real PostgreSQL", async (t) => {
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

    const app = createResumeApp({ resolveActor, resumes: useCases });

    let createdResumeId;

    // 3. Test PDF resume file import via POST /api/v1/resume/import
    await t.test("imports and persists a PDF resume with transactional audit", async () => {
      const pdfText =
        "BT\n/F1 12 Tf\n(Alice Engineer) Tj\nT*\n(Senior Cloud Architect) Tj\nT*\n(San Francisco, CA) Tj\nT*\n(alice@example.invalid) Tj\nT*\n(Professional Summary) Tj\nT*\n(Passionate cloud engineer with 10 years of experience) Tj\nT*\n(Work Experience) Tj\nT*\n(Staff Engineer - Acme Cloud) Tj\nT*\n(2020 - Present) Tj\nT*\n(Leading infrastructure and Kubernetes deployment) Tj\nET";

      const deflated = deflateSync(Buffer.from(pdfText, "utf8"));
      const pdfBody =
        "%PDF-1.4\n1 0 obj\n<< /Length " +
        deflated.length +
        " /Filter /FlateDecode >>\nstream\n" +
        deflated.toString("latin1") +
        "\nendstream\nendobj\nxref\n0 2\n0000000000 65535 f \n0000000010 00000 n \ntrailer\n<< /Size 2 /Root 1 0 R >>\nstartxref\n100\n%%EOF";

      const pdfBase64 = Buffer.from(pdfBody, "latin1").toString("base64");

      const res = await app.request("/api/v1/resume/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer alice-token",
        },
        body: JSON.stringify({
          fileName: "Alice_Cloud_Resume.pdf",
          mimeType: "application/pdf",
          fileBase64: pdfBase64,
          title: "Alice Cloud Resume",
        }),
      });

      assert.equal(res.status, 201);
      const body = await res.json();
      assert.ok(body.data);
      assert.equal(body.data.title, "Alice Cloud Resume");
      assert.equal(body.data.currentVersion, 1);
      assert.equal(body.data.status, "draft");
      assert.equal(body.data.workspaceId, aliceUser.personalWorkspace.id);

      createdResumeId = body.data.id;

      // Verify row in database: Resume table
      const dbResume = await owner.resume.findUnique({
        where: { id: createdResumeId },
        include: { versions: true },
      });
      assert.ok(dbResume);
      assert.equal(dbResume.ownerUserId, aliceUser.id);
      assert.equal(dbResume.currentVersion, 1);
      assert.equal(dbResume.versions.length, 1);
      assert.equal(dbResume.versions[0].versionNumber, 1);

      // Verify AuditOutbox row created atomically
      const auditOutbox = await owner.auditOutbox.findFirst({
        where: {
          payload: {
            path: ["action"],
            equals: "resume.created",
          },
        },
      });
      assert.ok(auditOutbox);
      assert.equal(auditOutbox.deliveryState, "pending");
    });

    // 4. Test DOCX resume file import
    await t.test("imports and persists a DOCX resume", async () => {
      const xml =
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
        "<w:body>" +
        "<w:p><w:r><w:t>Alice Engineer</w:t></w:r></w:p>" +
        "<w:p><w:r><w:t>Education</w:t></w:r></w:p>" +
        "<w:p><w:r><w:t>MIT - M.S. - Computer Science</w:t></w:r></w:p>" +
        "<w:p><w:r><w:t>2012 - 2014</w:t></w:r></w:p>" +
        "</w:body>" +
        "</w:document>";

      const deflatedXml = deflateRawSync(Buffer.from(xml, "utf8"));
      const fileName = "word/document.xml";
      const fileNameBuf = Buffer.from(fileName, "utf8");

      const header = Buffer.alloc(30);
      header.writeUInt32LE(0x04034b50, 0);
      header.writeUInt16LE(20, 4);
      header.writeUInt16LE(0, 6);
      header.writeUInt16LE(8, 8);
      header.writeUInt16LE(0, 10);
      header.writeUInt16LE(0, 12);
      header.writeUInt32LE(0x12345678, 14);
      header.writeUInt32LE(deflatedXml.length, 18);
      header.writeUInt32LE(Buffer.byteLength(xml), 22);
      header.writeUInt16LE(fileNameBuf.length, 26);
      header.writeUInt16LE(0, 28);

      const docxBuffer = Buffer.concat([header, fileNameBuf, deflatedXml]);
      const docxBase64 = docxBuffer.toString("base64");

      const res = await app.request("/api/v1/resume/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer alice-token",
        },
        body: JSON.stringify({
          fileName: "Alice_MIT.docx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          fileBase64: docxBase64,
          title: "Alice Academic Resume",
        }),
      });

      assert.equal(res.status, 201);
      const body = await res.json();
      assert.ok(body.data);
      assert.equal(body.data.title, "Alice Academic Resume");
    });

    // 5. Test GET /api/v1/resume/:id retrieval
    await t.test("fetches persisted resume by ID for the owner", async () => {
      const res = await app.request(`/api/v1/resume/${createdResumeId}`, {
        method: "GET",
        headers: { Authorization: "Bearer alice-token" },
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.data.id, createdResumeId);
      assert.equal(body.data.title, "Alice Cloud Resume");
      assert.ok(body.data.content);
      assert.ok(body.data.content.sections);
    });

    // 6. Test GET /api/v1/resume lists owner resumes
    await t.test("lists all resumes for the authenticated user", async () => {
      const res = await app.request("/api/v1/resume", {
        method: "GET",
        headers: { Authorization: "Bearer alice-token" },
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(Array.isArray(body.data));
      assert.equal(body.data.length, 2); // Alice imported 2 resumes
    });

    // 7. Test cross-user isolation: Bob cannot access Alice's resume
    await t.test("cross-user isolation: foreign user receives 404", async () => {
      const res = await app.request(`/api/v1/resume/${createdResumeId}`, {
        method: "GET",
        headers: { Authorization: "Bearer bob-token" },
      });

      assert.equal(res.status, 404);
      const body = await res.json();
      assert.equal(body.error.code, "not_found");
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
