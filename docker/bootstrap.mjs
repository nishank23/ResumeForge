import { spawnSync } from "node:child_process";
import { readAdmin, readRuntime } from "./config.mjs";
import { Client, provisionRuntimeRoles } from "../scripts/runtime-roles.mjs";
import {
  createDatabaseClient,
  assertRuntimeDatabaseRole,
} from "../packages/prisma-client/dist/index.js";

let stage = "configuration";
let admin;
try {
  const url = readAdmin();
  const runtime = readRuntime();
  stage = "database connection";
  admin = new Client({
    connectionString: url.href,
    connectionTimeoutMillis: 10000,
  });
  await admin.connect();
  stage = "migrations";
  const migrate = spawnSync(
    "pnpm",
    ["--filter", "@resume-forge/prisma-client", "migrate"],
    {
      cwd: "/app",
      env: { ...process.env, DATABASE_URL: url.href },
      encoding: "utf8",
      timeout: 120000,
    },
  );
  if (migrate.status !== 0) {
    // Prisma diagnostics may contain a connection URL. Emit only a bounded code.
    const code = /\bP[0-9]{4}\b/.exec(
      (migrate.stdout ?? "") + (migrate.stderr ?? ""),
    )?.[0];
    throw Object.assign(new Error("Migration failed"), { code });
  }
  console.log("Docker migrations applied.");
  stage = "restricted runtime roles";
  await provisionRuntimeRoles(admin, {
    databaseName: "resume_forge_dev",
    passwords: Object.fromEntries(
      Object.entries(runtime).map(([service, connection]) => [
        service,
        connection.password,
      ]),
    ),
  });
  stage = "runtime role verification";
  for (const [service, connection] of Object.entries(runtime)) {
    const db = createDatabaseClient(connection.href, { timeoutMs: 5000 });
    try {
      await assertRuntimeDatabaseRole(db, service);
    } finally {
      await db.$disconnect();
    }
  }
  console.log(
    "Docker database bootstrap complete; all five restricted roles verified.",
  );
} catch (error) {
  const code = /^(P[0-9]{4}|[0-9A-Z]{5})$/.test(error?.code ?? "")
    ? ` (${error.code})`
    : "";
  console.error(
    `Docker bootstrap failed at ${stage}${code}. Check database health and retained credential volumes. No secrets were printed.`,
  );
  process.exitCode = 1;
} finally {
  await admin?.end();
}
