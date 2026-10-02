import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";
import {
  createLocalAuditHttpTransport,
  AuditDeliveryRejection,
  INTERNAL_AUDIT_PATH,
  LOCAL_AUDIT_SERVICE_ID,
} from "@resume-forge/prisma-client";
import { createWorkspaceAuditApp } from "../dist/app.js";

const key = randomBytes(32).toString("hex");
const event = {
  eventId: randomUUID(),
  actorUserId: randomUUID(),
  workspaceId: randomUUID(),
  workspaceType: "individual",
  resourceType: "profile",
  resourceId: randomUUID(),
  action: "profile.updated",
  outcome: "succeeded",
  occurredAt: new Date().toISOString(),
  correlationId: randomUUID(),
  metadata: { permission: "profile.update" },
};
const headers = {
  authorization: `Bearer ${key}`,
  "x-resume-forge-service": LOCAL_AUDIT_SERVICE_ID,
  "content-type": "application/json",
};
let calls = 0;
const app = createWorkspaceAuditApp({
  relayKey: key,
  db: {
    $transaction: async () => {
      calls++;
      throw new Error("synthetic secret DB detail");
    },
  },
});
const request = (body, extra = {}) =>
  app.request(INTERNAL_AUDIT_PATH, {
    method: "POST",
    headers: { ...headers, ...extra },
    body,
  });
async function peer(handler, check) {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    await check(
      `http://127.0.0.1:${server.address().port}${INTERNAL_AUDIT_PATH}`,
    );
  } finally {
    const closed = new Promise((resolve) => server.close(resolve));
    server.closeAllConnections();
    await closed;
  }
}

test("authentication rejects missing/wrong credentials and unknown service before reading input", async () => {
  const before = calls;
  for (const extra of [
    { authorization: "" },
    { authorization: `Bearer ${randomBytes(32).toString("hex")}` },
    { authorization: key },
    { "x-resume-forge-service": "profile-service" },
    { "x-resume-forge-service": "" },
  ]) {
    const response = await request("not even JSON", extra);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: { code: "service_unauthorized" },
    });
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  assert.equal(calls, before);
});

test("browser requests, preflight, public paths and methods cannot ingest events", async () => {
  const before = calls;
  const response = await request(JSON.stringify(event), {
    origin: "http://localhost:3000",
  });
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.equal(
    (await app.request(INTERNAL_AUDIT_PATH, { method: "OPTIONS" })).status,
    404,
  );
  assert.equal((await app.request(INTERNAL_AUDIT_PATH)).status, 404);
  assert.equal(
    (await app.request(`/api/v1${INTERNAL_AUDIT_PATH}`, { method: "POST" }))
      .status,
    404,
  );
  assert.equal(calls, before);
});

test("input validation bounds actual bytes and rejects unknown/private fields without DB access", async () => {
  const before = calls;
  for (const [body, extra, status] of [
    ["{", {}, 400],
    [JSON.stringify(event), { "content-type": "text/plain" }, 415],
    [
      JSON.stringify({
        ...event,
        metadata: { email: "synthetic@example.invalid" },
      }),
      {},
      422,
    ],
    [
      JSON.stringify({ ...event, resumeText: "synthetic private content" }),
      {},
      422,
    ],
    [" ".repeat(16_385), {}, 413],
    [" ".repeat(16_385), { "content-length": "1" }, 413],
  ]) {
    const response = await request(body, extra);
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), {
      error: { code: "invalid_intent" },
    });
  }
  assert.equal(calls, before);
});

test("unexpected DB failures expose only a retryable safe code", async () => {
  const response = await request(JSON.stringify(event));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: { code: "delivery_unavailable" },
  });
});

test("local client refuses hosted URLs, URL credentials, other paths and invalid keys/limits", () => {
  for (const endpoint of [
    "https://127.0.0.1/internal/audit/events",
    "http://example.invalid/internal/audit/events",
    "http://localhost/internal/audit/events",
    "http://127.0.0.1/other",
    "http://user:pass@127.0.0.1/internal/audit/events",
    "http://127.0.0.1/internal/audit/events?secret=value",
  ])
    assert.throws(() => createLocalAuditHttpTransport({ endpoint, key }));
  assert.throws(() =>
    createLocalAuditHttpTransport({
      endpoint: `http://127.0.0.1${INTERNAL_AUDIT_PATH}`,
      key: "",
    }),
  );
  for (const timeoutMs of [0, 5001, 100.5])
    assert.throws(() =>
      createLocalAuditHttpTransport({
        endpoint: `http://127.0.0.1${INTERNAL_AUDIT_PATH}`,
        key,
        timeoutMs,
      }),
    );
  assert.throws(() => createWorkspaceAuditApp({ db: {}, relayKey: "" }));
});

test("client accepts only a matching, validated durable acknowledgement", async () => {
  for (const data of [
    { eventId: event.eventId, duplicate: false },
    { eventId: event.eventId, duplicate: true },
    { eventId: randomUUID(), duplicate: false },
    { eventId: event.eventId, duplicate: "false" },
    { eventId: event.eventId, duplicate: false, secret: "synthetic" },
  ])
    await peer(
      (req, res) => {
        assert.equal(req.headers.authorization, `Bearer ${key}`);
        assert.equal(
          req.headers["x-resume-forge-service"],
          LOCAL_AUDIT_SERVICE_ID,
        );
        res.end(JSON.stringify({ data }));
      },
      async (endpoint) => {
        const send = createLocalAuditHttpTransport({ endpoint, key });
        if (
          data.eventId === event.eventId &&
          typeof data.duplicate === "boolean" &&
          !data.secret
        )
          await send(event);
        else
          await assert.rejects(send(event), {
            message: "Audit delivery unavailable",
          });
      },
    );
});

test("only matching permanent status/code pairs block; auth/outages/unknown replies retry", async () => {
  for (const [status, code, permanent] of [
    [422, "invalid_scope", true],
    [409, "event_conflict", true],
    [422, "invalid_intent", true],
    [401, "event_conflict", false],
    [503, "invalid_scope", false],
    [409, "synthetic secret", false],
    [429, "invalid_intent", false],
  ])
    await peer(
      (_req, res) => {
        res.writeHead(status);
        res.end(JSON.stringify({ error: { code } }));
      },
      async (endpoint) => {
        await assert.rejects(
          createLocalAuditHttpTransport({ endpoint, key })(event),
          (error) => {
            assert.equal(error instanceof AuditDeliveryRejection, permanent);
            assert.equal(
              error.message,
              permanent
                ? "Audit delivery rejected"
                : "Audit delivery unavailable",
            );
            return true;
          },
        );
      },
    );
});

test("client bounds replies, times out and refuses redirect credential forwarding", async () => {
  let redirected = false;
  await peer(
    (req, res) => {
      redirected = true;
      res.end("{}");
    },
    async (target) => {
      await peer(
        (_req, res) => {
          res.writeHead(307, { location: target });
          res.end();
        },
        async (endpoint) => {
          await assert.rejects(
            createLocalAuditHttpTransport({ endpoint, key })(event),
            { message: "Audit delivery unavailable" },
          );
        },
      );
    },
  );
  assert.equal(redirected, false);
  await peer(
    (_req, res) => res.end("x".repeat(1025)),
    async (endpoint) => {
      await assert.rejects(
        createLocalAuditHttpTransport({ endpoint, key })(event),
        { message: "Audit delivery unavailable" },
      );
    },
  );
  await peer(
    (_req, _res) => {},
    async (endpoint) => {
      await assert.rejects(
        createLocalAuditHttpTransport({ endpoint, key, timeoutMs: 50 })(event),
        { message: "Audit delivery unavailable" },
      );
    },
  );
});
