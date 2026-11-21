import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadResumeApi } from "./resume-api-loader.mjs";
const { createResumeApi } = await loadResumeApi();
const id = randomUUID(),
  workspaceId = randomUUID();
const fixture = () => ({
  currentVersion: 1,
  evaluation: {
    resumeId: id,
    versionId: randomUUID(),
    resumeVersion: 1,
    documentHash: "a".repeat(64),
    checkedAt: new Date().toISOString(),
    analysis: {
      engineVersion: "pdf-readability-v1",
      status: "readable",
      checkedBlocks: 1,
      recoveredBlocks: 1,
      pages: [{ page: 1, text: "Morgan Example" }],
      issues: [],
    },
  },
});
const envelope = (data) =>
  new Response(JSON.stringify({ data }), {
    headers: { "Content-Type": "application/json" },
  });
test("saved readability GET is read-only and preserves its abort signal and workspace", async () => {
  let sent;
  const abort = new AbortController();
  const api = createResumeApi(async (path, options) => {
    sent = { path, ...options };
    return envelope({ currentVersion: 1, evaluation: null });
  }, workspaceId);
  assert.equal((await api.readability(id, abort.signal)).evaluation, null);
  assert.equal(sent.method, "GET");
  assert.equal(sent.body, undefined);
  assert.equal(sent.signal, abort.signal);
  assert.equal(sent.headers["X-Workspace-Id"], workspaceId);
});
test("readability POST sends only the expected saved version, never JD or resume data", async () => {
  let sent;
  const value = fixture();
  const api = createResumeApi(async (path, options) => {
    sent = { path, ...options };
    return envelope(value);
  }, workspaceId);
  assert.deepEqual(await api.runReadability(id, 1), value);
  assert.equal(sent.path, `/api/v1/resume/${id}/readability`);
  assert.equal(sent.method, "POST");
  assert.deepEqual(JSON.parse(sent.body), { expectedVersion: 1 });
});
test("cross-resume, stale and contradictory reports are rejected", async () => {
  for (const mutate of [
    (v) => {
      v.evaluation.resumeId = workspaceId;
    },
    (v) => {
      v.evaluation.resumeVersion = 2;
    },
    (v) => {
      v.currentVersion = 2;
    },
    (v) => {
      v.evaluation.analysis.recoveredBlocks = 2;
    },
    (v) => {
      v.evaluation.analysis.pages[0].page = 2;
    },
    (v) => {
      v.evaluation.analysis.privateDebug = "PRIVATE DEBUG";
    },
  ]) {
    const value = fixture();
    mutate(value);
    const api = createResumeApi(async () => envelope(value), workspaceId);
    await assert.rejects(
      api.runReadability(id, 1),
      (e) => e.code === "invalid_response",
    );
  }
});
test("a failed check reports safe actions and never prints backend diagnostics", async () => {
  for (const [status, code, phrase] of [
    [401, "unauthenticated", "Sign in"],
    [409, "revision_conflict", "saved resume changed"],
    [503, "resume_unavailable", "Your resume is unchanged"],
  ]) {
    const api = createResumeApi(
      async () =>
        new Response(
          JSON.stringify({ error: { code, message: "PRIVATE DEBUG" } }),
          { status },
        ),
      workspaceId,
    );
    await assert.rejects(
      api.runReadability(id, 1),
      (e) => e.message.includes(phrase) && !e.message.includes("PRIVATE DEBUG"),
    );
  }
});
test("invalid targets are rejected before requesting PDF work", async () => {
  let calls = 0;
  const api = createResumeApi(async () => {
    calls++;
    return envelope(fixture());
  }, workspaceId);
  await assert.rejects(api.readability("not-an-id"));
  await assert.rejects(api.runReadability(id, 0));
  assert.equal(calls, 0);
});
test("usage limits show the server's reset message on every AI action", async () => {
  const message =
    "Daily limit reached: 20 job fit checks per day. Try again after 00:00 UTC.";
  const api = createResumeApi(
    async () =>
      new Response(
        JSON.stringify({ error: { code: "rate_limited", message } }),
        { status: 429 },
      ),
    workspaceId,
  );
  await assert.rejects(
    api.runAtsAssessment(id, 1, "x".repeat(60)),
    (e) => e.code === "rate_limited" && e.message === message,
  );
  await assert.rejects(api.runReadability(id, 1), (e) => e.message === message);
});
