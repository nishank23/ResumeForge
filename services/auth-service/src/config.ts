import { managedRuntimeDatabaseUrl } from "@resume-forge/prisma-client";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import {
  localProfileServiceKeySchema,
  runtimeAppOrigin,
} from "@resume-forge/access-policy/server";

const localRoot = process.env.RESUME_FORGE_LOCAL_ROOT
  ? pathToFileURL(`${resolve(process.env.RESUME_FORGE_LOCAL_ROOT)}/`)
  : new URL("../../../", import.meta.url);
for (const file of [".env"]) {
  const url = new URL(file, localRoot);
  if (existsSync(url)) process.loadEnvFile(url);
}
const schema = z.object({
  DATABASE_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  AUTH_SERVICE_PORT: z.coerce.number().int().min(1).max(65535).default(4001),
});
export function loadConfig() {
  const appOrigin = runtimeAppOrigin();
  let databaseUrl: string;
  try {
    const local = parseEnv(
      readFileSync(new URL(".local/runtime-database.env", localRoot), "utf8"),
    );
    databaseUrl = managedRuntimeDatabaseUrl(
      local.AUTH_DATABASE_URL ?? "",
      "auth",
    );
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
  const file = new URL(".local/auth-transport.env", localRoot);
  let profileServiceKey: string | undefined;
  if (existsSync(file)) {
    try {
      const parsed = localProfileServiceKeySchema.safeParse(
        parseEnv(readFileSync(file, "utf8")).LOCAL_PROFILE_SERVICE_KEY,
      );
      if (!parsed.success) throw new Error();
      profileServiceKey = parsed.data;
    } catch {
      throw new Error(
        "Invalid local auth service credential. Check .local/auth-transport.env.",
      );
    }
  }
  return { ...result.data, profileServiceKey, appOrigin };
}
