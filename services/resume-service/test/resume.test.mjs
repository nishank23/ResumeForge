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
    let resume2Id;
    let resume3Id;

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
      resume2Id = body.data.id;
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

    // 8. Multi-resume isolation: User A has 3 resumes; updating Resume 1 must update ONLY Resume 1
    await t.test("multi-resume isolation: updating Resume 1 leaves Resume 2 and Resume 3 untouched", async () => {
      // 8a. Create 3rd resume for Alice via plain text import
      const execText =
        "Alice Engineer\nExecutive Vice President\nalice@example.invalid\n\nExecutive Summary\nExecutive engineering leader with 15+ years experience.\n\nExperience\nVP Engineering - Enterprise Tech\n2018 - Present\nScaling global engineering org.";
      const res3 = await app.request("/api/v1/resume/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer alice-token",
        },
        body: JSON.stringify({
          fileName: "Alice_Executive.txt",
          mimeType: "text/plain",
          fileBase64: Buffer.from(execText, "utf8").toString("base64"),
          title: "Alice Executive Resume",
        }),
      });
      assert.equal(res3.status, 201);
      const body3 = await res3.json();
      resume3Id = body3.data.id;

      // Alice now has 3 distinct resumes: createdResumeId (1), resume2Id (2), resume3Id (3)
      const listRes = await app.request("/api/v1/resume", {
        method: "GET",
        headers: { Authorization: "Bearer alice-token" },
      });
      assert.equal(listRes.status, 200);
      const listBody = await listRes.json();
      assert.equal(listBody.data.length, 3);

      // Verify baseline versions before update
      const r1Before = await owner.resume.findUnique({ where: { id: createdResumeId } });
      const r2Before = await owner.resume.findUnique({ where: { id: resume2Id } });
      const r3Before = await owner.resume.findUnique({ where: { id: resume3Id } });
      assert.equal(r1Before.currentVersion, 1);
      assert.equal(r2Before.currentVersion, 1);
      assert.equal(r3Before.currentVersion, 1);

      const getR1 = await app.request(`/api/v1/resume/${createdResumeId}`, {
        method: "GET",
        headers: { Authorization: "Bearer alice-token" },
      });
      assert.equal(getR1.status, 200);
      const r1Json = await getR1.json();
      const updatedContent = {
        ...r1Json.data.content,
        title: "Alice Cloud Principal Architect",
        header: {
          ...r1Json.data.content.header,
          headline: "Principal Cloud Architect",
        },
      };

      // 8b. Update Resume 1 ONLY with expectedVersion: 1
      const updateRes = await app.request(`/api/v1/resume/${createdResumeId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer alice-token",
        },
        body: JSON.stringify({
          expectedVersion: 1,
          title: "Alice Cloud Principal Architect",
          templateId: "modern-tech",
          content: updatedContent,
        }),
      });

      assert.equal(updateRes.status, 200);
      const updateBody = await updateRes.json();
      assert.equal(updateBody.data.id, createdResumeId);
      assert.equal(updateBody.data.currentVersion, 2);
      assert.equal(updateBody.data.title, "Alice Cloud Principal Architect");
      assert.equal(updateBody.data.templateId, "modern-tech");

      // 8c. STRICT ISOLATION ASSERTION:
      // Resume 1 must have currentVersion 2, templateId "modern-tech", and 2 versions
      const r1After = await owner.resume.findUnique({
        where: { id: createdResumeId },
        include: { versions: { orderBy: { versionNumber: "asc" } } },
      });
      assert.equal(r1After.currentVersion, 2);
      assert.equal(r1After.templateId, "modern-tech");
      assert.equal(r1After.versions.length, 2);
      assert.equal(r1After.versions[0].versionNumber, 1);
      assert.equal(r1After.versions[1].versionNumber, 2);

      // Resume 2 MUST BE UNTOUCHED: currentVersion 1, 1 version record, content intact
      const r2After = await owner.resume.findUnique({
        where: { id: resume2Id },
        include: { versions: true },
      });
      assert.equal(r2After.currentVersion, 1);
      assert.equal(r2After.versions.length, 1);
      assert.deepEqual(r2After.content, r2Before.content);

      // Resume 3 MUST BE UNTOUCHED: currentVersion 1, 1 version record, content intact
      const r3After = await owner.resume.findUnique({
        where: { id: resume3Id },
        include: { versions: true },
      });
      assert.equal(r3After.currentVersion, 1);
      assert.equal(r3After.versions.length, 1);
      assert.deepEqual(r3After.content, r3Before.content);

      // 8d. Verify optimistic concurrency conflict when using stale expectedVersion
      const staleRes = await app.request(`/api/v1/resume/${createdResumeId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer alice-token",
        },
        body: JSON.stringify({
          expectedVersion: 1, // Stale! Current is 2
          title: "Conflicting Update",
          content: updatedContent,
        }),
      });
      assert.equal(staleRes.status, 409);
      const staleBody = await staleRes.json();
      assert.equal(staleBody.error.code, "revision_conflict");
    });

    // 9. Version history retrieval
    await t.test("lists version history for a resume in descending order", async () => {
      const res = await app.request(`/api/v1/resume/${createdResumeId}/versions`, {
        method: "GET",
        headers: { Authorization: "Bearer alice-token" },
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(Array.isArray(body.data));
      assert.equal(body.data.length, 2);
      assert.equal(body.data[0].versionNumber, 2);
      assert.equal(body.data[1].versionNumber, 1);
    });

    // 10. Resume download in multiple formats (json, markdown, text, html)
    await t.test("downloads resume in markdown, json, text and html formats with audit trail", async () => {
      // 10a. Markdown download
      const mdRes = await app.request(
        `/api/v1/resume/${createdResumeId}/download?format=markdown`,
        {
          method: "GET",
          headers: { Authorization: "Bearer alice-token" },
        },
      );
      assert.equal(mdRes.status, 200);
      assert.equal(
        mdRes.headers.get("content-type"),
        "text/markdown; charset=utf-8",
      );
      assert.ok(
        mdRes.headers.get("content-disposition")?.includes("attachment; filename="),
      );
      const mdText = await mdRes.text();
      assert.ok(mdText.includes("# Alice Engineer"));
      assert.ok(mdText.includes("Summary"));

      // 10b. JSON download
      const jsonRes = await app.request(
        `/api/v1/resume/${createdResumeId}/download?format=json`,
        {
          method: "GET",
          headers: { Authorization: "Bearer alice-token" },
        },
      );
      assert.equal(jsonRes.status, 200);
      assert.equal(
        jsonRes.headers.get("content-type"),
        "application/json; charset=utf-8",
      );
      const jsonObj = await jsonRes.json();
      assert.ok(jsonObj.basics || jsonObj.sections);

      // 10c. Text download
      const txtRes = await app.request(
        `/api/v1/resume/${createdResumeId}/download?format=text`,
        {
          method: "GET",
          headers: { Authorization: "Bearer alice-token" },
        },
      );
      assert.equal(txtRes.status, 200);
      assert.equal(
        txtRes.headers.get("content-type"),
        "text/plain; charset=utf-8",
      );

      // 10d. HTML download
      const htmlRes = await app.request(
        `/api/v1/resume/${createdResumeId}/download?format=html`,
        {
          method: "GET",
          headers: { Authorization: "Bearer alice-token" },
        },
      );
      assert.equal(htmlRes.status, 200);
      assert.equal(
        htmlRes.headers.get("content-type"),
        "text/html; charset=utf-8",
      );
      const htmlText = await htmlRes.text();
      assert.ok(htmlText.includes("<!DOCTYPE html>"));
      assert.ok(htmlText.includes("@media print"));

      // Verify resume.downloaded audit event
      const downloadAudit = await owner.auditOutbox.findFirst({
        where: {
          payload: {
            path: ["action"],
            equals: "resume.downloaded",
          },
        },
      });
      assert.ok(downloadAudit, "Audit event resume.downloaded must be captured");
    });

    // 11. Resume cloning
    await t.test("clones an existing resume into a distinct draft copy", async () => {
      const cloneRes = await app.request(
        `/api/v1/resume/${createdResumeId}/clone`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer alice-token",
          },
          body: JSON.stringify({
            title: "Alice Cloned Architect Resume",
          }),
        },
      );
      assert.equal(cloneRes.status, 201);
      const cloneBody = await cloneRes.json();
      assert.ok(cloneBody.data.id);
      assert.notEqual(cloneBody.data.id, createdResumeId);
      assert.equal(cloneBody.data.title, "Alice Cloned Architect Resume");
      assert.equal(cloneBody.data.currentVersion, 1);

      // Verify original resume is unchanged
      const orig = await owner.resume.findUnique({
        where: { id: createdResumeId },
      });
      assert.equal(orig.currentVersion, 2);
    });

    // 12. Resume deletion and foreign user protection
    await t.test("deletes resume with audit and verifies foreign user denial", async () => {
      // Bob cannot delete Alice's Resume 2
      const bobDeleteRes = await app.request(`/api/v1/resume/${resume2Id}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer bob-token" },
      });
      assert.equal(bobDeleteRes.status, 404);

      // Alice deletes Resume 1
      const aliceDeleteRes = await app.request(`/api/v1/resume/${createdResumeId}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer alice-token" },
      });
      assert.equal(aliceDeleteRes.status, 200);
      const deleteBody = await aliceDeleteRes.json();
      assert.equal(deleteBody.data.deleted, true);

      // Resume 1 is gone
      const getDeletedRes = await app.request(`/api/v1/resume/${createdResumeId}`, {
        method: "GET",
        headers: { Authorization: "Bearer alice-token" },
      });
      assert.equal(getDeletedRes.status, 404);

      // Resume 2 and Resume 3 are still intact!
      const get2Res = await app.request(`/api/v1/resume/${resume2Id}`, {
        method: "GET",
        headers: { Authorization: "Bearer alice-token" },
      });
      assert.equal(get2Res.status, 200);

      const get3Res = await app.request(`/api/v1/resume/${resume3Id}`, {
        method: "GET",
        headers: { Authorization: "Bearer alice-token" },
      });
      assert.equal(get3Res.status, 200);

      // Verify resume.deleted audit event
      const deleteAudit = await owner.auditOutbox.findFirst({
        where: {
          payload: {
            path: ["action"],
            equals: "resume.deleted",
          },
        },
      });
      assert.ok(deleteAudit, "Audit event resume.deleted must be captured");
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
