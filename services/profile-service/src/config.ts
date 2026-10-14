import { managedRuntimeDatabaseUrl } from "@resume-forge/prisma-client";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  localProfileServiceKeySchema,
  runtimeAppOrigin,
} from "@resume-forge/access-policy/server";

export function loadProfileConfig() {
  try {
    const appOrigin = runtimeAppOrigin();
    const localRoot = process.env.RESUME_FORGE_LOCAL_ROOT
      ? pathToFileURL(`${resolve(process.env.RESUME_FORGE_LOCAL_ROOT)}/`)
      : new URL("../../../", import.meta.url);
    const database = parseEnv(
      readFileSync(new URL(".local/runtime-database.env", localRoot), "utf8"),
    );
    const auth = parseEnv(
      readFileSync(new URL(".local/auth-transport.env", localRoot), "utf8"),
    );
    const databaseUrl = managedRuntimeDatabaseUrl(
      database.PROFILE_DATABASE_URL ?? "",
      "profile",
    );
    return {
      databaseUrl,
      appOrigin,
      key: localProfileServiceKeySchema.parse(auth.LOCAL_PROFILE_SERVICE_KEY),
      endpoint: "http://127.0.0.1:4001/internal/auth/resolve",
    };
  } catch {
    throw new Error(
      "Local profile configuration unavailable. Run db:runtime:init and auth:local:init.",
    );
  }
}
