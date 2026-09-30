import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import pg from "pg";
import { createDatabaseClient } from "../dist/index.js";

// Always use the managed local cluster, never DATABASE_URL or a developer's data.
const local = parseEnv(
  readFileSync(
    new URL("../../../.local/database.env", import.meta.url),
    "utf8",
  ),
);
const base = new URL(local.DATABASE_URL);
assert.equal(base.hostname, "127.0.0.1");
assert.equal(base.port, "55432");
const name = `rf_test_${randomUUID().replaceAll("-", "")}`;
const restored = `${name}_restore`;
const adminUrl = new URL(base);
adminUrl.pathname = "/postgres";
const admin = new pg.Client({ connectionString: adminUrl.href });
const url = new URL(base);
url.pathname = `/${name}`;
const client = createDatabaseClient(url.href);

test("local migration, isolation, integrity, rollback and restore", async (t) => {
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    const migration = spawnSync(
      "pnpm",
      ["exec", "prisma", "migrate", "deploy"],
      {
        env: { ...process.env, DATABASE_URL: url.href },
        encoding: "utf8",
      },
    );
    assert.equal(migration.status, 0, "Fresh migration must succeed");
    const alice = await client.user.create({
      data: { email: "alice@example.invalid" },
    });
    const bob = await client.user.create({
      data: { email: "bob@example.invalid" },
    });
    const workspace = await client.workspace.create({
      data: { type: "individual", personalOwnerUserId: alice.id },
    });
    await client.workspace.create({
      data: { type: "individual", personalOwnerUserId: bob.id },
    });
    const shared = await client.workspace.create({
      data: { type: "organization" },
    });
    const profile = await client.userProfile.create({
      data: {
        userId: alice.id,
        fullName: "Synthetic Alice",
        contact: { create: { email: "contact@example.invalid" } },
      },
    });

    await t.test("one master and personal workspace per user", async () => {
      await assert.rejects(
        client.userProfile.create({
          data: { userId: alice.id, fullName: "Duplicate" },
        }),
        { code: "P2002" },
      );
      await assert.rejects(
        client.workspace.create({
          data: { type: "individual", personalOwnerUserId: alice.id },
        }),
        { code: "P2002" },
      );
      await assert.rejects(
        client.workspace.create({ data: { type: "individual" } }),
      );
      await assert.rejects(
        client.workspace.create({
          data: { type: "vendor", personalOwnerUserId: bob.id },
        }),
      );
    });
    await t.test("unique provider identity and valid parent", async () => {
      const identity = {
        provider: "google",
        providerSubject: "synthetic-subject",
        userId: alice.id,
      };
      await client.oAuthAccount.create({ data: identity });
      await assert.rejects(
        client.oAuthAccount.create({ data: { ...identity, userId: bob.id } }),
        { code: "P2002" },
      );
      await assert.rejects(
        client.userContact.create({ data: { profileId: randomUUID() } }),
        { code: "P2003" },
      );
    });
    await t.test("scoped queries and separate contacts", async () => {
      assert.equal(
        await client.workspace.findFirst({
          where: { id: workspace.id, personalOwnerUserId: bob.id },
        }),
        null,
      );
      assert.equal(
        await client.userProfile.findFirst({
          where: { id: profile.id, userId: bob.id },
        }),
        null,
      );
      assert.equal("contact" in profile, false);
    });
    await t.test(
      "only the owner can grant and revocation excludes access",
      async () => {
        await assert.rejects(
          client.profileWorkspaceGrant.create({
            data: {
              profileId: profile.id,
              workspaceId: shared.id,
              grantedByUserId: bob.id,
            },
          }),
          { code: "P2003" },
        );
        const grant = await client.profileWorkspaceGrant.create({
          data: {
            profileId: profile.id,
            workspaceId: shared.id,
            grantedByUserId: alice.id,
            canReadProfile: true,
          },
        });
        const scope = {
          id: profile.id,
          grants: {
            some: {
              workspaceId: shared.id,
              revokedAt: null,
              canReadProfile: true,
            },
          },
        };
        assert.ok(await client.userProfile.findFirst({ where: scope }));
        await client.profileWorkspaceGrant.update({
          where: { id: grant.id },
          data: { revokedAt: new Date() },
        });
        assert.equal(
          await client.userProfile.findFirst({ where: scope }),
          null,
        );
      },
    );
    await t.test("session hashes and expiration constraints", async () => {
      const session = {
        userId: alice.id,
        familyId: randomUUID(),
        refreshHash: "a".repeat(64),
        expiresAt: new Date(Date.now() + 60000),
      };
      await client.session.create({ data: session });
      await assert.rejects(client.session.create({ data: session }), {
        code: "P2002",
      });
      await assert.rejects(
        client.session.create({
          data: { ...session, refreshHash: "plaintext" },
        }),
      );
    });
    await t.test(
      "failed transaction rolls back from a separate connection",
      async () => {
        await assert.rejects(
          client.$transaction(async (tx) => {
            await tx.userProfile.update({
              where: { id: profile.id },
              data: { revision: { increment: 1 } },
            });
            await tx.userProfile.update({
              where: { id: profile.id },
              data: { revision: 0 },
            });
          }),
        );
        const observer = createDatabaseClient(url.href);
        try {
          assert.equal(
            (
              await observer.userProfile.findUniqueOrThrow({
                where: { id: profile.id },
              })
            ).revision,
            1,
          );
        } finally {
          await observer.$disconnect();
        }
      },
    );
    await t.test(
      "synthetic database backup restores into a new database",
      async () => {
        const env = {
          ...process.env,
          PGHOST: base.hostname,
          PGPORT: base.port,
          PGUSER: base.username,
          PGPASSWORD: decodeURIComponent(base.password),
        };
        const dump = spawnSync("pg_dump", ["--no-owner", "--no-acl", name], {
          env,
          encoding: "utf8",
        });
        assert.equal(dump.status, 0);
        await admin.query(`CREATE DATABASE "${restored}"`);
        const restore = spawnSync(
          "psql",
          ["-X", "-v", "ON_ERROR_STOP=1", "-d", restored],
          { env, input: dump.stdout, encoding: "utf8" },
        );
        assert.equal(restore.status, 0, "Restore must succeed");
        const restoredUrl = new URL(base);
        restoredUrl.pathname = `/${restored}`;
        const check = createDatabaseClient(restoredUrl.href);
        try {
          assert.equal(await check.user.count(), 2);
          assert.equal(await check.userContact.count(), 1);
        } finally {
          await check.$disconnect();
        }
      },
    );
  } finally {
    await client.$disconnect();
    await admin.query(`DROP DATABASE IF EXISTS "${restored}" WITH (FORCE)`);
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.end();
  }
});
