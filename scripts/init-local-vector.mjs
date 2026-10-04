import { Client, vectorDatabase } from "./local-vector-config.mjs";

let client;
try {
  client = new Client({
    connectionString: vectorDatabase().href,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
  });
  await client.connect();
  await client.query("BEGIN");
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtext('resume-forge:local-vector'))",
  );
  await client.query(
    "CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public",
  );
  const {
    rows: [extension],
  } = await client.query(
    "SELECT e.extversion, n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'vector'",
  );
  if (extension.nspname !== "public")
    throw new Error("Unexpected extension schema");
  await client.query("COMMIT");
  console.log(
    `Local pgvector ${extension.extversion} ready in resume_forge_dev. No application embeddings or indexes created; D07 remains open.`,
  );
} catch {
  await client?.query("ROLLBACK").catch(() => {});
  console.error(
    "Local vector setup failed. Install pgvector for your PostgreSQL version, start the managed cluster, and retry. No credentials were printed.",
  );
  process.exitCode = 1;
} finally {
  await client?.end();
}
