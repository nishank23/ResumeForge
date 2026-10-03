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
function setup(
  resolveActor = async () => ({ status: "authenticated", actor }),
  error,
) {
  const calls = [];
  const operation = async (context, input) => {
    calls.push({ context, input });
    if (error) throw error;
    return dto;
  };
  const app = createProfileApp({
    resolveActor,
    profiles: { read: operation, update: operation },
  });
  return { app, calls };
}

test("invalid/unavailable authentication withholds profile calls before parsing", async () => {
  for (const [status, code] of [
    ["unauthenticated", 401],
    ["unavailable", 503],
  ]) {
    const { app, calls } = setup(async () => ({ status }));
    const response = await app.request("/api/v1/profile", {
      method: "PUT",
      body: "malformed private body",
    });
    assert.equal(response.status, code);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(calls.length, 0);
    assert.equal((await response.text()).includes("private body"), false);
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
  assert.equal(
    (await app.request(`/api/v1/profile?profileId=${randomUUID()}`)).status,
    422,
  );
  assert.equal(
    (
      await app.request("/api/v1/profile", {
        method: "PUT",
        body: "private",
        headers: { "Content-Type": "text/plain" },
      })
    ).status,
    415,
  );
  assert.equal(
    (
      await app.request("/api/v1/profile", {
        method: "PUT",
        body: "invalid",
        headers: { "Content-Type": "application/json" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await app.request("/api/v1/profile", {
        method: "PUT",
        body: "x".repeat(32769),
        headers: { "Content-Type": "application/json", "Content-Length": "1" },
      })
    ).status,
    413,
  );
  assert.equal(
    (
      await app.request("/api/v1/profile", {
        method: "PUT",
        body: "{}",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://attacker.invalid",
        },
      })
    ).status,
    403,
  );
  assert.equal(calls.length, 0);
});

test("profile errors are stable and raw database errors are suppressed", async () => {
  for (const [error, status] of [
    [new ProfileError("not_found"), 404],
    [new ProfileError("revision_conflict"), 409],
    [new Error("private database/credential context"), 503],
  ]) {
    const { app } = setup(undefined, error);
    const response = await app.request("/api/v1/profile");
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
