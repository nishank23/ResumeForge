import assert from "node:assert/strict";
import test from "node:test";

import { AUDIT_EVENT_NAMES, validateAuditEventIntent } from "../dist/index.js";

const validIntent = {
  eventId: "evt_01",
  action: "profile.viewed",
  actorUserId: "user_alice",
  workspaceType: "individual",
  workspaceId: "ws_alice",
  resourceType: "profile",
  resourceId: "profile_alice",
  outcome: "succeeded",
  occurredAt: "2026-09-30T12:00:00.000Z",
  correlationId: "req_01",
  metadata: { status: "authorized" },
};

test("keeps the approved and proposed audit event catalog exact and unique", () => {
  assert.equal(AUDIT_EVENT_NAMES.length, 22);
  assert.equal(new Set(AUDIT_EVENT_NAMES).size, 22);
  assert.ok(AUDIT_EVENT_NAMES.includes("authorization.denied"));
  assert.ok(AUDIT_EVENT_NAMES.includes("resume.suggestion_discarded"));
});

test("accepts a fully scoped content-free event intent", () => {
  assert.deepEqual(validateAuditEventIntent(validIntent), {
    success: true,
    data: validIntent,
  });
});

test("accepts the canonical permission name on a denied event", () => {
  const result = validateAuditEventIntent({
    ...validIntent,
    action: "authorization.denied",
    outcome: "denied",
    metadata: {
      permission: "profile.contact.read",
      reasonCode: "scope_mismatch",
    },
  });

  assert.equal(result.success, true);
});

test("rejects unknown event names", () => {
  const result = validateAuditEventIntent({
    ...validIntent,
    action: "contact.exported",
  });

  assert.deepEqual(result, {
    success: false,
    issues: [{ path: "action", code: "invalid_value" }],
  });
});

test("rejects raw private content and unknown metadata keys", () => {
  const result = validateAuditEventIntent({
    ...validIntent,
    metadata: {
      contactEmail: "alice@example.com",
      prompt: "Rewrite my private resume",
    },
  });

  assert.deepEqual(result, {
    success: false,
    issues: [
      { path: "metadata.contactEmail", code: "unknown_key" },
      { path: "metadata.prompt", code: "unknown_key" },
    ],
  });
});

test("rejects nested metadata even when the key is allowed", () => {
  const result = validateAuditEventIntent({
    ...validIntent,
    metadata: { status: { value: "authorized" } },
  });

  assert.deepEqual(result, {
    success: false,
    issues: [{ path: "metadata.status", code: "invalid_type" }],
  });
});

test("rejects URLs, email-like values, and free text in safe metadata", () => {
  for (const metadata of [
    { artifactId: "https://signed.example/file" },
    { status: "alice@example.com" },
    { reasonCode: "contains private profile text" },
  ]) {
    const result = validateAuditEventIntent({ ...validIntent, metadata });
    assert.equal(result.success, false);
    assert.equal(result.issues[0]?.code, "invalid_value");
  }
});

test("rejects invalid permission metadata", () => {
  const result = validateAuditEventIntent({
    ...validIntent,
    action: "authorization.denied",
    outcome: "denied",
    metadata: { permission: "profile.export_everything" },
  });

  assert.deepEqual(result, {
    success: false,
    issues: [{ path: "metadata.permission", code: "invalid_value" }],
  });
});

test("rejects non-UTC and noncanonical timestamps", () => {
  const result = validateAuditEventIntent({
    ...validIntent,
    occurredAt: "2026-09-30T14:00:00+02:00",
  });

  assert.deepEqual(result, {
    success: false,
    issues: [{ path: "occurredAt", code: "invalid_value" }],
  });
});

test("rejects action/resource mismatches", () => {
  const result = validateAuditEventIntent({
    ...validIntent,
    action: "contact.viewed",
    resourceType: "profile",
  });

  assert.deepEqual(result, {
    success: false,
    issues: [{ path: "resourceType", code: "resource_mismatch" }],
  });
});

test("enforces explicit denied and failure outcomes", () => {
  const denied = validateAuditEventIntent({
    ...validIntent,
    action: "authorization.denied",
    outcome: "succeeded",
  });
  const failed = validateAuditEventIntent({
    ...validIntent,
    action: "resume.generation_failed",
    resourceType: "resume",
    outcome: "succeeded",
  });

  assert.equal(denied.success, false);
  assert.deepEqual(denied.issues, [
    { path: "outcome", code: "outcome_mismatch" },
  ]);
  assert.equal(failed.success, false);
  assert.deepEqual(failed.issues, [
    { path: "outcome", code: "outcome_mismatch" },
  ]);
});

test("requires attributable scope and opaque safe identifiers", () => {
  const result = validateAuditEventIntent({
    ...validIntent,
    actorUserId: "",
    resourceId: "profile/alice",
    correlationId: "request with spaces",
  });

  assert.deepEqual(result, {
    success: false,
    issues: [
      { path: "actorUserId", code: "invalid_value" },
      { path: "resourceId", code: "invalid_value" },
      { path: "correlationId", code: "invalid_value" },
    ],
  });
});
