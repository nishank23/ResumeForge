import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createResumeApp } from "../dist/app.js";

const mockActor = {
  userId: randomUUID(),
  personalWorkspaceId: randomUUID(),
  expiresAt: Date.now() + 60_000,
};

function createMockService() {
  const resumes = {
    importResume: async (_context, input) => ({
      id: randomUUID(),
      profileId: randomUUID(),
      workspaceId: mockActor.personalWorkspaceId,
      title: input.title || "Imported Resume",
      templateId: input.templateId || "default",
      currentVersion: 1,
      status: "draft",
      atsScore: null,
      content: {
        title: input.title || "Imported Resume",
        header: {
          fullName: "Test User",
          firstName: "Test",
          lastName: "User",
          headline: "Engineer",
          city: "SF",
          state: "CA",
          country: "",
          email: "test@example.com",
          phone: "555-1234",
          links: [],
        },
        sampleContact: { email: "test@example.com", phone: "555-1234" },
        sections: [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    parseResumeOnly: async (input) => ({
      title: input.fileName,
      header: {
        fullName: "Test Candidate",
        firstName: "Test",
        lastName: "Candidate",
        headline: "Developer",
        city: "",
        state: "",
        country: "",
        email: "candidate@example.com",
        phone: "",
        links: [],
      },
      sampleContact: { email: "candidate@example.com", phone: "" },
      sections: [],
    }),
    getResumeById: async (_context, id) => ({
      id,
      profileId: randomUUID(),
      workspaceId: mockActor.personalWorkspaceId,
      title: "My Saved Resume",
      templateId: "default",
      currentVersion: 1,
      status: "draft",
      atsScore: null,
      content: {
        title: "My Saved Resume",
        header: {
          fullName: "Test User",
          firstName: "Test",
          lastName: "User",
          headline: "Engineer",
          city: "",
          state: "",
          country: "",
          email: "test@example.com",
          phone: "",
          links: [],
        },
        sampleContact: { email: "test@example.com", phone: "" },
        sections: [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    listResumes: async () => [
      {
        id: randomUUID(),
        profileId: randomUUID(),
        workspaceId: mockActor.personalWorkspaceId,
        title: "My Saved Resume",
        templateId: "default",
        currentVersion: 1,
        status: "draft",
        atsScore: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    updateResume: async (_context, id, input) => ({
      id,
      profileId: randomUUID(),
      workspaceId: mockActor.personalWorkspaceId,
      title: input.title || "Updated Resume",
      templateId: input.templateId || "default",
      currentVersion: input.expectedVersion + 1,
      status: input.status || "draft",
      atsScore: null,
      content: input.content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    deleteResume: async (_context, id) => ({
      deleted: true,
      id,
    }),
    downloadResume: async (_context, id, format) => ({
      content: `# Resume ${id}\nFormat: ${format}`,
      mimeType: format === "json" ? "application/json" : "text/markdown",
      fileName: `resume_${id}.${format === "json" ? "json" : "md"}`,
    }),
    listResumeVersions: async (_context, id) => [
      {
        id: randomUUID(),
        resumeId: id,
        versionNumber: 1,
        content: {
          title: "Version 1",
          header: { fullName: "User", firstName: "", lastName: "", headline: "", city: "", state: "", country: "", email: "", phone: "", links: [] },
          sampleContact: { email: "", phone: "" },
          sections: [],
        },
        createdAt: new Date().toISOString(),
        createdByUserId: mockActor.userId,
      },
    ],
    cloneResume: async (_context, id, title) => ({
      id: randomUUID(),
      profileId: randomUUID(),
      workspaceId: mockActor.personalWorkspaceId,
      title: title || "Cloned Resume",
      templateId: "default",
      currentVersion: 1,
      status: "draft",
      atsScore: null,
      content: {
        title: title || "Cloned Resume",
        header: { fullName: "User", firstName: "", lastName: "", headline: "", city: "", state: "", country: "", email: "", phone: "", links: [] },
        sampleContact: { email: "", phone: "" },
        sections: [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
  };

  const resolveActor = async (auth) => {
    if (auth === "Bearer valid-token") {
      return { status: "authenticated", actor: mockActor };
    }
    return { status: "unauthenticated" };
  };

  const app = createResumeApp({ resolveActor, resumes });
  return { app, resumes };
}

test("unauthenticated import requests return 401 with no-store", async () => {
  const { app } = createMockService();
  const res = await app.request("/api/v1/resume/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: "test.txt", rawText: "Some resume text" }),
  });

  assert.equal(res.status, 401);
  assert.equal(res.headers.get("Cache-Control"), "no-store");
  assert.equal(res.headers.get("Referrer-Policy"), "no-referrer");
  assert.ok(res.headers.get("X-Request-Id"));

  const body = await res.json();
  assert.equal(body.error.code, "unauthenticated");
});

test("unsupported content-type returns 415", async () => {
  const { app } = createMockService();
  const res = await app.request("/api/v1/resume/parse", {
    method: "POST",
    headers: { "Content-Type": "text/html" },
    body: "<h1>Resume</h1>",
  });

  assert.equal(res.status, 415);
  const body = await res.json();
  assert.equal(body.error.code, "unsupported_media_type");
});

test("POST /api/v1/resume/parse succeeds with valid JSON", async () => {
  const { app } = createMockService();
  const res = await app.request("/api/v1/resume/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: "resume.txt", rawText: "John Doe\nDeveloper" }),
  });

  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Cache-Control"), "no-store");
  const body = await res.json();
  assert.ok(body.data);
  assert.equal(body.data.title, "resume.txt");
  assert.ok(body.requestId);
});

test("POST /api/v1/resume/import succeeds with valid token and returns 201", async () => {
  const { app } = createMockService();
  const res = await app.request("/api/v1/resume/import", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer valid-token",
    },
    body: JSON.stringify({
      fileName: "resume.pdf",
      rawText: "Jane Doe\nArchitect\njane@example.com",
      title: "Custom Title",
    }),
  });

  assert.equal(res.status, 201);
  const body = await res.json();
  assert.ok(body.data);
  assert.equal(body.data.title, "Custom Title");
  assert.equal(body.data.currentVersion, 1);
  assert.equal(body.data.status, "draft");
});

test("GET /api/v1/resume/:id returns resume details", async () => {
  const { app } = createMockService();
  const targetId = randomUUID();
  const res = await app.request(`/api/v1/resume/${targetId}`, {
    method: "GET",
    headers: {
      Authorization: "Bearer valid-token",
    },
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.id, targetId);
  assert.equal(body.data.title, "My Saved Resume");
});

test("GET /api/v1/resume lists user resumes", async () => {
  const { app } = createMockService();
  const res = await app.request("/api/v1/resume", {
    method: "GET",
    headers: {
      Authorization: "Bearer valid-token",
    },
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.data));
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].title, "My Saved Resume");
});

test("PUT /api/v1/resume/:id updates resume and returns 200", async () => {
  const { app } = createMockService();
  const targetId = randomUUID();
  const res = await app.request(`/api/v1/resume/${targetId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer valid-token",
    },
    body: JSON.stringify({
      expectedVersion: 1,
      title: "Updated Title",
      content: {
        title: "Updated Title",
        header: {
          fullName: "Updated Name",
          firstName: "Updated",
          lastName: "Name",
          headline: "Lead Architect",
          city: "NYC",
          state: "NY",
          country: "",
          email: "updated@example.com",
          phone: "",
          links: [],
        },
        sampleContact: { email: "", phone: "" },
        sections: [],
      },
    }),
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.title, "Updated Title");
  assert.equal(body.data.currentVersion, 2);
});

test("DELETE /api/v1/resume/:id deletes resume and returns 200", async () => {
  const { app } = createMockService();
  const targetId = randomUUID();
  const res = await app.request(`/api/v1/resume/${targetId}`, {
    method: "DELETE",
    headers: {
      Authorization: "Bearer valid-token",
    },
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.deleted, true);
  assert.equal(body.data.id, targetId);
});

test("GET /api/v1/resume/:id/download returns formatted file with attachment header", async () => {
  const { app } = createMockService();
  const targetId = randomUUID();
  const res = await app.request(`/api/v1/resume/${targetId}/download?format=markdown`, {
    method: "GET",
    headers: {
      Authorization: "Bearer valid-token",
    },
  });

  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Content-Type"), "text/markdown");
  assert.ok(res.headers.get("Content-Disposition").includes("attachment; filename="));
  const text = await res.text();
  assert.ok(text.includes(`# Resume ${targetId}`));
});

test("GET /api/v1/resume/:id/versions returns version history", async () => {
  const { app } = createMockService();
  const targetId = randomUUID();
  const res = await app.request(`/api/v1/resume/${targetId}/versions`, {
    method: "GET",
    headers: {
      Authorization: "Bearer valid-token",
    },
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.data));
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].versionNumber, 1);
});

test("POST /api/v1/resume/:id/clone clones resume and returns 201", async () => {
  const { app } = createMockService();
  const targetId = randomUUID();
  const res = await app.request(`/api/v1/resume/${targetId}/clone`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer valid-token",
    },
    body: JSON.stringify({ title: "Cloned Copy" }),
  });

  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.data.title, "Cloned Copy");
  assert.equal(body.data.currentVersion, 1);
});
