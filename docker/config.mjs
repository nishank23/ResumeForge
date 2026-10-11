import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import {
  managedRuntimeDatabaseUrl,
  runtimeRoleNames,
} from "../packages/prisma-client/dist/index.js";

export const variables = {
  auth: "AUTH_DATABASE_URL",
  profile: "PROFILE_DATABASE_URL",
  resume: "RESUME_DATABASE_URL",
  auditRelay: "AUDIT_RELAY_DATABASE_URL",
  auditIngest: "AUDIT_INGEST_DATABASE_URL",
};
export const roles = runtimeRoleNames();
export const secretPattern = /^[a-f0-9]{64}$/;

export function adminUrl(value) {
  const url = new URL(value);
  if (
    url.protocol !== "postgresql:" ||
    url.hostname !== "database" ||
    url.port !== "5432" ||
    url.pathname !== "/resume_forge_dev" ||
    url.username !== "resume_forge" ||
    !secretPattern.test(url.password) ||
    url.search ||
    url.hash
  )
    throw new Error("Invalid managed Docker administrator configuration.");
  return url;
}
export function readAdmin(directory = "/run/forge-admin") {
  return adminUrl(
    parseEnv(readFileSync(`${directory}/database.env`, "utf8")).DATABASE_URL,
  );
}
export function readRuntime(directory = "/app/.local") {
  const env = parseEnv(
    readFileSync(`${directory}/runtime-database.env`, "utf8"),
  );
  return Object.fromEntries(
    Object.entries(variables).map(([service, variable]) => [
      service,
      new URL(managedRuntimeDatabaseUrl(env[variable], service, "docker")),
    ]),
  );
}
