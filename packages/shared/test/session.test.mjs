import test from "node:test";
import assert from "node:assert/strict";
import { createSessionController } from "../src/auth/session.ts";

const identity = {
  id: "11111111-1111-4111-8111-111111111111",
  workspaceId: "22222222-2222-4222-8222-222222222222",
  name: "Synthetic",
  isOnboarded: false,
};
const response = (data, status = 200) =>
  new Response(JSON.stringify(data), { status });
const token = () =>
  response({ data: { accessToken: "a".repeat(64), expiresIn: 300 } });
const me = () => response({ data: identity });
const lock = () => {
  let tail = Promise.resolve();
  return (operation) => {
    const result = tail.then(operation);
    tail = result.catch(() => {});
    return result;
  };
};
const make = (request, extra = {}) =>
  createSessionController({
    request,
    exclusive: lock(),
    notifyLogout() {},
    ...extra,
  });

test("deduplicates bootstrap, validates identity and keeps credentials private", async () => {
  let calls = 0;
  const client = make(async () => (++calls === 1 ? token() : me()));
  await Promise.all([client.restore(), client.restore(), client.restore()]);
  assert.equal(calls, 2);
  assert.deepEqual(client.getSnapshot(), { status: "authenticated", identity });
  assert.equal(
    JSON.stringify(client.getSnapshot()).includes("a".repeat(64)),
    false,
  );
});
test("serializes two tabs through the shared lock", async () => {
  const exclusive = lock();
  let active = 0;
  let maximum = 0;
  const request = async (url) => {
    if (url.endsWith("/refresh")) {
      active++;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return token();
    }
    return me();
  };
  const a = make(request, { exclusive });
  const b = make(request, { exclusive });
  await Promise.all([a.restore(), b.restore()]);
  assert.equal(maximum, 1);
  assert.equal(a.getSnapshot().status, "authenticated");
  assert.equal(b.getSnapshot().status, "authenticated");
});
test("rechecks active sessions and clears revoked identity", async () => {
  const queue = [token(), me(), response({}, 401), response({}, 401)];
  const client = make(async () => queue.shift());
  await client.restore();
  await client.restore();
  assert.deepEqual(client.getSnapshot(), { status: "anonymous" });
});
test("provider outage and malformed identity fail closed, then retry recovers", async () => {
  const queue = [
    response({}, 503),
    token(),
    response({ data: { ...identity, workspaceId: "spoof" } }),
    token(),
    me(),
  ];
  const client = make(async () => queue.shift());
  await client.restore();
  assert.equal(client.getSnapshot().status, "error");
  await client.restore();
  assert.equal(client.getSnapshot().status, "error");
  await client.restore();
  assert.equal(client.getSnapshot().status, "authenticated");
});
test("late identity response cannot restore a logged-out account", async () => {
  let finish;
  const client = make(async (url) =>
    url.endsWith("refresh")
      ? token()
      : new Promise((resolve) => {
          finish = resolve;
        }),
  );
  const pending = client.restore();
  while (!finish) await new Promise((resolve) => setTimeout(resolve, 0));
  client.receiveLogout();
  finish(me());
  await pending;
  assert.deepEqual(client.getSnapshot(), { status: "anonymous" });
  await client.restore();
  assert.equal(client.getSnapshot().status, "anonymous");
});
test("logout clears immediately, notifies peers, and exposes failed revocation for retry", async () => {
  const queue = [
    token(),
    me(),
    response({}, 503),
    response({ data: { success: true } }),
  ];
  let notifications = 0;
  const client = make(async () => queue.shift(), {
    notifyLogout() {
      notifications++;
    },
  });
  await client.restore();
  const pending = client.logout();
  assert.equal(client.getSnapshot().status, "anonymous");
  await assert.rejects(pending, /Sign-out failed/);
  assert.deepEqual(client.getSnapshot(), {
    status: "error",
    operation: "logout",
  });
  await client.restore();
  assert.equal(queue.length, 1);
  await client.logout();
  assert.equal(client.getSnapshot().status, "anonymous");
  assert.equal(notifications, 3);
});
test("unsupported cross-tab locking refuses session restoration", async () => {
  let calls = 0;
  const client = make(
    async () => {
      calls++;
      return token();
    },
    { exclusive: () => Promise.reject(new Error("Unsupported")) },
  );
  await client.restore();
  assert.equal(calls, 0);
  assert.equal(client.getSnapshot().status, "error");
});

test("API request keeps bearer inside controller and restricts the destination", async () => {
  const calls = [];
  const queue = [token(), me(), response({ data: { ok: true } })];
  const client = make(async (url, options) => {
    calls.push({ url, options });
    return queue.shift();
  });
  await client.restore();
  await client.requestApi("/api/v1/profile", {
    headers: { Authorization: "forged" },
  });
  assert.equal(calls[2].url, "http://localhost:4000/api/v1/profile");
  assert.equal(
    calls[2].options.headers.get("Authorization"),
    `Bearer ${"a".repeat(64)}`,
  );
  assert.equal(calls[2].options.credentials, "omit");
  for (const path of [
    "https://evil.invalid",
    "//evil.invalid",
    "/api/v1/../private",
    "/api/v1/profile?token=private",
  ])
    await assert.rejects(client.requestApi(path), /Invalid API path/);
});
test("API 401 refreshes once and retries with the rotated access token", async () => {
  const calls = [];
  const queue = [
    token(),
    me(),
    response({}, 401),
    response({}, 401),
    response({ data: { accessToken: "b".repeat(64), expiresIn: 300 } }),
    me(),
    response({ data: { ok: true } }),
  ];
  const client = make(async (url, options) => {
    calls.push({ url, options });
    return queue.shift();
  });
  await client.restore();
  assert.equal(
    (await client.requestApi("/api/v1/profile", { method: "PUT", body: "{}" }))
      .status,
    200,
  );
  assert.equal(calls.filter((c) => c.url.endsWith("/profile")).length, 2);
  assert.equal(
    calls.at(-1).options.headers.get("Authorization"),
    `Bearer ${"b".repeat(64)}`,
  );
});
test("API outage is never replayed and late responses after logout are rejected", async () => {
  let finish;
  const queue = [token(), me(), response({}, 503)];
  const client = make(async () =>
    queue.length
      ? queue.shift()
      : new Promise((resolve) => {
          finish = resolve;
        }),
  );
  await client.restore();
  assert.equal(
    (await client.requestApi("/api/v1/profile", { method: "POST" })).status,
    503,
  );
  assert.equal(queue.length, 0);
  const pending = client.requestApi("/api/v1/profile");
  client.receiveLogout();
  finish(response({ data: { private: true } }));
  await assert.rejects(pending, /Session changed/);
  await assert.rejects(
    client.requestApi("/api/v1/profile"),
    /Session unavailable/,
  );
});
test("API expiry cannot retain a stale authenticated identity", async () => {
  const queue = [
    token(),
    me(),
    response({}, 401),
    response({}, 401),
    response({}, 401),
  ];
  const client = make(async () => queue.shift());
  await client.restore();
  await assert.rejects(
    client.requestApi("/api/v1/profile"),
    /Session unavailable/,
  );
  assert.equal(client.getSnapshot().status, "anonymous");
});

test("resume pagination allows only a UUID cursor on the fixed owned-list route", async () => {
  const calls = [];
  const client = make(async (url) => {
    calls.push(url);
    return url.endsWith("/refresh")
      ? token()
      : url.endsWith("/me")
        ? me()
        : response({ data: [] });
  });
  await client.restore();
  const cursor = "11111111-1111-4111-8111-111111111111";
  await client.requestApi(`/api/v1/resume?cursor=${cursor}`);
  assert.equal(
    calls.at(-1),
    `http://localhost:4000/api/v1/resume?cursor=${cursor}`,
  );
  for (const path of [
    `/api/v1/resume?cursor=${cursor}&token=private`,
    `/api/v1/resume?cursor=${cursor}#fragment`,
    "/api/v1/resume?cursor=https://evil.invalid",
    `//evil.invalid/api/v1/resume?cursor=${cursor}`,
  ])
    await assert.rejects(client.requestApi(path), /Invalid API path/);
});

test("PDF requests keep the bearer private and accept only one bounded version on the owned endpoint", async () => {
  const calls = [];
  const client = make(async (url, options) => {
    calls.push({ url, options });
    return url.endsWith("/refresh")
      ? token()
      : url.endsWith("/me")
        ? me()
        : new Response("%PDF-valid");
  });
  await client.restore();
  const id = identity.id;
  await client.requestApi(`/api/v1/resume/${id}/pdf?version=4`);
  assert.equal(
    calls.at(-1).url,
    `http://localhost:4000/api/v1/resume/${id}/pdf?version=4`,
  );
  assert.equal(calls.at(-1).options.credentials, "omit");
  for (const query of [
    "version=0",
    "version=-1",
    "version=1&version=2",
    "version=1&token=private",
    "version=1000000000",
    "version=1#fragment",
  ])
    await assert.rejects(
      client.requestApi(`/api/v1/resume/${id}/pdf?${query}`),
      /Invalid API path/,
    );
});

test("queued tailoring rotates a still-valid token before starting without exposing it", async () => {
  const calls = [];
  const queue = [
    token(),
    me(),
    response({ data: { accessToken: "b".repeat(64), expiresIn: 300 } }),
    me(),
    response({ data: { queued: true } }),
  ];
  const client = make(async (url, options) => {
    calls.push({ url, options });
    return queue.shift();
  });
  await client.restore();
  const path = `/api/v1/resume/${identity.id}/tailoring`;
  assert.equal(
    (await client.requestApi(path, { method: "POST", body: "{}" })).status,
    200,
  );
  assert.equal(calls[2].url, "http://localhost:4001/api/v1/auth/refresh");
  assert.equal(calls[3].url, "http://localhost:4001/api/v1/auth/me");
  assert.equal(
    calls[4].options.headers.get("Authorization"),
    `Bearer ${"b".repeat(64)}`,
  );
  assert.equal(
    calls.filter((c) => c.url === `http://localhost:4000${path}`).length,
    1,
  );
  assert.ok(!JSON.stringify(client.getSnapshot()).includes("b".repeat(64)));
});

test("failed refresh and logout during tailoring refresh prevent queue submission", async () => {
  for (const logout of [false, true]) {
    let finish,
      apiCalls = 0;
    const queue = [token(), me()];
    const client = make(async (url) => {
      if (url.startsWith("http://localhost:4000")) {
        apiCalls++;
        return response({});
      }
      if (queue.length) return queue.shift();
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    await client.restore();
    const pending = client.requestApi(
      `/api/v1/resume/${identity.id}/tailoring`,
      { method: "POST" },
    );
    while (!finish) await new Promise((resolve) => setTimeout(resolve, 0));
    if (logout) client.receiveLogout();
    finish(logout ? token() : response({}, 503));
    await assert.rejects(pending, /Session unavailable/);
    assert.equal(apiCalls, 0);
    assert.equal(client.getSnapshot().status, logout ? "anonymous" : "error");
  }
});

test("simultaneous tailoring submissions share one fresh grant and each submit once", async () => {
  let refreshes = 0;
  const submissions = [];
  const client = make(async (url, options) => {
    if (url.endsWith("/refresh")) {
      refreshes++;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return response({
        data: {
          accessToken: (refreshes === 1 ? "a" : "b").repeat(64),
          expiresIn: 300,
        },
      });
    }
    if (url.endsWith("/me")) return me();
    submissions.push({
      url,
      authorization: options.headers.get("Authorization"),
    });
    return response({ data: { queued: true } });
  });
  await client.restore();
  const paths = [identity.id, identity.workspaceId].map(
    (id) => `/api/v1/resume/${id}/tailoring`,
  );
  await Promise.all(
    paths.map((path) => client.requestApi(path, { method: "POST" })),
  );
  assert.equal(refreshes, 2);
  assert.equal(submissions.length, 2);
  assert.ok(
    submissions.every((s) => s.authorization === `Bearer ${"b".repeat(64)}`),
  );
});
