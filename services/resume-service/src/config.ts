import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { localProfileServiceKeySchema } from "@resume-forge/access-policy/server";

export function loadResumeConfig() {
  try {
    if (process.env.NODE_ENV === "production") throw new Error();
    const localRoot = process.env.RESUME_FORGE_LOCAL_ROOT
      ? pathToFileURL(`${resolve(process.env.RESUME_FORGE_LOCAL_ROOT)}/`)
      : new URL("../../../", import.meta.url);
    const database = parseEnv(
      readFileSync(new URL(".local/runtime-database.env", localRoot), "utf8"),
    );
    const auth = parseEnv(
      readFileSync(new URL(".local/auth-transport.env", localRoot), "utf8"),
    );
    const url = new URL(database.RESUME_DATABASE_URL ?? "");
    if (
      url.protocol !== "postgresql:" ||
      url.hostname !== "127.0.0.1" ||
      url.port !== "55432" ||
      url.pathname !== "/resume_forge_dev" ||
      url.username !== "rf_local_resume" ||
      !/^[a-f0-9]{64}$/.test(url.password) ||
      url.search ||
      url.hash
    )
      throw new Error();
    return {
      databaseUrl: url.href,
      authKey: localProfileServiceKeySchema.parse(
        auth.LOCAL_PROFILE_SERVICE_KEY,
      ),
      endpoint: "http://127.0.0.1:4001/internal/auth/resolve",
      port: 4003,
    };
  } catch {
    throw new Error(
      "Local resume configuration unavailable. Run db:runtime:init and auth:local:init.",
    );
  }
}
