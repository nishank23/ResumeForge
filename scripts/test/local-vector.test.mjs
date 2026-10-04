import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client, vectorDatabase } from "../local-vector-config.mjs";

test("local pgvector capability in an isolated disposable database", async (t) => {
  const base = vectorDatabase();
  const database = `rf_vector_test_${randomUUID().replaceAll("-", "")}`;
  const adminUrl = new URL(base);
  adminUrl.pathname = "/postgres";
  const testUrl = new URL(base);
  testUrl.pathname = `/${database}`;
  const admin = new Client({ connectionString: adminUrl.href });
  const client = new Client({ connectionString: testUrl.href });
  let created = false;
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${database}"`);
    created = true;
    await client.connect();
    await client.query("CREATE EXTENSION vector WITH SCHEMA public");
    await client.query(
      "CREATE TABLE synthetic_vectors (id text PRIMARY KEY, scope text NOT NULL, embedding vector(3) NOT NULL)",
    );
    await client.query(
      "INSERT INTO synthetic_vectors VALUES ($1, $2, $3::vector), ($4, $5, $6::vector), ($7, $8, $9::vector)",
      [
        "allowed-near",
        "a",
        "[1,0,0]",
        "allowed-far",
        "a",
        "[0,1,0]",
        "other-scope",
        "b",
        "[1,0,0]",
      ],
    );
    await t.test("extension is installed and setup is repeatable", async () => {
      await client.query(
        "CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public",
      );
      assert.match(
        (
          await client.query(
            "SELECT extversion FROM pg_extension WHERE extname = 'vector'",
          )
        ).rows[0].extversion,
        /^\d+\.\d+\.\d+$/,
      );
    });
    await t.test(
      "parameterized exact L2 and cosine search retain explicit SQL scope",
      async () => {
        for (const operator of ["<->", "<=>"]) {
          const { rows } = await client.query(
            `SELECT id, embedding ${operator} $1::vector AS distance FROM synthetic_vectors WHERE scope = $2 ORDER BY distance, id`,
            ["[1,0,0]", "a"],
          );
          assert.deepEqual(
            rows.map((row) => row.id),
            ["allowed-near", "allowed-far"],
          );
          assert.equal(rows[0].distance, 0);
          assert.ok(rows[1].distance > 0);
        }
      },
    );
    await t.test("dimension mismatches are rejected", async () => {
      await assert.rejects(
        client.query(
          "INSERT INTO synthetic_vectors VALUES ($1, $2, $3::vector)",
          ["invalid", "a", "[1,2]"],
        ),
        { code: "22000" },
      );
      assert.equal(
        (
          await client.query(
            "SELECT count(*)::int AS count FROM synthetic_vectors",
          )
        ).rows[0].count,
        3,
      );
    });
    await t.test("invalid vector values are rejected", async () => {
      await assert.rejects(client.query("SELECT $1::vector", ["[NaN,0,0]"]), {
        code: "22000",
      });
    });
    await t.test("rollback is visible from a fresh connection", async () => {
      await client.query("BEGIN");
      await client.query("DELETE FROM synthetic_vectors WHERE scope = $1", [
        "a",
      ]);
      await client.query("ROLLBACK");
      const observer = new Client({ connectionString: testUrl.href });
      await observer.connect();
      try {
        assert.equal(
          (
            await observer.query(
              "SELECT count(*)::int AS count FROM synthetic_vectors WHERE scope = $1",
              ["a"],
            )
          ).rows[0].count,
          2,
        );
      } finally {
        await observer.end();
      }
    });
  } finally {
    await client.end();
    if (created) await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
    await admin.end();
  }
});
