import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { z } from "zod";

for (const file of ["../../../.env"]) {
  const url = new URL(file, import.meta.url);
  if (existsSync(url)) process.loadEnvFile(url);
}
const schema = z.object({
  DATABASE_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  AUTH_SERVICE_PORT: z.coerce.number().int().min(1).max(65535).default(4001),
});
export function loadConfig() {
  let databaseUrl: string;
  try {
    const local = parseEnv(
      readFileSync(
        new URL("../../../.local/runtime-database.env", import.meta.url),
        "utf8",
      ),
    );
    const url = new URL(local.AUTH_DATABASE_URL ?? "");
    if (
      url.protocol !== "postgresql:" ||
      url.hostname !== "127.0.0.1" ||
      url.port !== "55432" ||
      url.pathname !== "/resume_forge_dev" ||
      url.username !== "rf_local_auth" ||
      !/^[0-9a-f]{64}$/.test(url.password) ||
      url.search ||
      url.hash
    )
      throw new Error();
    databaseUrl = url.href;
  } catch {
    throw new Error(
      "Missing or invalid restricted auth database configuration. Run pnpm db:runtime:init.",
    );
  }
  const result = schema.safeParse({
    ...process.env,
    DATABASE_URL: databaseUrl,
  });
  if (!result.success)
    throw new Error(
      "Invalid auth configuration. Check database and OAuth settings; see docs/google-login.md.",
    );
  if (process.env.NODE_ENV === "production")
    throw new Error("Local auth is not approved for production deployment.");
  return result.data;
}
