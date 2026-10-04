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
  ["/api/v1/profile", "PUT"],
  ["/api/v1/profile", "POST"],
  ["/api/v1/profile/draft", "PUT"],
  ["/api/v1/profile/experience", "POST"],
  [`/api/v1/profile/experience/${randomUUID()}`, "PUT"],
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
      listExperience: operation("listExperience"),
      addExperience: operation("addExperience"),
      updateExperience: async (context, id, input) => {
        calls.push({ kind: "updateExperience", context, id, input });
        if (error) throw error;
        return dto;
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

test("entry PUT dispatches the path target with local CORS and no unsupported child operations", async () => {
  const { app, calls } = setup();
  const id = randomUUID();
  const path = `/api/v1/profile/experience/${id}`;
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
    kind: "updateExperience",
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
  for (const method of ["GET", "POST", "PATCH", "DELETE"])
    assert.equal((await app.request(path, { method })).status, 404);
  assert.equal(
    (await app.request(`${path}/extra`, { method: "PUT" })).status,
    404,
  );
  assert.equal(calls.length, 1);
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
