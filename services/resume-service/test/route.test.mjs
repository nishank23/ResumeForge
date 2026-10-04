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
