import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";
import pg from "pg";
import {
  createDatabaseClient,
  withPersonalAuditTransaction,
  deliverAuditOutbox,
  AuditDeliveryRejection,
} from "@resume-forge/prisma-client";
import { ingestPersonalAuditEvent } from "../dist/audit.js";

// Synthetic disposable databases on the managed local cluster only.
const local = parseEnv(
  readFileSync(
    new URL("../../../.local/database.env", import.meta.url),
    "utf8",
  ),
);
const base = new URL(local.DATABASE_URL);
assert.equal(base.hostname, "127.0.0.1");
assert.equal(base.port, "55432");
const name = `rf_audit_test_${randomUUID().replaceAll("-", "")}`;
const adminUrl = new URL(base);
adminUrl.pathname = "/postgres";
const admin = new pg.Client({ connectionString: adminUrl.href });
const url = new URL(base);
url.pathname = `/${name}`;
const db = createDatabaseClient(url.href);
const observer = createDatabaseClient(url.href);

test("local audit delivery, retry, isolation and crash recovery", async (t) => {
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    const migration = spawnSync(
      "pnpm",
      ["exec", "prisma", "migrate", "deploy"],
      {
        cwd: new URL("../../../packages/prisma-client", import.meta.url),
        env: { ...process.env, DATABASE_URL: url.href },
        encoding: "utf8",
      },
    );
    assert.equal(migration.status, 0, "Fresh audit migration must succeed");
    const alice = await db.user.create({
      data: { email: "audit-alice@example.invalid" },
    });
    const bob = await db.user.create({
      data: { email: "audit-bob@example.invalid" },
    });
    const workspace = await db.workspace.create({
      data: { type: "individual", personalOwnerUserId: alice.id },
    });
    const other = await db.workspace.create({
      data: { type: "individual", personalOwnerUserId: bob.id },
    });
    const profile = await db.userProfile.create({
      data: { userId: alice.id, fullName: "Synthetic Audit User" },
    });
    let time = Date.now() + 86_400_000;
    const now = () => new Date(time);
    const options = { now };
    const intent = (overrides = {}) => ({
      eventId: randomUUID(),
      actorUserId: alice.id,
      workspaceId: workspace.id,
      workspaceType: "individual",
      resourceType: "profile",
      resourceId: profile.id,
      action: "profile.updated",
      outcome: "succeeded",
      occurredAt: new Date().toISOString(),
      correlationId: randomUUID(),
      metadata: { permission: "profile.update" },
      ...overrides,
    });
    const queue = async (event) =>
      withPersonalAuditTransaction(db, alice.id, event, (tx) =>
        tx.userProfile.update({
          where: { id: profile.id },
          data: { revision: { increment: 1 } },
        }),
      );
    const send = (event) => ingestPersonalAuditEvent(db, event);
    const row = (event) =>
      observer.auditOutbox.findUniqueOrThrow({
        where: { eventId: event.eventId },
      });

    await t.test(
      "committed outbox reaches one scoped ledger event with full safe intent",
      async () => {
        const event = intent();
        await queue(event);
        assert.equal(await observer.auditEvent.count(), 0);
        const summary = await deliverAuditOutbox(db, send, options);
        assert.equal(summary.delivered, 1);
        const ledger = await observer.auditEvent.findUniqueOrThrow({
          where: { id: event.eventId },
        });
        assert.equal(ledger.workspaceId, workspace.id);
        assert.equal(ledger.actorUserId, alice.id);
        assert.equal(ledger.outcome, event.outcome);
        assert.equal(ledger.correlationId, event.correlationId);
        assert.equal(ledger.timestamp.toISOString(), event.occurredAt);
        assert.deepEqual(ledger.metadata, event.metadata);
        assert.equal(ledger.payloadHash.length, 64);
        assert.equal((await row(event)).deliveryState, "delivered");
        assert.equal((await row(event)).attempts, 1);
        assert.equal((await deliverAuditOutbox(db, send, options)).claimed, 0);
      },
    );

    await t.test(
      "outage preserves mutation and persisted capped backoff across retries",
      async () => {
        const event = intent();
        const saved = await queue(event);
        for (let attempt = 1; attempt <= 8; attempt++) {
          const summary = await deliverAuditOutbox(
            db,
            async () => {
              const error = new AuditDeliveryRejection("event_conflict");
              // Runtime transport errors cannot rely on TypeScript's readonly union.
              error.code = "secret@example.invalid";
              throw error;
            },
            options,
          );
          assert.equal(summary.retried, 1);
          const pending = await row(event);
          assert.equal(pending.deliveryState, "pending");
          assert.equal(pending.attempts, attempt);
          assert.equal(pending.lastErrorCode, "delivery_unavailable");
          const delay = Math.min(300_000, 5_000 * 2 ** (attempt - 1));
          assert.equal(pending.nextAttemptAt.getTime(), time + delay);
          assert.equal(
            (await deliverAuditOutbox(observer, send, options)).claimed,
            0,
          );
          time += delay;
        }
        assert.equal(
          (
            await observer.userProfile.findUniqueOrThrow({
              where: { id: profile.id },
            })
          ).revision,
          saved.revision,
        );
        assert.equal(
          (
            await deliverAuditOutbox(
              observer,
              (event) => ingestPersonalAuditEvent(observer, event),
              options,
            )
          ).delivered,
          1,
        );
        assert.equal((await row(event)).attempts, 9);
        assert.equal((await row(event)).lastErrorCode, null);
        assert.equal(
          await observer.auditEvent.count({ where: { id: event.eventId } }),
          1,
        );
      },
    );

    await t.test(
      "lost acknowledgement retries without duplicating a committed event",
      async () => {
        const event = intent();
        await queue(event);
        await deliverAuditOutbox(
          db,
          async (value) => {
            await send(value);
            throw new Error("synthetic lost response");
          },
          options,
        );
        assert.equal((await row(event)).deliveryState, "pending");
        assert.equal(
          await observer.auditEvent.count({ where: { id: event.eventId } }),
          1,
        );
        time += 5_000;
        assert.equal(
          (await deliverAuditOutbox(db, send, options)).delivered,
          1,
        );
        assert.equal(
          await observer.auditEvent.count({ where: { id: event.eventId } }),
          1,
        );
      },
    );

    await t.test(
      "concurrent relays do not claim the same active lease",
      async () => {
        const event = intent();
        await queue(event);
        let release;
        let claimed;
        const gate = new Promise((resolve) => {
          release = resolve;
        });
        const started = new Promise((resolve) => {
          claimed = resolve;
        });
        const first = deliverAuditOutbox(
          db,
          async (value) => {
            claimed();
            await gate;
            await send(value);
          },
          { ...options, batchSize: 1 },
        );
        await started;
        try {
          assert.equal(
            (await deliverAuditOutbox(observer, send, options)).claimed,
            0,
          );
        } finally {
          release();
        }
        assert.equal((await first).delivered, 1);
        assert.equal((await row(event)).attempts, 1);
      },
    );

    await t.test(
      "expired lease recovers on another connection and fences stale completion",
      async () => {
        const event = intent();
        await queue(event);
        let release;
        let claimed;
        const gate = new Promise((resolve) => {
          release = resolve;
        });
        const started = new Promise((resolve) => {
          claimed = resolve;
        });
        const first = deliverAuditOutbox(
          db,
          async (value) => {
            claimed();
            await gate;
            await send(value);
          },
          options,
        );
        await started;
        try {
          time += 30_001;
          const second = await deliverAuditOutbox(
            observer,
            (value) => ingestPersonalAuditEvent(observer, value),
            options,
          );
          assert.equal(second.delivered, 1);
        } finally {
          release();
        }
        assert.equal((await first).stale, 1);
        assert.equal((await row(event)).attempts, 2);
        assert.equal((await row(event)).deliveryState, "delivered");
        assert.equal(
          await observer.auditEvent.count({ where: { id: event.eventId } }),
          1,
        );
      },
    );

    await t.test(
      "concurrent equivalent ingestion deduplicates and conflicting reuse cannot overwrite",
      async () => {
        const event = intent({
          metadata: { status: "saved", permission: "profile.update" },
        });
        const equivalent = {
          ...event,
          ignoredRootField: "must-not-persist",
          metadata: { permission: "profile.update", status: "saved" },
        };
        const results = await Promise.all([
          send(event),
          ingestPersonalAuditEvent(observer, equivalent),
        ]);
        assert.equal(results.filter((value) => value.duplicate).length, 1);
        await assert.rejects(
          send({ ...event, correlationId: randomUUID() }),
          (error) =>
            error instanceof AuditDeliveryRejection &&
            error.code === "event_conflict",
        );
        const ledger = await observer.auditEvent.findUniqueOrThrow({
          where: { id: event.eventId },
        });
        assert.equal(ledger.correlationId, event.correlationId);
        assert.equal(
          JSON.stringify(ledger).includes("must-not-persist"),
          false,
        );
        assert.equal(
          await observer.auditEvent.count({ where: { id: event.eventId } }),
          1,
        );
      },
    );

    await t.test(
      "invalid payload, mismatched identity and spoofed scope are retained blocked",
      async () => {
        const bad = [
          intent({ metadata: { rawContact: "private@example.invalid" } }),
          intent({ workspaceId: other.id }),
          intent({ targetUserId: bob.id }),
          intent({ actorUserId: "invalid-uuid" }),
        ];
        for (const value of bad) {
          await db.auditOutbox.create({
            data: { eventId: value.eventId, payload: value },
          });
        }
        const mismatched = intent();
        const mismatchId = randomUUID();
        await db.auditOutbox.create({
          data: { eventId: mismatchId, payload: mismatched },
        });
        const summary = await deliverAuditOutbox(db, send, options);
        assert.equal(summary.blocked, 5);
        for (const value of bad) {
          const blocked = await row(value);
          assert.equal(blocked.deliveryState, "blocked");
          assert.equal(
            ["invalid_scope", "invalid_intent"].includes(blocked.lastErrorCode),
            true,
          );
          assert.equal(
            await observer.auditEvent.count({ where: { id: value.eventId } }),
            0,
          );
        }
        assert.equal(
          await observer.auditEvent.count({
            where: { id: mismatched.eventId },
          }),
          0,
        );
        assert.equal((await deliverAuditOutbox(db, send, options)).claimed, 0);
        const conflict = intent();
        await send(conflict);
        await queue({ ...conflict, correlationId: randomUUID() });
        assert.equal((await deliverAuditOutbox(db, send, options)).blocked, 1);
        assert.equal((await row(conflict)).lastErrorCode, "event_conflict");
      },
    );

    await t.test(
      "acknowledgement commit failure leaves a recoverable lease and one ledger event",
      async () => {
        const event = intent();
        await queue(event);
        await db.$executeRawUnsafe(
          `CREATE FUNCTION reject_audit_ack() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."deliveryState" = 'delivered' THEN RAISE EXCEPTION 'synthetic acknowledgement failure'; END IF; RETURN NEW; END $$`,
        );
        await db.$executeRawUnsafe(
          `CREATE CONSTRAINT TRIGGER reject_audit_ack AFTER UPDATE ON "AuditOutbox" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reject_audit_ack()`,
        );
        try {
          await assert.rejects(deliverAuditOutbox(db, send, options));
          assert.equal((await row(event)).deliveryState, "delivering");
          assert.equal(
            await observer.auditEvent.count({ where: { id: event.eventId } }),
            1,
          );
        } finally {
          await db.$executeRawUnsafe(
            `DROP TRIGGER reject_audit_ack ON "AuditOutbox"`,
          );
          await db.$executeRawUnsafe(`DROP FUNCTION reject_audit_ack()`);
        }
        time += 30_001;
        assert.equal(
          (await deliverAuditOutbox(db, send, options)).delivered,
          1,
        );
        assert.equal(
          await observer.auditEvent.count({ where: { id: event.eventId } }),
          1,
        );
      },
    );

    await t.test(
      "batch limits and invalid persisted delivery states fail closed",
      async () => {
        for (const batchSize of [0, 101, 1.5]) {
          await assert.rejects(
            deliverAuditOutbox(db, send, { batchSize }),
            RangeError,
          );
        }
        await assert.rejects(
          deliverAuditOutbox(db, send, { leaseMs: 0 }),
          RangeError,
        );
        await assert.rejects(
          deliverAuditOutbox(db, send, { now: () => new Date(NaN) }),
          RangeError,
        );
        for (const data of [
          { deliveryState: "unknown" },
          { attempts: -1 },
          { deliveryState: "delivering" },
          { deliveryState: "delivered" },
        ]) {
          await assert.rejects(
            db.auditOutbox.create({
              data: { eventId: randomUUID(), payload: intent(), ...data },
            }),
          );
        }
      },
    );
  } finally {
    await Promise.all([db.$disconnect(), observer.$disconnect()]);
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.end();
  }
});
