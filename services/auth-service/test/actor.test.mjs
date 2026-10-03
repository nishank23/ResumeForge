import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createAuthApp } from "../dist/app.js";

const key = randomBytes(32).toString("hex");
const token = randomBytes(32).toString("hex");
const actorHeaders = {
  authorization: `Bearer ${key}`,
  "x-resume-forge-service": "local-profile-service",
  "content-type": "application/json",
};
function setup(profileServiceKey = key) {
  let calls = 0;
  const db = {
    session: {
      async findUnique() {
        calls++;
        throw new Error("private database content");
      },
    },
  };
  return {
    app: createAuthApp({
      db,
      appOrigin: "http://localhost:3000",
      profileServiceKey,
    }),
    calls: () => calls,
  };
}
const call = (app, body = { accessToken: token }, headers = actorHeaders) =>
  app.request("/internal/auth/resolve", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

test("service authentication precedes parsing and database access", async () => {
  const { app, calls } = setup();
  for (const headers of [
    {},
    { ...actorHeaders, authorization: `Bearer ${token}` },
    { ...actorHeaders, "x-resume-forge-service": "local-audit-relay" },
  ]) {
    const response = await call(app, "not json", headers);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: { code: "service_unauthorized" },
    });
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.has("Access-Control-Allow-Origin"), false);
  }
  assert.equal(calls(), 0);
});

test("browser origins and preflight receive no internal CORS access", async () => {
  const { app, calls } = setup();
  for (const origin of [
    "http://localhost:3000",
    "null",
    "https://attacker.invalid",
  ]) {
    const response = await call(app, undefined, { ...actorHeaders, origin });
    assert.equal(response.status, 403);
    assert.equal(response.headers.has("Access-Control-Allow-Origin"), false);
  }
  const preflight = await app.request("/internal/auth/resolve", {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:3000",
      "Access-Control-Request-Method": "POST",
    },
  });
  assert.equal(preflight.headers.has("Access-Control-Allow-Origin"), false);
  assert.equal(calls(), 0);
  const external = await app.request("/api/v1/auth/me", {
    headers: { Origin: "http://localhost:3000" },
  });
  assert.equal(
    external.headers.get("Access-Control-Allow-Origin"),
    "http://localhost:3000",
  );
});

test("unknown actor/workspace/role fields, invalid tokens and unsupported input are rejected", async () => {
  const { app, calls } = setup();
  for (const extra of [
    { userId: randomUUID() },
    { workspaceId: randomUUID() },
    { role: "USER" },
    { contact: "private" },
  ])
    assert.equal(
      (await call(app, { accessToken: token, ...extra })).status,
      422,
    );
  assert.equal((await call(app, { accessToken: "bad" })).status, 422);
  assert.equal((await call(app, "not json")).status, 400);
  assert.equal(
    (await call(app, {}, { ...actorHeaders, "content-type": "text/plain" }))
      .status,
    415,
  );
  assert.equal(
    (
      await call(app, "x".repeat(513), {
        ...actorHeaders,
        "Content-Length": "1",
      })
    ).status,
    413,
  );
  assert.equal(calls(), 0);
});

test("service credential alone cannot impersonate a session; refresh cookies and forged identity headers confer no authority", async () => {
  const { app, calls } = setup();
  const response = await call(app, undefined, {
    ...actorHeaders,
    Cookie: `refresh_token=${token}`,
    "X-User-Id": randomUUID(),
    "X-Workspace-Id": randomUUID(),
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: { code: "unauthenticated" },
  });
  assert.equal(calls(), 0);
});

test("missing local service setup fails closed without changing browser auth", async () => {
  const app = createAuthApp({ db: {}, appOrigin: "http://localhost:3000" });
  assert.equal((await call(app)).status, 503);
  assert.equal((await app.request("/api/v1/auth/me")).status, 401);
  assert.throws(
    () =>
      createAuthApp({
        db: {},
        appOrigin: "http://localhost:3000",
        profileServiceKey: "unsafe",
      }),
    /Invalid local actor service configuration/,
  );
});
