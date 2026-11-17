import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createReadabilityUseCases } from "../dist/readability.js";
import { createResumeApp } from "../dist/app.js";
import { ResumeError } from "../dist/contracts.js";
import { loadResumeApi } from "../../../apps/resume-mfe/test/resume-api-loader.mjs";
const { blankResume } = await loadResumeApi();
function setup() {
  const userId = randomUUID(),
    workspaceId = randomUUID(),
    id = randomUUID(),
    versionId = randomUUID();
  const context = {
    actor: {
      userId,
      personalWorkspaceId: workspaceId,
      expiresAt: Date.now() + 600000,
    },
    correlationId: randomUUID(),
  };
  const row = {
    id,
    ownerUserId: userId,
    workspaceId,
    currentVersion: 1,
    status: "draft",
    atsBreakdown: { atsAssessments: [], legacy: { keep: true } },
  };
  const snapshot = {
    id: versionId,
    resumeId: id,
    versionNumber: 1,
    content: { editorDraft: blankResume("Morgan Example") },
  };
  let calls = 0,
    writes = 0,
    events = 0,
    denied = "";
  const analysis = {
    engineVersion: "pdf-readability-v1",
    status: "readable",
    checkedBlocks: 1,
    recoveredBlocks: 1,
    pages: [{ page: 1, text: "Morgan Example" }],
    issues: [],
  };
  const matches = (where) =>
    row.id === where.id &&
    row.ownerUserId === where.ownerUserId &&
    row.workspaceId === where.workspaceId &&
    row.status !== "deleted";
  const tx = {
    resume: {
      findFirst: async ({ where }) => (matches(where) ? row : null),
      update: async ({ data }) => {
        writes++;
        row.atsBreakdown = data.atsBreakdown;
        return row;
      },
    },
    resumeVersion: { findUnique: async () => snapshot },
    $executeRaw: async () => 1,
    workspace: { findFirst: async () => ({ id: workspaceId }) },
    auditOutbox: {
      createMany: async () => {
        events++;
        return { count: 1 };
      },
    },
  };
  const db = { ...tx, $transaction: async (fn) => fn(tx) };
  const inspect = {
    run: async () => {
      calls++;
      return structuredClone(analysis);
    },
  };
  const api = createReadabilityUseCases({
    db,
    now: Date.now,
    authorize: async (_context, permission) => {
      if (denied === permission) throw new ResumeError("forbidden");
    },
    assert: () => {
      if (context.actor.expiresAt <= Date.now())
        throw new ResumeError("unauthenticated");
    },
    inspect: (doc) => inspect.run(doc),
    audit: (_context, action, resourceId, metadata) => ({
      eventId: randomUUID(),
      action,
      actorUserId: userId,
      targetUserId: userId,
      workspaceId,
      workspaceType: "individual",
      resourceType: "resume",
      resourceId,
      outcome: "succeeded",
      occurredAt: new Date().toISOString(),
      correlationId: context.correlationId,
      metadata,
    }),
  });
  return {
    api,
    row,
    snapshot,
    id,
    versionId,
    context,
    inspect,
    analysis,
    deny: (p) => {
      denied = p;
    },
    counts: () => ({ calls, writes, events }),
  };
}
const run = (s) =>
  s.api.runReadability(s.context, s.id, { expectedVersion: 1 });
test("GET never renders a PDF; POST caches a version/hash-bound report and preserves other metadata", async () => {
  const s = setup();
  assert.equal((await s.api.getReadability(s.context, s.id)).evaluation, null);
  assert.equal(s.counts().calls, 0);
  const result = await run(s);
  assert.equal(result.evaluation.versionId, s.versionId);
  assert.equal(result.evaluation.documentHash.length, 64);
  assert.deepEqual((await run(s)).evaluation, result.evaluation);
  assert.deepEqual(s.counts(), { calls: 1, writes: 1, events: 1 });
  assert.ok(s.row.atsBreakdown.legacy.keep);
  assert.deepEqual(
    (await s.api.getReadability(s.context, s.id)).evaluation,
    result.evaluation,
  );
});
test("owner scope and PDF download permission protect extracted contact-bearing text", async () => {
  for (const change of [
    (s) => {
      s.row.ownerUserId = randomUUID();
    },
    (s) => {
      s.row.workspaceId = randomUUID();
    },
    (s) => {
      s.row.status = "deleted";
    },
    (s) => s.deny("resume.download"),
    (s) => s.deny("resume.read"),
  ]) {
    const s = setup();
    change(s);
    await assert.rejects(run(s));
    await assert.rejects(s.api.getReadability(s.context, s.id));
    assert.equal(s.counts().calls, 0);
  }
});
test("changed versions, snapshots, hashes and checker versions cannot reuse stale results", async () => {
  const s = setup();
  await run(s);
  s.row.currentVersion = 2;
  s.snapshot.versionNumber = 2;
  s.snapshot.id = randomUUID();
  assert.equal((await s.api.getReadability(s.context, s.id)).evaluation, null);
  await assert.rejects(run(s), (e) => e.code === "revision_conflict");
  s.row.currentVersion = 1;
  s.snapshot.versionNumber = 1;
  s.snapshot.id = s.versionId;
  s.snapshot.content.editorDraft.header.headline = "Changed snapshot";
  assert.equal((await s.api.getReadability(s.context, s.id)).evaluation, null);
  s.snapshot.content.editorDraft.header.headline = "";
  s.row.atsBreakdown.pdfReadability.analysis.engineVersion = "old-engine";
  assert.equal((await s.api.getReadability(s.context, s.id)).evaluation, null);
});
test("edits, deletion, owner changes and expiry during inspection deny result publication", async () => {
  for (const change of [
    (s) => {
      s.row.currentVersion = 2;
    },
    (s) => {
      s.row.status = "deleted";
    },
    (s) => {
      s.row.ownerUserId = randomUUID();
    },
    (s) => {
      s.context.actor.expiresAt = 0;
    },
  ]) {
    const s = setup();
    s.inspect.run = async () => {
      change(s);
      return s.analysis;
    };
    await assert.rejects(run(s));
    assert.equal(s.counts().writes, 0);
    assert.equal(s.counts().events, 0);
  }
});
test("malformed input, broken worker results and worker failures never become a cached passing report", async () => {
  const s = setup();
  for (const input of [
    { expectedVersion: 0 },
    { expectedVersion: 1, document: { private: true } },
    {},
  ])
    await assert.rejects(s.api.runReadability(s.context, s.id, input));
  assert.equal(s.counts().calls, 0);
  s.inspect.run = async () => ({
    ...s.analysis,
    status: "readable",
    issues: [
      {
        kind: "no_text",
        label: "Entire resume",
        affectedBlocks: 1,
        excerpts: [],
      },
    ],
  });
  await assert.rejects(run(s));
  assert.equal(s.counts().writes, 0);
  s.inspect.run = async () => {
    throw new Error("PRIVATE DEBUG");
  };
  await assert.rejects(run(s));
  assert.equal(s.counts().writes, 0);
});
test("simultaneous metadata updates are preserved under the resume lock", async () => {
  const s = setup();
  s.inspect.run = async () => {
    s.row.atsBreakdown.parallel = { keep: true };
    return s.analysis;
  };
  await run(s);
  assert.ok(s.row.atsBreakdown.parallel.keep);
});
test("personal routes are authenticated, bounded and recheck the session before responding", async () => {
  const s = setup();
  let authenticated = true,
    changed = false,
    calls = 0;
  const app = createResumeApp({
    personalEditorOnly: true,
    resumes: s.api,
    resolveActor: async () => {
      calls++;
      return !authenticated || (changed && calls > 1)
        ? { status: "unauthenticated" }
        : { status: "authenticated", actor: s.context.actor };
    },
  });
  const url = `http://localhost/api/v1/resume/${s.id}/readability`;
  authenticated = false;
  assert.equal((await app.request(url)).status, 401);
  authenticated = true;
  calls = 0;
  assert.equal((await app.request(url)).status, 200);
  calls = 0;
  const response = await app.request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedVersion: 1 }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.evaluation.resumeId, s.id);
  calls = 0;
  changed = true;
  const revoked = await app.request(url);
  assert.equal(revoked.status, 401);
  assert.equal((await revoked.json()).data, undefined);
  changed = false;
  assert.equal(
    (await app.request(url, { method: "POST", body: "not json" })).status,
    422,
  );
  assert.equal(
    (await app.request(url, { method: "POST", body: "x".repeat(1025) })).status,
    413,
  );
});
