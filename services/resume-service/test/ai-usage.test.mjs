import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  DEFAULT_AI_USAGE_LIMITS,
  aiUsageLimitsFromEnv,
  createAiUsageLimiter,
} from "../dist/ai-usage.js";
import { createResumeApp } from "../dist/app.js";
import { ResumeError } from "../dist/contracts.js";

const DAY = 86_400_000;
const limits = {
  perDay: { tailoring: 2, assessment: 3, rewrite: 4 },
  perMinute: 3,
  siteDaily: 6,
};

test("defaults and env overrides; invalid values fail instead of disabling a cap", () => {
  assert.deepEqual(aiUsageLimitsFromEnv({}), DEFAULT_AI_USAGE_LIMITS);
  assert.deepEqual(DEFAULT_AI_USAGE_LIMITS, {
    perDay: { tailoring: 5, assessment: 20, rewrite: 40 },
    perMinute: 6,
    siteDaily: 300,
  });
  const custom = aiUsageLimitsFromEnv({
    AI_LIMIT_TAILORING_PER_DAY: "2",
    AI_LIMIT_SITE_PER_DAY: "50",
  });
  assert.equal(custom.perDay.tailoring, 2);
  assert.equal(custom.siteDaily, 50);
  assert.equal(custom.perDay.rewrite, 40);
  for (const bad of ["0", "-1", "1.5", "abc", "100001"])
    assert.throws(() => aiUsageLimitsFromEnv({ AI_LIMIT_PER_MINUTE: bad }));
});

test("per-action daily cap, isolated per user, resets at UTC midnight", () => {
  let time = 10 * DAY + 1000;
  const limiter = createAiUsageLimiter(limits, () => time);
  for (let i = 0; i < 2; i++) {
    assert.equal(limiter.reserve("alice", "tailoring").allowed, true);
    time += 61_000;
  }
  const blocked = limiter.reserve("alice", "tailoring");
  assert.equal(blocked.allowed, false);
  assert.match(blocked.message, /2 tailoring runs per day.*00:00 UTC/);
  assert.equal(blocked.retryAfterSeconds, Math.ceil((11 * DAY - time) / 1000));
  assert.equal(limiter.reserve("alice", "rewrite").allowed, true);
  assert.equal(limiter.reserve("bob", "tailoring").allowed, true);
  time = 11 * DAY;
  assert.equal(limiter.reserve("alice", "tailoring").allowed, true);
});

test("per-minute burst cap uses a sliding window", () => {
  let time = 5 * DAY;
  const limiter = createAiUsageLimiter(limits, () => time);
  for (let i = 0; i < 3; i++)
    assert.equal(limiter.reserve("alice", "rewrite").allowed, true);
  const burst = limiter.reserve("alice", "rewrite");
  assert.equal(burst.allowed, false);
  assert.equal(burst.retryAfterSeconds, 60);
  assert.match(burst.message, /Wait 60 seconds/);
  time += 60_000;
  assert.equal(limiter.reserve("alice", "rewrite").allowed, true);
});

test("site-wide daily cap applies across users", () => {
  let time = 3 * DAY;
  const limiter = createAiUsageLimiter(limits, () => time);
  for (let i = 0; i < 6; i++) {
    assert.equal(limiter.reserve(`user-${i}`, "assessment").allowed, true);
  }
  const site = limiter.reserve("new-user", "assessment");
  assert.equal(site.allowed, false);
  assert.match(site.message, /site-wide limit/);
});

test("release refunds once, and never across a day boundary", () => {
  let time = 7 * DAY;
  const limiter = createAiUsageLimiter(
    { ...limits, perDay: { ...limits.perDay, tailoring: 1 } },
    () => time,
  );
  const first = limiter.reserve("alice", "tailoring");
  assert.equal(first.allowed, true);
  first.release();
  first.release();
  const second = limiter.reserve("alice", "tailoring");
  assert.equal(second.allowed, true);
  assert.equal(limiter.reserve("alice", "tailoring").allowed, false);
  time = 8 * DAY;
  const nextDay = limiter.reserve("alice", "tailoring");
  assert.equal(nextDay.allowed, true);
  // Yesterday's refund must not free today's quota.
  if (second.allowed) second.release();
  assert.equal(limiter.reserve("alice", "tailoring").allowed, false);
});

test("routes return 429 with Retry-After, count only paid POSTs and refund client errors", async () => {
  const actor = { userId: randomUUID(), personalWorkspaceId: randomUUID() };
  const resumeId = randomUUID();
  let calls = 0;
  let failWith;
  const run = async () => {
    calls++;
    if (failWith) throw failWith;
    return { ok: true };
  };
  const app = createResumeApp({
    personalEditorOnly: true,
    appOrigin: "http://localhost:3000",
    aiUsage: createAiUsageLimiter({
      perDay: { tailoring: 1, assessment: 2, rewrite: 1 },
      perMinute: 10,
      siteDaily: 100,
    }),
    resolveActor: async () => ({ status: "authenticated", actor }),
    resumes: {
      getAtsAssessment: run,
      runAtsAssessment: run,
      requestRewrite: run,
      getTailoring: run,
      startTailoring: run,
    },
  });
  const post = (kind, body = "{}") =>
    app.request(`http://localhost/api/v1/resume/${resumeId}/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

  // Client errors before any provider call do not consume quota.
  failWith = new ResumeError("revision_conflict", "Newer version.");
  assert.equal((await post("tailoring")).status, 409);
  assert.equal((await post("tailoring", "{")).status, 422);
  failWith = undefined;
  assert.equal((await post("tailoring")).status, 200);
  const limited = await post("tailoring");
  assert.equal(limited.status, 429);
  assert.match(limited.headers.get("Retry-After"), /^\d+$/);
  const body = await limited.json();
  assert.equal(body.error.code, "rate_limited");
  assert.match(body.error.message, /1 tailoring runs per day/);

  // Reads never count; each action has its own cap.
  for (let i = 0; i < 5; i++)
    assert.equal(
      (
        await app.request(
          `http://localhost/api/v1/resume/${resumeId}/tailoring`,
        )
      ).status,
      200,
    );
  assert.equal((await post("ai-rewrite")).status, 200);
  assert.equal((await post("ai-rewrite")).status, 429);
  assert.equal((await post("ats-assessment")).status, 200);

  // Provider failures still count: the paid call may have happened.
  failWith = new Error("provider down");
  assert.equal((await post("ats-assessment")).status, 503);
  failWith = undefined;
  const before = calls;
  assert.equal((await post("ats-assessment")).status, 429);
  assert.equal(calls, before, "A limited request never reaches the use case");
});
