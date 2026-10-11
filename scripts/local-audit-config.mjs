import { managedRuntimeDatabaseUrl } from "../packages/prisma-client/dist/index.js";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

// Deliberately ignore process/root .env database overrides and hosted endpoints.
export function loadLocalAuditConfig(service = "auditRelay") {
  if (process.env.NODE_ENV === "production")
    throw new Error("Local audit transport is not approved for production");
  const database = parseEnv(
    readFileSync(
      new URL("../.local/runtime-database.env", import.meta.url),
      "utf8",
    ),
  );
  const transport = parseEnv(
    readFileSync(
      new URL("../.local/audit-transport.env", import.meta.url),
      "utf8",
    ),
  );
  const variable =
    service === "auditRelay"
      ? "AUDIT_RELAY_DATABASE_URL"
      : service === "auditIngest"
        ? "AUDIT_INGEST_DATABASE_URL"
        : undefined;
  if (!variable) throw new Error("Invalid local audit database service");
  const databaseUrl = managedRuntimeDatabaseUrl(database[variable], service);
  if (!/^[0-9a-f]{64}$/.test(transport.LOCAL_AUDIT_RELAY_KEY ?? ""))
    throw new Error("Invalid local audit configuration");
  return {
    databaseUrl,
    key: transport.LOCAL_AUDIT_RELAY_KEY,
    endpoint: "http://127.0.0.1:4005/internal/audit/events",
  };
}
