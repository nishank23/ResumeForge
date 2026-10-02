import { readFileSync, existsSync, writeFileSync, chmodSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomBytes } from "node:crypto";
import { runtimeRoleNames } from "../packages/prisma-client/dist/index.js";
import { Client, provisionRuntimeRoles } from "./runtime-roles.mjs";

let admin;
try {
  if (process.env.NODE_ENV === "production") throw new Error();
  const url = new URL(
    parseEnv(
      readFileSync(new URL("../.local/database.env", import.meta.url), "utf8"),
    ).DATABASE_URL,
  );
  if (
    url.protocol !== "postgresql:" ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "55432" ||
    url.pathname !== "/resume_forge_dev" ||
    url.username !== "resume_forge" ||
    url.search ||
    url.hash
  )
    throw new Error();
  const file = new URL("../.local/runtime-database.env", import.meta.url);
  const names = runtimeRoleNames();
  const variables = {
    auth: "AUTH_DATABASE_URL",
    profile: "PROFILE_DATABASE_URL",
    auditRelay: "AUDIT_RELAY_DATABASE_URL",
    auditIngest: "AUDIT_INGEST_DATABASE_URL",
  };
  if (!existsSync(file)) {
    const text = Object.entries(variables)
      .map(([service, variable]) => {
        const runtimeUrl = new URL(url);
        runtimeUrl.username = names[service];
        runtimeUrl.password = randomBytes(32).toString("hex");
        return `${variable}=${runtimeUrl.href}\n`;
      })
      .join("");
    // Persist first so a failed/rolled-back setup can be retried with the same keys.
    writeFileSync(file, text, { flag: "wx", mode: 0o600 });
  }
  chmodSync(file, 0o600);
  const env = parseEnv(readFileSync(file, "utf8"));
  const passwords = {};
  for (const [service, variable] of Object.entries(variables)) {
    const runtime = new URL(env[variable]);
    if (
      runtime.protocol !== url.protocol ||
      runtime.host !== url.host ||
      runtime.pathname !== url.pathname ||
      runtime.username !== names[service] ||
      !/^[0-9a-f]{64}$/.test(runtime.password) ||
      runtime.search ||
      runtime.hash
    )
      throw new Error();
    passwords[service] = runtime.password;
  }
  admin = new Client({ connectionString: url.href });
  await admin.connect();
  await provisionRuntimeRoles(admin, {
    databaseName: "resume_forge_dev",
    passwords,
  });
  console.log(
    "Restricted local database roles ready. Runtime credentials: ignored .local/runtime-database.env (mode 0600). Restart local services.",
  );
} catch {
  console.error(
    "Runtime database role setup failed. Check local migrations and managed configuration; no credentials were printed. Retry after fixing setup.",
  );
  process.exitCode = 1;
} finally {
  await admin?.end();
}
