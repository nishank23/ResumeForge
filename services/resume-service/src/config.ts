import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

export function loadResumeConfig() {
  try {
    if (process.env.NODE_ENV === "production") throw new Error();
    const database = parseEnv(
      readFileSync(
        new URL("../../../.local/database.env", import.meta.url),
        "utf8",
      ),
    );
    const auth = parseEnv(
      readFileSync(
        new URL("../../../.local/auth-transport.env", import.meta.url),
        "utf8",
      ),
    );
    const url = new URL(database.DATABASE_URL ?? "");
    if (
      url.protocol !== "postgresql:" ||
      url.hostname !== "127.0.0.1" ||
      url.port !== "55432" ||
      url.pathname !== "/resume_forge_dev" ||
      url.search ||
      url.hash
    ) {
      throw new Error();
    }
    return {
      databaseUrl: url.href,
      authKey: auth.LOCAL_PROFILE_SERVICE_KEY ?? "",
      endpoint: "http://127.0.0.1:4001/internal/auth/resolve",
      port: 4003,
    };
  } catch {
    throw new Error(
      "Local resume configuration unavailable. Run db:runtime:init and auth:local:init.",
    );
  }
}
