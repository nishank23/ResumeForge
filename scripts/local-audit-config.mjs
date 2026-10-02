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
  const url = new URL(database[variable]);
  if (
    url.protocol !== "postgresql:" ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "55432" ||
    url.pathname !== "/resume_forge_dev" ||
    url.username !==
      (service === "auditRelay"
        ? "rf_local_audit_relay"
        : "rf_local_audit_ingest") ||
    !/^[0-9a-f]{64}$/.test(url.password) ||
    url.search ||
    url.hash ||
    !/^[0-9a-f]{64}$/.test(transport.LOCAL_AUDIT_RELAY_KEY ?? "")
  )
    throw new Error("Invalid local audit configuration");
  return {
    databaseUrl: url.href,
    key: transport.LOCAL_AUDIT_RELAY_KEY,
    endpoint: "http://127.0.0.1:4005/internal/audit/events",
  };
}
