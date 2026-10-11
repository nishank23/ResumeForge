import { randomBytes, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  chmodSync,
  chownSync,
  rmSync,
} from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve, join } from "node:path";
import { parseEnv } from "node:util";
import {
  adminUrl,
  readRuntime,
  roles,
  variables,
  secretPattern,
} from "./config.mjs";

const secret = () => randomBytes(32).toString("hex");
function writePrivate(file, text) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, text, { mode: 0o600, flag: "wx" });
    renameSync(temporary, file);
  } finally {
    rmSync(temporary, { force: true });
  }
}

/** Persist credentials once; retries retain passwords rather than rotating roles. */
export function prepareCredentials(
  adminDirectory,
  runtimeDirectory,
  setOwnership = true,
) {
  mkdirSync(adminDirectory, { recursive: true });
  mkdirSync(runtimeDirectory, { recursive: true });
  chmodSync(adminDirectory, 0o755);
  chmodSync(runtimeDirectory, 0o700);
  const adminFile = join(adminDirectory, "database.env");
  const passwordFile = join(adminDirectory, "postgres-password");
  if (existsSync(adminFile)) {
    const url = adminUrl(
      parseEnv(readFileSync(adminFile, "utf8")).DATABASE_URL,
    );
    if (
      !existsSync(passwordFile) ||
      readFileSync(passwordFile, "utf8").trim() !== url.password
    )
      throw new Error(
        "Administrator volume is incomplete; restore its matching credential files.",
      );
  } else {
    if (existsSync(passwordFile))
      throw new Error(
        "Administrator volume is incomplete; restore its matching credential files.",
      );
    const password = secret();
    writePrivate(
      adminFile,
      `DATABASE_URL=postgresql://resume_forge:${password}@database:5432/resume_forge_dev\n`,
    );
    writePrivate(passwordFile, `${password}\n`);
  }
  chmodSync(adminFile, 0o600);
  chmodSync(passwordFile, 0o400);
  if (setOwnership) chownSync(passwordFile, 999, 999); // postgres in pinned bookworm image

  const runtimeFile = join(runtimeDirectory, "runtime-database.env");
  if (!existsSync(runtimeFile)) {
    writePrivate(
      runtimeFile,
      Object.entries(roles)
        .map(
          ([service, role]) =>
            `${variables[service]}=postgresql://${role}:${secret()}@database:5432/resume_forge_dev`,
        )
        .join("\n") + "\n",
    );
  }
  readRuntime(runtimeDirectory); // Existing credentials must match every restricted role.
  for (const [name, variable] of [
    ["auth-transport.env", "LOCAL_PROFILE_SERVICE_KEY"],
    ["audit-transport.env", "LOCAL_AUDIT_RELAY_KEY"],
  ]) {
    const file = join(runtimeDirectory, name);
    if (!existsSync(file)) writePrivate(file, `${variable}=${secret()}\n`);
    if (
      !secretPattern.test(parseEnv(readFileSync(file, "utf8"))[variable] ?? "")
    )
      throw new Error("Invalid retained internal service credential.");
  }
  for (const name of [
    "runtime-database.env",
    "auth-transport.env",
    "audit-transport.env",
  ]) {
    const file = join(runtimeDirectory, name);
    chmodSync(file, 0o400);
    if (setOwnership) chownSync(file, 1000, 1000);
  }
  if (setOwnership) chownSync(runtimeDirectory, 1000, 1000);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    prepareCredentials("/run/forge-admin", "/app/.local");
    console.log("Docker credentials ready; existing credentials retained.");
  } catch {
    console.error(
      "Docker credential setup failed. Restore matching credential volumes; no secrets were printed.",
    );
    process.exitCode = 1;
  }
}
