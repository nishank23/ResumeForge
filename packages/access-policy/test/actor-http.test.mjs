import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";
import { createLocalActorResolver } from "../dist/server.js";

const key = randomBytes(32).toString("hex");
const token = randomBytes(32).toString("hex");
const endpoint = "http://127.0.0.1:4001/internal/auth/resolve";
const time = Date.now();
const actor = {
  userId: randomUUID(),
  personalWorkspaceId: randomUUID(),
  expiresAt: time + 300000,
};
const config = { key, endpoint, now: () => time };

test("missing and malformed actor credentials never reach the peer", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", () =>
    assert.fail("Must not send unauthenticated context"),
  );
  const resolve = createLocalActorResolver(config);
  for (const value of [
    undefined,
    "",
    "Bearer forged-user-id",
    `bearer ${token}`,
    `Bearer ${token} extra`,
  ])
    assert.deepEqual(await resolve(value), { status: "unauthenticated" });
  assert.equal(mock.mock.callCount(), 0);
});

test("actor resolution sends only the token and service identity, and never caches", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls++;
    assert.equal(url.href, endpoint);
    assert.deepEqual(JSON.parse(options.body), { accessToken: token });
    assert.equal(options.headers.authorization, `Bearer ${key}`);
    assert.equal(
      options.headers["x-resume-forge-service"],
      "local-profile-service",
    );
    assert.equal(options.redirect, "error");
    assert.ok(options.signal instanceof AbortSignal);
    return calls === 1
      ? Response.json({ data: actor })
      : Response.json({ error: { code: "unauthenticated" } }, { status: 401 });
  });
  const resolve = createLocalActorResolver(config);
  assert.deepEqual(await resolve(`Bearer ${token}`), {
    status: "authenticated",
    actor,
  });
  assert.deepEqual(await resolve(`Bearer ${token}`), {
    status: "unauthenticated",
  });
  assert.equal(calls, 2);
});

test("malformed, private, stale, excessive-lifetime and wrong-status peer replies fail closed", async (t) => {
  const replies = [
    ["not json", 200],
    [{ data: { ...actor, email: "private@example.invalid" } }, 200],
    [{ data: { ...actor, expiresAt: time } }, 200],
    [{ data: { ...actor, expiresAt: time + 300001 } }, 200],
    [{ data: { ...actor, userId: "forged" } }, 200],
    [{ data: actor, private: "content" }, 200],
    [{ data: actor }, 503],
    [{ error: { code: "service_unauthorized" } }, 401],
    [{ error: { code: "unauthenticated" } }, 403],
  ];
  for (const [body, status] of replies) {
    t.mock.method(globalThis, "fetch", async () =>
      typeof body === "string"
        ? new Response(body, { status })
        : Response.json(body, { status }),
    );
    assert.deepEqual(
      await createLocalActorResolver(config)(`Bearer ${token}`),
      { status: "unavailable" },
    );
    t.mock.restoreAll();
  }
});

test("actual streamed response size is bounded regardless of Content-Length", async (t) => {
  let cancelled = false;
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("x".repeat(513)));
          },
          cancel() {
            cancelled = true;
          },
        }),
        { headers: { "Content-Length": "1" } },
      ),
  );
  assert.deepEqual(await createLocalActorResolver(config)(`Bearer ${token}`), {
    status: "unavailable",
  });
  assert.equal(cancelled, true);
});

test("network exceptions are reduced to a fixed unavailable result", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("private peer/credential details");
  });
  assert.deepEqual(await createLocalActorResolver(config)(`Bearer ${token}`), {
    status: "unavailable",
  });
});

test("hosted, redirected, credential-bearing and invalid configurations are rejected", () => {
  for (const override of [
    { endpoint: "https://example.invalid/internal/auth/resolve" },
    { endpoint: "http://localhost:4001/internal/auth/resolve" },
    { endpoint: "http://user:secret@127.0.0.1:4001/internal/auth/resolve" },
    { endpoint: `${endpoint}?token=secret` },
    { endpoint: `${endpoint}#fragment` },
    { endpoint: "http://127.0.0.1:4001/api/v1/auth/me" },
    { endpoint: "invalid-secret-url" },
    { key: "bad-key" },
    { timeoutMs: 0 },
    { timeoutMs: 5001 },
    { timeoutMs: 1.5 },
  ])
    assert.throws(
      () => createLocalActorResolver({ ...config, ...override }),
      /^Error: Invalid local actor resolver configuration$/,
    );
});

test("local actor transport refuses production mode", () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    assert.throws(
      () => createLocalActorResolver(config),
      /^Error: Invalid local actor resolver configuration$/,
    );
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test("real HTTP redirects and stalled response bodies cannot yield authority", async () => {
  let redirect = true;
  const server = createServer((_req, res) => {
    if (redirect) {
      res.writeHead(302, { Location: endpoint });
      res.end();
    } else {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.flushHeaders();
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const resolve = createLocalActorResolver({
      ...config,
      endpoint: `http://127.0.0.1:${server.address().port}/internal/auth/resolve`,
      timeoutMs: 100,
    });
    assert.deepEqual(await resolve(`Bearer ${token}`), {
      status: "unavailable",
    });
    redirect = false;
    assert.deepEqual(await resolve(`Bearer ${token}`), {
      status: "unavailable",
    });
  } finally {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  }
});
