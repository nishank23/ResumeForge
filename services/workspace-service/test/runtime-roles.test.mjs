import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";
import { once } from "node:events";
import { serve } from "@hono/node-server";
import {
  createDatabaseClient,
  runtimeRoleNames,
  assertRuntimeDatabaseRole,
  withPersonalAuditTransaction,
  deliverAuditOutbox,
  createLocalAuditHttpTransport,
  runAuditRelayWorker,
} from "@resume-forge/prisma-client";
import {
  Client,
  provisionRuntimeRoles,
} from "../../../scripts/runtime-roles.mjs";
import { createWorkspaceAuditApp } from "../dist/app.js";

const base = new URL(
  parseEnv(
    readFileSync(
      new URL("../../../.local/database.env", import.meta.url),
      "utf8",
    ),
  ).DATABASE_URL,
);
assert.equal(base.hostname, "127.0.0.1");
assert.equal(base.port, "55432");
const suffix = randomUUID().replaceAll("-", "");
const databaseName = `rf_roles_test_${suffix}`;
const prefix = `rf_test_${suffix.slice(0, 12)}`;
const names = runtimeRoleNames(prefix);
const passwords = Object.fromEntries(
  Object.keys(names).map((service) => [
    service,
    randomBytes(32).toString("hex"),
  ]),
);
const adminUrl = new URL(base);
adminUrl.pathname = "/postgres";
const lifecycle = new Client({ connectionString: adminUrl.href });
const url = new URL(base);
url.pathname = `/${databaseName}`;
const admin = new Client({ connectionString: url.href });
const owner = createDatabaseClient(url.href);
const clients = {};
const databases = {};
const forbidden = async (client, query) =>
  assert.rejects(client.query(query), (error) => error.code === "42501");

test("restricted runtime roles enforce ownership and append-only audit boundaries", async (t) => {
  await lifecycle.connect();
  try {
    await lifecycle.query(`CREATE DATABASE "${databaseName}"`);
    const migration = spawnSync(
      "pnpm",
      ["exec", "prisma", "migrate", "deploy"],
      {
        cwd: new URL("../../../packages/prisma-client", import.meta.url),
        env: { ...process.env, DATABASE_URL: url.href },
        encoding: "utf8",
      },
    );
    assert.equal(migration.status, 0, "Fresh migrations must apply");
    await admin.connect();
    await provisionRuntimeRoles(admin, { databaseName, prefix, passwords });
    for (const service of Object.keys(names)) {
      const runtimeUrl = new URL(url);
      runtimeUrl.username = names[service];
      runtimeUrl.password = passwords[service];
      clients[service] = new Client({ connectionString: runtimeUrl.href });
      await clients[service].connect();
      databases[service] = createDatabaseClient(runtimeUrl.href);
    }
    const user = await owner.user.create({
      data: { email: "roles-alice@example.invalid" },
    });
    const other = await owner.user.create({
      data: { email: "roles-bob@example.invalid" },
    });
    const workspace = await owner.workspace.create({
      data: { type: "individual", personalOwnerUserId: user.id },
    });
    const otherWorkspace = await owner.workspace.create({
      data: { type: "individual", personalOwnerUserId: other.id },
    });
    const profile = await owner.userProfile.create({
      data: { userId: user.id, fullName: "Synthetic Role User" },
    });
    const contact = await owner.userContact.create({
      data: { profileId: profile.id, email: "contact@example.invalid" },
    });
    const intent = (overrides) => ({
      eventId: randomUUID(),
      actorUserId: user.id,
      workspaceId: workspace.id,
      workspaceType: "individual",
      action: "profile.updated",
      resourceType: "profile",
      resourceId: profile.id,
      outcome: "succeeded",
      occurredAt: new Date().toISOString(),
      correlationId: randomUUID(),
      metadata: { permission: "profile.update" },
      ...overrides,
    });

    await t.test(
      "all four connections pass actual identity/privilege guards; admin/wrong service fails",
      async () => {
        for (const service of Object.keys(names))
          await assertRuntimeDatabaseRole(
            databases[service],
            service,
            names[service],
          );
        await assert.rejects(
          assertRuntimeDatabaseRole(owner, "auth", names.auth),
          { message: "Unsafe runtime database access" },
        );
        await assert.rejects(
          assertRuntimeDatabaseRole(
            databases.auditRelay,
            "auditIngest",
            names.auditIngest,
          ),
          { message: "Unsafe runtime database access" },
        );
      },
    );
    await t.test(
      "services cannot read/mutate unrelated domains; auth sees only onboarding projection",
      async () => {
        for (const service of ["auth", "auditRelay", "auditIngest"])
          await forbidden(clients[service], 'SELECT * FROM "UserContact"');
        await forbidden(clients.auth, 'SELECT "fullName" FROM "UserProfile"');
        await forbidden(
          clients.auth,
          'UPDATE "UserProfile" SET "fullName" = \'changed\'',
        );
        assert.equal(
          (
            await databases.auth.userProfile.findUnique({
              where: { userId: user.id },
              select: { onboardingCompletedAt: true },
            })
          ).onboardingCompletedAt,
          null,
        );
        await forbidden(clients.profile, 'SELECT * FROM "Session"');
        await forbidden(clients.auditRelay, 'SELECT * FROM "UserProfile"');
        await forbidden(clients.auditIngest, 'SELECT * FROM "AuditOutbox"');
        await forbidden(clients.profile, 'SELECT * FROM "AuditOutbox"');
        await forbidden(
          clients.profile,
          'UPDATE "AuditOutbox" SET "deliveryState" = \'blocked\'',
        );
        await forbidden(
          clients.auditRelay,
          'UPDATE "AuditOutbox" SET "payload" = \'{}\'',
        );
        await forbidden(
          clients.auth,
          'UPDATE "Session" SET "refreshHash" = repeat(\'0\', 64)',
        );
      },
    );
    await t.test(
      "restricted producer, relay and HTTP ingestor deliver one event without admin access",
      async () => {
        const event = intent();
        await withPersonalAuditTransaction(
          databases.profile,
          user.id,
          event,
          (tx) =>
            tx.userProfile.update({
              where: { id: profile.id },
              data: { revision: { increment: 1 } },
            }),
        );
        const key = randomBytes(32).toString("hex");
        const app = createWorkspaceAuditApp({
          db: databases.auditIngest,
          relayKey: key,
        });
        const server = serve({
          hostname: "127.0.0.1",
          port: 0,
          fetch: app.fetch,
        });
        await once(server, "listening");
        try {
          const endpoint = `http://127.0.0.1:${server.address().port}/internal/audit/events`;
          const send = createLocalAuditHttpTransport({ endpoint, key });
          assert.equal(
            (await deliverAuditOutbox(databases.auditRelay, send)).delivered,
            1,
          );
          await send(event);
          assert.equal(
            await owner.auditEvent.count({ where: { id: event.eventId } }),
            1,
          );
          assert.equal(
            (
              await owner.auditOutbox.findUniqueOrThrow({
                where: { eventId: event.eventId },
              })
            ).deliveryState,
            "delivered",
          );
        } finally {
          await new Promise((resolve) => {
            server.close(resolve);
            server.closeAllConnections();
          });
        }
      },
    );
    await t.test(
      "capture still denies spoofed personal scope and rolls back duplicate mutations",
      async () => {
        const saved = await owner.userProfile.findUniqueOrThrow({
          where: { id: profile.id },
        });
        const operation = (tx) =>
          tx.userProfile.update({
            where: { id: profile.id },
            data: { revision: { increment: 1 } },
          });
        await assert.rejects(
          withPersonalAuditTransaction(
            databases.profile,
            user.id,
            intent({ workspaceId: otherWorkspace.id }),
            operation,
          ),
        );
        const event = intent();
        await withPersonalAuditTransaction(
          databases.profile,
          user.id,
          event,
          operation,
        );
        await assert.rejects(
          withPersonalAuditTransaction(
            databases.profile,
            user.id,
            event,
            operation,
          ),
        );
        assert.equal(
          (
            await owner.userProfile.findUniqueOrThrow({
              where: { id: profile.id },
            })
          ).revision,
          saved.revision + 1,
        );
      },
    );
    await t.test(
      "INSERT-only capture withholds a protected contact result when COMMIT fails",
      async () => {
        const event = intent({
          action: "contact.viewed",
          resourceType: "contact",
          resourceId: profile.id,
          metadata: { permission: "profile.contact.read" },
        });
        await admin.query(
          `CREATE FUNCTION fail_role_capture_commit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."eventId" = '${event.eventId}'::uuid THEN RAISE EXCEPTION 'synthetic capture commit failure'; END IF; RETURN NEW; END $$`,
        );
        await admin.query(
          'CREATE CONSTRAINT TRIGGER fail_role_capture_commit AFTER INSERT ON "AuditOutbox" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fail_role_capture_commit()',
        );
        const read = () =>
          withPersonalAuditTransaction(
            databases.profile,
            user.id,
            event,
            (tx) =>
              tx.userContact.findUniqueOrThrow({
                where: { profileId: profile.id },
              }),
          );
        let released = false;
        await assert.rejects(
          read().then(() => {
            released = true;
          }),
        );
        assert.equal(released, false);
        assert.equal(
          await owner.auditOutbox.count({ where: { eventId: event.eventId } }),
          0,
        );
        await admin.query(
          'DROP TRIGGER fail_role_capture_commit ON "AuditOutbox"',
        );
        assert.equal((await read()).email, "contact@example.invalid");
      },
    );
    await t.test(
      "every runtime role denies audit history updates/deletes/truncation and administrative DDL",
      async () => {
        for (const client of Object.values(clients)) {
          for (const query of [
            'UPDATE "AuditEvent" SET "metadata" = \'{}\'',
            'DELETE FROM "AuditEvent"',
            'TRUNCATE "AuditEvent"',
            'ALTER TABLE "AuditEvent" ADD COLUMN unsafe text',
            "CREATE TABLE public.unsafe (id int)",
            "CREATE TEMP TABLE unsafe (id int)",
            "CREATE ROLE unsafe",
            `SET ROLE "${base.username}"`,
          ])
            await forbidden(client, query);
        }
        await forbidden(clients.profile, 'DELETE FROM "UserProfile"');
      },
    );
    await t.test(
      "new tables/functions are denied by default, preserving future migration boundaries",
      async () => {
        await admin.query("CREATE TABLE public.future_private (id int)");
        await admin.query(
          "CREATE FUNCTION public.future_private_function() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$",
        );
        for (const [service, client] of Object.entries(clients)) {
          await forbidden(client, "SELECT * FROM public.future_private");
          await forbidden(client, "SELECT public.future_private_function()");
          await assertRuntimeDatabaseRole(
            databases[service],
            service,
            names[service],
          );
        }
      },
    );
    await t.test(
      "column privilege drift fails startup; repeated provisioning removes it without rotating credentials",
      async () => {
        await admin.query(
          `GRANT UPDATE ("metadata") ON "AuditEvent" TO "${names.auditIngest}"`,
        );
        await admin.query(
          `GRANT SELECT ("fullName") ON "UserProfile" TO "${names.auth}"`,
        );
        await assert.rejects(
          assertRuntimeDatabaseRole(
            databases.auditIngest,
            "auditIngest",
            names.auditIngest,
          ),
        );
        await assert.rejects(
          assertRuntimeDatabaseRole(databases.auth, "auth", names.auth),
        );
        await provisionRuntimeRoles(admin, { databaseName, prefix, passwords });
        for (const service of Object.keys(names))
          await assertRuntimeDatabaseRole(
            databases[service],
            service,
            names[service],
          );
        await forbidden(
          clients.auditIngest,
          'UPDATE "AuditEvent" SET "metadata" = \'{}\'',
        );
        await forbidden(clients.auth, 'SELECT "fullName" FROM "UserProfile"');
      },
    );
    await t.test(
      "partial provisioning failure rolls back credential changes and refuses unmanaged role collisions",
      async () => {
        await assert.rejects(
          provisionRuntimeRoles(admin, {
            databaseName,
            prefix,
            passwords: {
              ...passwords,
              auth: randomBytes(32).toString("hex"),
              profile: "invalid",
            },
          }),
        );
        const checkUrl = new URL(url);
        checkUrl.username = names.auth;
        checkUrl.password = passwords.auth;
        const check = new Client({ connectionString: checkUrl.href });
        await check.connect();
        await check.end();
        const collisionPrefix = `${prefix}_collision`;
        const collision = runtimeRoleNames(collisionPrefix);
        await admin.query(`CREATE ROLE "${collision.auth}" NOLOGIN`);
        try {
          await assert.rejects(
            provisionRuntimeRoles(admin, {
              databaseName,
              prefix: collisionPrefix,
              passwords,
            }),
          );
          assert.equal(
            (
              await admin.query(
                "SELECT rolcanlogin FROM pg_roles WHERE rolname = $1",
                [collision.auth],
              )
            ).rows[0].rolcanlogin,
            false,
          );
        } finally {
          await admin.query(`DROP ROLE "${collision.auth}"`);
        }
      },
    );
    await t.test(
      "scheduled passes preserve retry/leases across worker restart without replaying domain work",
      async () => {
        const events = Array.from({ length: 7 }, () => intent());
        for (const event of events)
          await withPersonalAuditTransaction(
            databases.profile,
            user.id,
            event,
            (tx) =>
              tx.userProfile.update({
                where: { id: profile.id },
                data: { revision: { increment: 1 } },
              }),
          );
        const revision = (
          await owner.userProfile.findUniqueOrThrow({
            where: { id: profile.id },
          })
        ).revision;
        const key = randomBytes(32).toString("hex");
        const app = createWorkspaceAuditApp({
          db: databases.auditIngest,
          relayKey: key,
        });
        let loseReply = true;
        const server = serve({
          hostname: "127.0.0.1",
          port: 0,
          fetch: async (request) => {
            const response = await app.fetch(request);
            if (loseReply && response.status === 200) {
              loseReply = false;
              return new Response("synthetic lost acknowledgement");
            }
            return response;
          },
        });
        await once(server, "listening");
        try {
          const send = createLocalAuditHttpTransport({
            endpoint: `http://127.0.0.1:${server.address().port}/internal/audit/events`,
            key,
          });
          let time = Date.now() + 86400000;
          const now = () => new Date(time);
          const options = { batchSize: 5, leaseMs: 120000, now };
          const stop = new AbortController();
          let first;
          await runAuditRelayWorker(
            () => deliverAuditOutbox(databases.auditRelay, send, options),
            {
              signal: stop.signal,
              onBatch: (result) => {
                first = result;
                stop.abort();
              },
              wait: async () => assert.fail("No new poll after stop"),
            },
          );
          assert.equal(first.claimed, 5);
          assert.equal(first.retried, 1);
          const crashed = await owner.auditOutbox.findFirstOrThrow({
            where: { deliveryState: "pending", attempts: 0 },
          });
          await owner.auditOutbox.update({
            where: { id: crashed.id },
            data: {
              deliveryState: "delivering",
              leaseToken: randomUUID(),
              leaseExpiresAt: new Date(time + 3000),
              attempts: 1,
            },
          });
          const retry = new AbortController();
          const counts = [];
          await runAuditRelayWorker(
            async () => {
              const result = await deliverAuditOutbox(
                databases.auditRelay,
                send,
                options,
              );
              counts.push(result.claimed);
              if (counts.length > 5) {
                retry.abort();
                assert.fail("Worker must recover within bounded passes");
              }
              const remaining = await owner.auditOutbox.count({
                where: { deliveryState: { in: ["pending", "delivering"] } },
              });
              if (remaining === 0) retry.abort();
              return result;
            },
            {
              signal: retry.signal,
              wait: async (ms) => {
                time += ms;
              },
            },
          );
          assert.ok(counts.every((count) => count <= 5));
          assert.equal(counts.length, 2);
          assert.equal(
            await owner.auditEvent.count({
              where: { id: { in: events.map((event) => event.eventId) } },
            }),
            events.length,
          );
          assert.equal(
            await owner.auditOutbox.count({
              where: { deliveryState: { in: ["pending", "delivering"] } },
            }),
            0,
          );
          assert.equal(
            (
              await owner.userProfile.findUniqueOrThrow({
                where: { id: profile.id },
              })
            ).revision,
            revision,
          );
          assert.equal(
            (
              await owner.auditOutbox.findUniqueOrThrow({
                where: { id: crashed.id },
              })
            ).attempts,
            2,
          );
        } finally {
          await new Promise((resolve) => {
            server.close(resolve);
            server.closeAllConnections();
          });
        }
      },
    );
    await t.test(
      "worker database deadlines cancel slow SQL and leave the connection usable",
      async () => {
        const runtime = new URL(url);
        runtime.username = names.auditRelay;
        runtime.password = passwords.auditRelay;
        const timed = createDatabaseClient(runtime.href, { timeoutMs: 250 });
        try {
          await timed.$queryRaw`SELECT 1 AS ready`;
          const settings = await timed.$queryRaw`SHOW statement_timeout`;
          assert.equal(settings[0].statement_timeout, "250ms");
          await assert.rejects(timed.$queryRaw`SELECT 1 FROM pg_sleep(1)`);
          assert.deepEqual(await timed.$queryRaw`SELECT 1 AS healthy`, [
            { healthy: 1 },
          ]);
        } finally {
          await timed.$disconnect();
        }
      },
    );
  } finally {
    await Promise.all([
      ...Object.values(databases).map((db) => db.$disconnect()),
      owner.$disconnect(),
      ...Object.values(clients).map((client) => client.end()),
    ]);
    await admin.end();
    await lifecycle.query(
      `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`,
    );
    for (const name of Object.values(names))
      await lifecycle.query(`DROP ROLE IF EXISTS "${name}"`);
    await lifecycle.end();
  }
});
