import test from "node:test";
import assert from "node:assert/strict";
import { createResumeApp } from "../dist/app.js";
import { randomUUID } from "node:crypto";
import {
  createAssessmentUseCases,
  atsSources,
  createAtsClient,
} from "../dist/ats/assessment.js";
import { GEMINI_MODEL } from "../dist/ats/ai.js";
import { loadResumeApi } from "../../../apps/resume-mfe/test/resume-api-loader.mjs";
const { blankResume, fromResumeContent } = await loadResumeApi();
const userId = randomUUID(),
  workspaceId = randomUUID(),
  resumeId = randomUUID(),
  versionId = randomUUID();
const jdText =
  "Backend engineer. Required: Python API experience. Preferred: PostgreSQL.";
const context = {
  actor: {
    userId,
    personalWorkspaceId: workspaceId,
    expiresAt: Date.now() + 600000,
  },
  correlationId: randomUUID(),
};
function document() {
  const doc = blankResume("Private Identity");
  doc.header.firstName = "Private";
  doc.header.lastName = "Identity";
  doc.sampleContact = {
    email: "private@example.invalid",
    phone: "+12345678901",
  };
  const content = fromResumeContent({
    sections: [
      {
        id: "work",
        kind: "experience",
        entries: [
          {
            id: "work-a",
            title: "Engineer",
            description: "Built Python APIs for operations.",
          },
          {
            id: "work-hidden",
            title: "Hidden",
            hidden: true,
            description: "SECRET HIDDEN WORK",
          },
        ],
      },
    ],
  });
  doc.sections[1].entries = content.sections[0].entries;
  return doc;
}
function assessment(input) {
  const source = input.sources.find((source) =>
    source.text.includes("Built Python"),
  );
  return {
    rubricVersion: "ats-evidence-v1",
    model: GEMINI_MODEL,
    score: 100,
    coverage: {
      required: { supported: 1, total: 1 },
      preferred: { supported: 0, total: 1 },
    },
    requirements: [
      {
        id: "python",
        requirement: "Python API experience",
        jdQuote: "Required: Python API experience.",
        importance: "required",
        status: "supported",
        evidence: [
          { sourceId: source.id, quote: "Built Python APIs for operations." },
        ],
      },
      {
        id: "postgres",
        requirement: "PostgreSQL",
        jdQuote: "Preferred: PostgreSQL.",
        importance: "preferred",
        status: "missing",
        evidence: [],
      },
    ],
    warnings: [],
  };
}
function setup(overrides = {}) {
  const doc = document();
  let calls = 0,
    writes = 0,
    events = 0;
  const row = {
    id: resumeId,
    ownerUserId: userId,
    workspaceId,
    currentVersion: 1,
    status: "draft",
    atsBreakdown: { readiness: { evaluations: [{ legacy: "preserved" }] } },
  };
  const snapshot = {
    id: versionId,
    resumeId,
    versionNumber: 1,
    content: { editorDraft: doc },
  };
  const tx = {
    workspace: { findFirst: async () => ({ id: workspaceId }) },
    resume: {
      findFirst: async ({ where }) =>
        row.ownerUserId === where.ownerUserId &&
        row.workspaceId === where.workspaceId &&
        row.status !== "deleted"
          ? row
          : null,
      update: async ({ data }) => {
        writes++;
        row.atsBreakdown = data.atsBreakdown;
        return row;
      },
    },
    resumeVersion: { findUnique: async () => snapshot },
    $executeRaw: async () => 1,
    auditOutbox: {
      createMany: async () => {
        events++;
        return { count: 1 };
      },
    },
  };
  const db = { ...tx, $transaction: async (fn) => fn(tx) };
  const client = {
    model: GEMINI_MODEL,
    assess: async (input) => {
      calls++;
      return assessment(input);
    },
    ...overrides.client,
  };
  const api = createAssessmentUseCases({
    db,
    now: Date.now,
    client,
    assert: () => {
      if (context.actor.expiresAt <= Date.now())
        throw new Error("unauthenticated");
    },
    authorize: async () => {
      if (overrides.denied) throw new Error("forbidden");
    },
    audit: (_context, action, id, metadata) => ({
      eventId: randomUUID(),
      action,
      actorUserId: userId,
      targetUserId: userId,
      workspaceType: "individual",
      workspaceId,
      resourceType: "resume",
      resourceId: id,
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
    doc,
    client,
    counts: () => ({ calls, writes, events }),
  };
}
const run = (s, changes = {}) =>
  s.api.runAtsAssessment(context, resumeId, {
    expectedVersion: 1,
    jdText,
    consent: true,
    ...changes,
  });
test("ATS projection excludes identity, contacts and hidden work while preserving visible professional evidence", () => {
  const doc = document();
  doc.sections[1].entries[0].id = "private@example.invalid";
  const sources = atsSources(doc),
    text = JSON.stringify(sources);
  assert.ok(text.includes("Built Python APIs"));
  for (const secret of [
    "Private Identity",
    "private@example.invalid",
    "+12345678901",
    "SECRET HIDDEN WORK",
  ])
    assert.ok(!text.includes(secret));
  doc.sections[1].entries[0].description.content[0].content[0].text =
    "Contact private@example.invalid";
  assert.throws(() => atsSources(doc));
});
test("assessment persists version identity and audit atomically; repeats reuse exact bound input", async () => {
  const s = setup(),
    result = await run(s);
  assert.equal(result.evaluation.versionId, versionId);
  assert.equal(result.evaluation.assessment.score, 100);
  assert.equal(result.evaluation.inputHash.length, 64);
  assert.equal(result.evaluation.jdHash.length, 64);
  assert.equal(result.evaluation.jdText, jdText);
  assert.equal(
    (await s.api.getAtsAssessment(context, resumeId)).evaluation.jdText,
    jdText,
  );
  assert.deepEqual(s.counts(), { calls: 1, writes: 1, events: 1 });
  assert.deepEqual((await run(s)).evaluation, result.evaluation);
  assert.deepEqual(s.counts(), { calls: 1, writes: 1, events: 1 });
  assert.ok(s.row.atsBreakdown.readiness); // Historical metadata remains readable.
  assert.equal(
    (await s.api.getAtsAssessment(context, resumeId)).evaluation.id,
    result.evaluation.id,
  );
});
test("legacy assessments without retained JD stay readable; mismatched saved JD fails closed", async () => {
  const s = setup();
  await run(s);
  const saved = s.row.atsBreakdown.atsAssessments[0];
  delete saved.jdText;
  assert.equal(
    (await s.api.getAtsAssessment(context, resumeId)).evaluation.assessment
      .score,
    100,
  );
  assert.equal(
    (await s.api.getAtsAssessment(context, resumeId)).evaluation.jdText,
    undefined,
  );
  saved.jdText =
    "A different job description with at least fifty characters of text.";
  await assert.rejects(s.api.getAtsAssessment(context, resumeId));
});
test("current state hides assessments for changed versions or changed model; old scores cannot satisfy a new request", async () => {
  const s = setup();
  await run(s);
  s.row.currentVersion = 2;
  assert.equal(
    (await s.api.getAtsAssessment(context, resumeId)).evaluation,
    null,
  );
  await assert.rejects(run(s), (error) => error.code === "revision_conflict");
  s.row.currentVersion = 1;
  s.client.model = "different-model";
  assert.equal(
    (await s.api.getAtsAssessment(context, resumeId)).evaluation,
    null,
  );
});
test("requires explicit consent and owner scope before provider egress", async () => {
  for (const changes of [
    { consent: false },
    { consent: undefined },
    { expectedVersion: 2 },
    { jdText: "too short" },
  ]) {
    const s = setup();
    await assert.rejects(run(s, changes));
    assert.equal(s.counts().calls, 0);
  }
  const s = setup();
  s.row.ownerUserId = randomUUID();
  await assert.rejects(run(s), (error) => error.code === "not_found");
  assert.equal(s.counts().calls, 0);
  const denied = setup({ denied: true });
  await assert.rejects(run(denied));
  assert.equal(denied.counts().calls, 0);
});
test("save, deletion or expiry during provider request prevents assessment publication", async () => {
  for (const change of [
    (s) => (s.row.currentVersion = 2),
    (s) => (s.row.status = "deleted"),
    () => (context.actor.expiresAt = 0),
  ]) {
    const s = setup();
    s.client.assess = async (input) => {
      const output = assessment(input);
      change(s);
      return output;
    };
    try {
      await assert.rejects(run(s));
      assert.equal(s.counts().writes, 0);
      assert.equal(s.counts().events, 0);
    } finally {
      context.actor.expiresAt = Date.now() + 600000;
    }
  }
});
test("provider failures, unknown source IDs and fabricated quotes fail without old-score fallback", async () => {
  for (const alter of [
    () => {
      throw new Error("private provider error");
    },
    (result) => {
      result.requirements[0].evidence[0].sourceId = "forged";
      return result;
    },
    (result) => {
      result.requirements[0].jdQuote = "invented requirement";
      return result;
    },
  ]) {
    const s = setup();
    s.client.assess = async (input) => alter(assessment(input));
    await assert.rejects(run(s));
    assert.equal(s.counts().writes, 0);
  }
});
test("bounded private client sanitizes errors, rejects redirects/body overflow and validates response model", async () => {
  for (const response of [
    () => new Response("private provider credentials", { status: 503 }),
    () => new Response("x".repeat(262145)),
    () =>
      new Response(
        JSON.stringify({
          ...assessment({ sources: [{ id: "a", text: "Built Python APIs" }] }),
          model: "wrong",
        }),
      ),
  ]) {
    let sent;
    const client = createAtsClient("a".repeat(64), async (url, options) => {
      sent = { url, options };
      return response();
    });
    await assert.rejects(
      client.assess({ jdText, sources: [] }),
      (error) => !error.message.includes("credentials"),
    );
    assert.equal(sent.url, "http://127.0.0.1:4004/internal/ats/assess");
    assert.equal(sent.options.redirect, "error");
    assert.ok(sent.options.headers.Authorization.startsWith("Bearer "));
    assert.equal(
      sent.options.headers.Authorization.includes("a".repeat(64)),
      false,
    );
  }
});

test("owned assessment route is gated, authenticated and forwards explicit version-bound input", async () => {
  const s = setup(),
    resumes = { ...s.api };
  const make = (authenticated) =>
    createResumeApp({
      personalEditorOnly: true,
      appOrigin: "http://localhost:3000",
      resumes,
      resolveActor: async () =>
        authenticated
          ? { status: "authenticated", actor: context.actor }
          : { status: "unauthenticated" },
    });
  const url = `http://localhost/api/v1/resume/${resumeId}/ats-assessment`;
  assert.equal((await make(false).request(url)).status, 401);
  const app = make(true);
  assert.equal((await app.request(url)).status, 200);
  const response = await app.request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedVersion: 1, jdText, consent: true }),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.evaluation.versionId, versionId);
  for (const kind of ["readiness", "jd-match"]) {
    const retired = await app.request(
      `http://localhost/api/v1/resume/${resumeId}/${kind}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      },
    );
    assert.equal(retired.status, 410);
    assert.equal((await retired.json()).error.code, "assessment_retired");
  }
});
