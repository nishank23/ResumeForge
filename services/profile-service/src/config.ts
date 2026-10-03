import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { localProfileServiceKeySchema } from "@resume-forge/access-policy/server";

export function loadProfileConfig() {
  try {
    if (process.env.NODE_ENV === "production") throw new Error();
    const database = parseEnv(
      readFileSync(
        new URL("../../../.local/runtime-database.env", import.meta.url),
        "utf8",
      ),
    );
    const auth = parseEnv(
      readFileSync(
        new URL("../../../.local/auth-transport.env", import.meta.url),
        "utf8",
      ),
    );
    const url = new URL(database.PROFILE_DATABASE_URL ?? "");
    if (
      url.protocol !== "postgresql:" ||
      url.hostname !== "127.0.0.1" ||
      url.port !== "55432" ||
      url.pathname !== "/resume_forge_dev" ||
      url.username !== "rf_local_profile" ||
      !/^[a-f0-9]{64}$/.test(url.password) ||
      url.search ||
      url.hash
    )
      throw new Error();
    return {
      databaseUrl: url.href,
      key: localProfileServiceKeySchema.parse(auth.LOCAL_PROFILE_SERVICE_KEY),
      endpoint: "http://127.0.0.1:4001/internal/auth/resolve",
    };
  } catch {
    throw new Error(
      "Local profile configuration unavailable. Run db:runtime:init and auth:local:init.",
    );
  }
}
