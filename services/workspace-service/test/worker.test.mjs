import test from "node:test";
import assert from "node:assert/strict";
import { setImmediate as turn } from "node:timers/promises";
import { spawnSync } from "node:child_process";
import {
  runAuditRelayWorker,
  createDatabaseClient,
} from "@resume-forge/prisma-client";

const summary = { claimed: 0, delivered: 0, retried: 0, blocked: 0, stale: 0 };
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
function clock() {
  const sleeps = [];
  return {
    sleeps,
    wait(ms, signal) {
      const gate = deferred();
      const abort = () => gate.resolve();
      signal.addEventListener("abort", abort, { once: true });
      sleeps.push({ ms, advance: gate.resolve });
      return gate.promise.finally(() =>
        signal.removeEventListener("abort", abort),
      );
    },
  };
}

test("an already stopped worker never claims a batch", async () => {
  const controller = new AbortController();
  controller.abort();
  await runAuditRelayWorker(
    async () => {
      assert.fail("No batch allowed");
    },
    { signal: controller.signal },
  );
});

test("delivery runs when optional telemetry callbacks are omitted", async () => {
  const controller = new AbortController();
  let calls = 0;
  await runAuditRelayWorker(
    async () => {
      calls++;
      controller.abort();
      return summary;
    },
    { signal: controller.signal },
  );
  assert.equal(calls, 1);
});

test("slow batches cannot overlap and polling waits until completion", async () => {
  const controller = new AbortController();
  const timer = clock();
  const gate = deferred();
  let calls = 0;
  let active = 0;
  let peak = 0;
  const running = runAuditRelayWorker(
    async () => {
      calls++;
      active++;
      peak = Math.max(peak, active);
      if (calls === 1) await gate.promise;
      active--;
      return summary;
    },
    { signal: controller.signal, wait: timer.wait },
  );
  await turn();
  assert.equal(calls, 1);
  assert.equal(timer.sleeps.length, 0);
  gate.resolve();
  await turn();
  assert.equal(timer.sleeps[0].ms, 5000);
  assert.equal(calls, 1);
  timer.sleeps[0].advance();
  await turn();
  assert.equal(calls, 2);
  assert.equal(peak, 1);
  controller.abort();
  await running;
  assert.equal(calls, 2);
});

test("transient batch failure is retried on the next scheduled pass without raw error telemetry", async () => {
  const controller = new AbortController();
  const timer = clock();
  let calls = 0;
  const reports = [];
  const running = runAuditRelayWorker(
    async () => {
      if (++calls === 1) throw new Error("synthetic private exception");
      return summary;
    },
    {
      signal: controller.signal,
      wait: timer.wait,
      onUnavailable: (...args) => reports.push(args),
      onBatch: (result) => {
        assert.deepEqual(result, summary);
        controller.abort();
      },
    },
  );
  await turn();
  assert.equal(calls, 1);
  assert.deepEqual(reports, [[]]);
  assert.equal(timer.sleeps.length, 1);
  timer.sleeps[0].advance();
  await running;
  assert.equal(calls, 2);
});

test("shutdown drains the current batch and never schedules another claim", async () => {
  const controller = new AbortController();
  const gate = deferred();
  let completed = false;
  let calls = 0;
  const running = runAuditRelayWorker(
    async () => {
      calls++;
      await gate.promise;
      completed = true;
      return summary;
    },
    {
      signal: controller.signal,
      wait: async () => assert.fail("No poll after shutdown"),
    },
  );
  controller.abort();
  await turn();
  assert.equal(completed, false);
  gate.resolve();
  await running;
  assert.equal(completed, true);
  assert.equal(calls, 1);
});

test("shutdown aborts the real timer rather than waiting the full poll interval", async () => {
  const controller = new AbortController();
  const batch = deferred();
  const running = runAuditRelayWorker(
    async () => {
      batch.resolve();
      return summary;
    },
    { signal: controller.signal, pollIntervalMs: 60000 },
  );
  await batch.promise;
  await turn();
  controller.abort();
  await running;
});

test("invalid poll/database limits and broken clocks fail safely", async () => {
  for (const pollIntervalMs of [0, 999, 60001, 1000.5, NaN])
    await assert.rejects(
      runAuditRelayWorker(async () => summary, {
        signal: new AbortController().signal,
        pollIntervalMs,
      }),
      RangeError,
    );
  for (const timeoutMs of [0, 49, 30001, 500.5, NaN])
    assert.throws(
      () =>
        createDatabaseClient("postgresql://synthetic@127.0.0.1/example", {
          timeoutMs,
        }),
      RangeError,
    );
  await assert.rejects(
    runAuditRelayWorker(async () => summary, {
      signal: new AbortController().signal,
      wait: async () => {
        throw new Error("synthetic private timer detail");
      },
    }),
    { message: "Audit worker timer unavailable" },
  );
});

test("operator worker refuses production mode without printing configuration", () => {
  const result = spawnSync(
    process.execPath,
    [
      new URL("../../../scripts/work-local-audit.mjs", import.meta.url)
        .pathname,
    ],
    { env: { ...process.env, NODE_ENV: "production" }, encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr.trim(),
    "Local audit worker failed to start/run. Check db:runtime:init, audit:local:init and local database status.",
  );
});
