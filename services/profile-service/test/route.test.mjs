import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createProfileApp } from "../dist/app.js";
import { ProfileError } from "../dist/contracts.js";

const actor = {
  userId: randomUUID(),
  personalWorkspaceId: randomUUID(),
  expiresAt: Date.now() + 300000,
};
const dto = {
  id: randomUUID(),
  fullName: "Synthetic Profile",
  location: null,
  professionalSummary: null,
  revision: 1,
};
const writeRoutes = [
  ["/api/v1/profile/contact", "PUT"],
  ["/api/v1/profile/complete", "POST"],
  ["/api/v1/profile", "PUT"],
  ["/api/v1/profile", "POST"],
  ["/api/v1/profile/draft", "PUT"],
  ["/api/v1/profile/experience", "POST"],
  [`/api/v1/profile/experience/${randomUUID()}`, "PUT"],
  [`/api/v1/profile/experience/${randomUUID()}`, "DELETE"],
  ["/api/v1/profile/education", "POST"],
  [`/api/v1/profile/education/${randomUUID()}`, "PUT"],
  [`/api/v1/profile/education/${randomUUID()}`, "DELETE"],
  ["/api/v1/profile/skills", "POST"],
  [`/api/v1/profile/skills/${randomUUID()}`, "PUT"],
  [`/api/v1/profile/skills/${randomUUID()}`, "DELETE"],
  ["/api/v1/profile/projects", "POST"],
  [`/api/v1/profile/projects/${randomUUID()}`, "PUT"],
  [`/api/v1/profile/projects/${randomUUID()}`, "DELETE"],
  ["/api/v1/profile/certifications", "POST"],
  [`/api/v1/profile/certifications/${randomUUID()}`, "PUT"],
  [`/api/v1/profile/certifications/${randomUUID()}`, "DELETE"],
];
function setup(
  resolveActor = async () => ({ status: "authenticated", actor }),
  error,
) {
  const calls = [];
  const operation = (kind) => async (context, input) => {
    calls.push({ kind, context, input });
    if (error) throw error;
    return dto;
  };
  const app = createProfileApp({
    resolveActor,
    profiles: {
      create: operation("create"),
      read: operation("read"),
      update: operation("update"),
      saveDraft: operation("saveDraft"),
      getContact: operation("getContact"),
      updateContact: operation("updateContact"),
      completeOnboarding: operation("completeOnboarding"),
      listExperience: operation("listExperience"),
      addExperience: operation("addExperience"),
      updateExperience: async (context, id, input) => {
        calls.push({ kind: "updateExperience", context, id, input });
        if (error) throw error;
        return dto;
      },
      deleteExperience: async (context, id, input) => {
        calls.push({ kind: "deleteExperience", context, id, input });
        if (error) throw error;
        return { profileId: dto.id, revision: 2, deletedEntryId: id };
      },
      listEducation: operation("listEducation"),
      addEducation: operation("addEducation"),
      updateEducation: async (context, id, input) => {
        calls.push({ kind: "updateEducation", context, id, input });
        if (error) throw error;
        return dto;
      },
      deleteEducation: async (context, id, input) => {
        calls.push({ kind: "deleteEducation", context, id, input });
        if (error) throw error;
        return { profileId: dto.id, revision: 2, deletedEntryId: id };
      },
      listSkills: operation("listSkills"),
      addSkill: operation("addSkill"),
      updateSkill: async (context, id, input) => {
        calls.push({ kind: "updateSkill", context, id, input });
        if (error) throw error;
        return dto;
      },
      deleteSkill: async (context, id, input) => {
        calls.push({ kind: "deleteSkill", context, id, input });
        if (error) throw error;
        return { profileId: dto.id, revision: 2, deletedEntryId: id };
      },
      listProjects: operation("listProjects"),
      addProject: operation("addProject"),
      updateProject: async (context, id, input) => {
        calls.push({ kind: "updateProject", context, id, input });
        if (error) throw error;
        return dto;
      },
      deleteProject: async (context, id, input) => {
        calls.push({ kind: "deleteProject", context, id, input });
        if (error) throw error;
        return { profileId: dto.id, revision: 2, deletedEntryId: id };
      },
      listCertifications: operation("listCertifications"),
      addCertification: operation("addCertification"),
      updateCertification: async (context, id, input) => {
        calls.push({ kind: "updateCertification", context, id, input });
        if (error) throw error;
        return dto;
      },
      deleteCertification: async (context, id, input) => {
        calls.push({ kind: "deleteCertification", context, id, input });
        if (error) throw error;
        return { profileId: dto.id, revision: 2, deletedEntryId: id };
      },
    },
  });
  return { app, calls };
}

test("invalid/unavailable authentication withholds profile calls before parsing", async () => {
  for (const [status, code] of [
    ["unauthenticated", 401],
    ["unavailable", 503],
  ]) {
    for (const [path, method] of writeRoutes) {
      const { app, calls } = setup(async () => ({ status }));
      const response = await app.request(path, {
        method,
        body: "malformed private body",
      });
      assert.equal(response.status, code);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
      assert.equal(calls.length, 0);
      assert.equal((await response.text()).includes("private body"), false);
    }
  }
});

test("uses a fresh verified actor and server correlation instead of identity headers", async () => {
  let count = 0;
  const { app, calls } = setup(async () => {
    count++;
    return count === 1
      ? { status: "authenticated", actor }
      : { status: "unauthenticated" };
  });
  const forged = randomUUID();
  const response = await app.request("/api/v1/profile", {
    headers: {
      Authorization: "Bearer actor-credential",
      "X-User-Id": forged,
      "X-Request-Id": forged,
      "X-Workspace-Id": actor.personalWorkspaceId,
      "X-Role": "ORG_OWNER",
    },
  });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, dto);
  assert.deepEqual(calls[0].context.actor, actor);
  assert.notEqual(calls[0].context.correlationId, forged);
  assert.equal(calls[0].context.selectedWorkspaceId, actor.personalWorkspaceId);
  assert.equal((await app.request("/api/v1/profile")).status, 401);
  assert.equal(calls.length, 1);
});

test("blocks unsupported target queries, malformed/oversized writes and wrong browser Origin", async () => {
  const { app, calls } = setup();
  for (const [path, method] of writeRoutes) {
    assert.equal(
      (
        await app.request(`${path}?profileId=${randomUUID()}`, {
          method,
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await app.request(path, {
          method,
          body: "private",
          headers: { "Content-Type": "text/plain" },
        })
      ).status,
      415,
    );
    assert.equal(
      (
        await app.request(path, {
          method,
          body: "invalid",
          headers: { "Content-Type": "application/json" },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await app.request(path, {
          method,
          body: "x".repeat(32769),
          headers: {
            "Content-Type": "application/json",
            "Content-Length": "1",
          },
        })
      ).status,
      413,
    );
    assert.equal(
      (
        await app.request(path, {
          method,
          body: "{}",
          headers: {
            "Content-Type": "application/json",
            Origin: "https://attacker.invalid",
          },
        })
      ).status,
      403,
    );
  }
  assert.equal(calls.length, 0);
});

test("POST dispatches only creation and returns 201 with no-store and the verified actor", async () => {
  const { app, calls } = setup();
  const input = { fullName: "Synthetic new profile" };
  const response = await app.request("/api/v1/profile", {
    method: "POST",
    body: JSON.stringify(input),
    headers: { "Content-Type": "application/json", "X-User-Id": randomUUID() },
  });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual((await response.json()).data, dto);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].kind, "create");
  assert.deepEqual(calls[0].input, input);
  assert.deepEqual(calls[0].context.actor, actor);
  const preflight = await app.request("/api/v1/profile", {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:3000",
      "Access-Control-Request-Method": "POST",
    },
  });
  assert.ok(
    preflight.headers.get("Access-Control-Allow-Methods").includes("POST"),
  );
});

test("draft PUT dispatches only partial saving and permits local preflight, with unsupported verbs rejected", async () => {
  const { app, calls } = setup();
  const input = { expectedRevision: 1, professionalSummary: null };
  const response = await app.request("/api/v1/profile/draft", {
    method: "PUT",
    body: JSON.stringify(input),
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
      "X-Workspace-Id": actor.personalWorkspaceId,
    },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(
    response.headers.get("Access-Control-Allow-Origin"),
    "http://localhost:3000",
  );
  const body = await response.json();
  assert.deepEqual(body.data, dto);
  assert.equal(response.headers.get("X-Request-Id"), body.requestId);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].kind, "saveDraft");
  assert.deepEqual(calls[0].input, input);
  assert.deepEqual(calls[0].context.actor, actor);
  assert.equal(calls[0].context.selectedWorkspaceId, actor.personalWorkspaceId);
  const preflight = await app.request("/api/v1/profile/draft", {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:3000",
      "Access-Control-Request-Method": "PUT",
    },
  });
  assert.equal(preflight.status, 204);
  assert.ok(
    preflight.headers.get("Access-Control-Allow-Methods").includes("PUT"),
  );
  for (const method of ["GET", "POST", "DELETE"])
    assert.equal(
      (await app.request("/api/v1/profile/draft", { method })).status,
      404,
    );
  assert.equal(calls.length, 1);
});

test("experience list/add dispatch the verified context and reject unsupported child/verb targets", async () => {
  const { app, calls } = setup();
  const path = "/api/v1/profile/experience";
  const headers = {
    Origin: "http://localhost:3000",
    "Content-Type": "application/json",
    "X-Workspace-Id": actor.personalWorkspaceId,
  };
  const input = {
    expectedRevision: 1,
    company: "Synthetic company",
    title: "Synthetic role",
  };
  assert.equal((await app.request(path, { headers })).status, 200);
  const added = await app.request(path, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  assert.equal(added.status, 201);
  assert.equal(added.headers.get("Cache-Control"), "no-store");
  assert.equal(
    added.headers.get("Access-Control-Allow-Origin"),
    "http://localhost:3000",
  );
  assert.deepEqual(
    calls.map((call) => call.kind),
    ["listExperience", "addExperience"],
  );
  assert.deepEqual(calls[1].input, input);
  for (const call of calls) {
    assert.deepEqual(call.context.actor, actor);
    assert.equal(call.context.selectedWorkspaceId, actor.personalWorkspaceId);
  }
  const preflight = await app.request(path, {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:3000",
      "Access-Control-Request-Method": "POST",
    },
  });
  assert.equal(preflight.status, 204);
  assert.ok(
    preflight.headers.get("Access-Control-Allow-Methods").includes("POST"),
  );
  for (const method of ["PUT", "DELETE"])
    assert.equal((await app.request(path, { method })).status, 404);
  assert.equal((await app.request(`${path}/${randomUUID()}`)).status, 404);
  assert.equal(calls.length, 2);
  const unavailable = setup(async () => ({ status: "unavailable" }));
  assert.equal((await unavailable.app.request(path)).status, 503);
  assert.equal(unavailable.calls.length, 0);
});

test("education list/add dispatch the verified context and reject unsupported child/verb targets", async () => {
  const { app, calls } = setup();
  const path = "/api/v1/profile/education";
  const headers = {
    Origin: "http://localhost:3000",
    "Content-Type": "application/json",
    "X-Workspace-Id": actor.personalWorkspaceId,
  };
  const input = {
    expectedRevision: 1,
    institution: "Synthetic University",
    degree: "BS Computer Science",
    fieldOfStudy: "Software Engineering",
  };
  assert.equal((await app.request(path, { headers })).status, 200);
  const added = await app.request(path, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  assert.equal(added.status, 201);
  assert.equal(added.headers.get("Cache-Control"), "no-store");
  assert.equal(
    added.headers.get("Access-Control-Allow-Origin"),
    "http://localhost:3000",
  );
  assert.deepEqual(
    calls.map((call) => call.kind),
    ["listEducation", "addEducation"],
  );
  assert.deepEqual(calls[1].input, input);
  for (const call of calls) {
    assert.deepEqual(call.context.actor, actor);
    assert.equal(call.context.selectedWorkspaceId, actor.personalWorkspaceId);
  }
  const preflight = await app.request(path, {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:3000",
      "Access-Control-Request-Method": "POST",
    },
  });
  assert.equal(preflight.status, 204);
  assert.ok(
    preflight.headers.get("Access-Control-Allow-Methods").includes("POST"),
  );
  for (const method of ["PUT", "DELETE"])
    assert.equal((await app.request(path, { method })).status, 404);
  assert.equal((await app.request(`${path}/${randomUUID()}`)).status, 404);
  assert.equal(calls.length, 2);
  const unavailable = setup(async () => ({ status: "unavailable" }));
  assert.equal((await unavailable.app.request(path)).status, 503);
  assert.equal(unavailable.calls.length, 0);
});

test("entry PUT dispatches the path target with local CORS and no unsupported child operations", async () => {
  for (const [section, kind] of [
    ["experience", "updateExperience"],
    ["education", "updateEducation"],
  ]) {
    const { app, calls } = setup();
    const id = randomUUID();
    const path = `/api/v1/profile/${section}/${id}`;
    const input = { expectedRevision: 1, title: "Synthetic replacement" };
    const response = await app.request(path, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify(input),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(
      response.headers.get("Access-Control-Allow-Origin"),
      "http://localhost:3000",
    );
    assert.deepEqual(calls[0], {
      kind,
      context: calls[0].context,
      id,
      input,
    });
    assert.deepEqual(calls[0].context.actor, actor);
    const preflight = await app.request(path, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3000",
        "Access-Control-Request-Method": "PUT",
      },
    });
    assert.equal(preflight.status, 204);
    assert.ok(
      preflight.headers.get("Access-Control-Allow-Methods").includes("PUT"),
    );
    for (const method of ["GET", "POST", "PATCH"])
      assert.equal((await app.request(path, { method })).status, 404);
    assert.equal(
      (await app.request(`${path}/extra`, { method: "PUT" })).status,
      404,
    );
    assert.equal(calls.length, 1);
  }
});

test("profile errors are stable and raw database errors are suppressed", async () => {
  for (const [error, status] of [
    [new ProfileError("not_found"), 404],
    [new ProfileError("revision_conflict"), 409],
    [new ProfileError("profile_exists"), 409],
    [new ProfileError("onboarding_complete"), 409],
    [new ProfileError("section_limit"), 409],
    [new Error("private database/credential context"), 503],
  ]) {
    const { app } = setup(undefined, error);
    const response = await app.request("/api/v1/profile/draft", {
      method: "PUT",
      body: "{}",
      headers: { "Content-Type": "application/json" },
    });
    assert.equal(response.status, status);
    assert.equal((await response.text()).includes("private database"), false);
  }
});

test("stalled authenticated body is cancelled without calling the profile use case", async () => {
  const { app, calls } = setup();
  let cancelled = false;
  const body = new ReadableStream({
    cancel() {
      cancelled = true;
    },
  });
  const response = await app.request("/api/v1/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
    duplex: "half",
  });
  assert.equal(response.status, 408);
  assert.equal(cancelled, true);
  assert.equal(calls.length, 0);
});

test("skills routes dispatch with local CORS and authentic context", async () => {
  const { app, calls } = setup();
  const path = "/api/v1/profile/skills";
  const headers = {
    Authorization: "Bearer token",
    "Content-Type": "application/json",
    Origin: "http://localhost:3000",
    "X-Workspace-Id": actor.personalWorkspaceId,
  };
  const skillInput = {
    expectedRevision: 1,
    name: "TypeScript",
    category: "Languages",
    proficiency: "advanced",
  };
  // GET
  assert.equal((await app.request(path, { headers })).status, 200);

  // POST
  const added = await app.request(path, {
    method: "POST",
    headers,
    body: JSON.stringify(skillInput),
  });
  assert.equal(added.status, 201);

  // PUT /api/v1/profile/skills/:id
  const skillId = randomUUID();
  const updated = await app.request(`${path}/${skillId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(skillInput),
  });
  assert.equal(updated.status, 200);

  assert.deepEqual(
    calls.map((c) => c.kind),
    ["listSkills", "addSkill", "updateSkill"],
  );
});

test("projects routes dispatch with local CORS and authentic context", async () => {
  const { app, calls } = setup();
  const path = "/api/v1/profile/projects";
  const headers = {
    Authorization: "Bearer token",
    "Content-Type": "application/json",
    Origin: "http://localhost:3000",
    "X-Workspace-Id": actor.personalWorkspaceId,
  };
  const projectInput = {
    expectedRevision: 1,
    name: "ResumeForge",
    description: "AI resume builder",
    technologies: ["TypeScript", "React"],
  };
  // GET
  assert.equal((await app.request(path, { headers })).status, 200);

  // POST
  const added = await app.request(path, {
    method: "POST",
    headers,
    body: JSON.stringify(projectInput),
  });
  assert.equal(added.status, 201);

  // PUT /api/v1/profile/projects/:id
  const projectId = randomUUID();
  const updated = await app.request(`${path}/${projectId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(projectInput),
  });
  assert.equal(updated.status, 200);

  assert.deepEqual(
    calls.map((c) => c.kind),
    ["listProjects", "addProject", "updateProject"],
  );
});

test("certifications routes dispatch with local CORS and authentic context", async () => {
  const { app, calls } = setup();
  const path = "/api/v1/profile/certifications";
  const headers = {
    Authorization: "Bearer token",
    "Content-Type": "application/json",
    Origin: "http://localhost:3000",
    "X-Workspace-Id": actor.personalWorkspaceId,
  };
  const certInput = {
    expectedRevision: 1,
    name: "AWS Certified Solutions Architect",
    issuer: "Amazon Web Services",
    issueDate: "2023-05",
    expiryDate: "2026-05",
  };
  // GET
  assert.equal((await app.request(path, { headers })).status, 200);

  // POST
  const added = await app.request(path, {
    method: "POST",
    headers,
    body: JSON.stringify(certInput),
  });
  assert.equal(added.status, 201);

  // PUT /api/v1/profile/certifications/:id
  const certId = randomUUID();
  const updated = await app.request(`${path}/${certId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(certInput),
  });
  assert.equal(updated.status, 200);

  assert.deepEqual(
    calls.map((c) => c.kind),
    ["listCertifications", "addCertification", "updateCertification"],
  );
});

test("contact routes dispatch with local CORS and authentic context", async () => {
  const { app, calls } = setup();
  const path = "/api/v1/profile/contact";
  const headers = {
    Authorization: "Bearer token",
    "Content-Type": "application/json",
    Origin: "http://localhost:3000",
    "X-Workspace-Id": actor.personalWorkspaceId,
  };
  const contactInput = {
    email: "dev@example.com",
    phone: "+1-555-0100",
    address: "San Francisco, CA",
    linkedinUrl: "https://linkedin.com/in/developer",
    githubUrl: "https://github.com/developer",
    portfolioUrl: "https://dev.example.com",
  };

  // GET
  const getRes = await app.request(path, { headers });
  assert.equal(getRes.status, 200);

  // PUT
  const putRes = await app.request(path, {
    method: "PUT",
    headers,
    body: JSON.stringify(contactInput),
  });
  assert.equal(putRes.status, 200);

  assert.deepEqual(
    calls.map((c) => c.kind),
    ["getContact", "updateContact"],
  );
  assert.deepEqual(calls[1].input, contactInput);
});

test("complete onboarding route dispatches with local CORS and authentic context", async () => {
  const { app, calls } = setup();
  const path = "/api/v1/profile/complete";
  const headers = {
    Authorization: "Bearer token",
    "Content-Type": "application/json",
    Origin: "http://localhost:3000",
    "X-Workspace-Id": actor.personalWorkspaceId,
  };
  const completeInput = { expectedRevision: 3 };

  const res = await app.request(path, {
    method: "POST",
    headers,
    body: JSON.stringify(completeInput),
  });
  assert.equal(res.status, 200);

  assert.deepEqual(
    calls.map((c) => c.kind),
    ["completeOnboarding"],
  );
  assert.deepEqual(calls[0].input, completeInput);
});

test("section entry DELETE routes dispatch with local CORS, entry ID and expected revision", async () => {
  const { app, calls } = setup();
  const headers = {
    Authorization: "Bearer token",
    "Content-Type": "application/json",
    Origin: "http://localhost:3000",
    "X-Workspace-Id": actor.personalWorkspaceId,
  };

  const sections = [
    ["experience", "deleteExperience"],
    ["education", "deleteEducation"],
    ["skills", "deleteSkill"],
    ["projects", "deleteProject"],
    ["certifications", "deleteCertification"],
  ];

  for (const [section, expectedKind] of sections) {
    const entryId = randomUUID();
    const res = await app.request(`/api/v1/profile/${section}/${entryId}`, {
      method: "DELETE",
      headers,
      body: JSON.stringify({ expectedRevision: 2 }),
    });
    assert.equal(res.status, 200);
    const lastCall = calls[calls.length - 1];
    assert.equal(lastCall.kind, expectedKind);
    assert.equal(lastCall.id, entryId);
    assert.deepEqual(lastCall.input, { expectedRevision: 2 });
  }

  // Also verify DELETE with X-Expected-Revision header without body
  const headerEntryId = randomUUID();
  const headerRes = await app.request(`/api/v1/profile/skills/${headerEntryId}`, {
    method: "DELETE",
    headers: {
      Authorization: "Bearer token",
      Origin: "http://localhost:3000",
      "X-Expected-Revision": "5",
    },
  });
  assert.equal(headerRes.status, 200);
  const headerCall = calls[calls.length - 1];
  assert.equal(headerCall.kind, "deleteSkill");
  assert.equal(headerCall.id, headerEntryId);
  assert.deepEqual(headerCall.input, { expectedRevision: 5 });
});


