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
