import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { parseEnv } from "node:util";

export const { Client } = createRequire(
  new URL("../packages/prisma-client/package.json", import.meta.url),
)("pg");

export function validateVectorDatabase(
  value,
  environment = process.env.NODE_ENV,
) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      "Vector setup requires the managed local development database.",
    );
  }
  if (
    environment === "production" ||
    url.protocol !== "postgresql:" ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "55432" ||
    url.pathname !== "/resume_forge_dev" ||
    url.username !== "resume_forge" ||
    !/^[0-9a-f]{64}$/.test(url.password) ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Vector setup requires the managed local development database.",
    );
  return url;
}

export function vectorDatabase() {
  // Never consume DATABASE_URL or root .env; those may select a hosted database.
  return validateVectorDatabase(
    parseEnv(
      readFileSync(new URL("../.local/database.env", import.meta.url), "utf8"),
    ).DATABASE_URL,
  );
}
