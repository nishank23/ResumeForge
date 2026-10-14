import { runtimeRoleNames, type RuntimeService } from "./runtime-access.js";

/** Managed native development and container installations; arbitrary hosted URLs remain refused. */
export function managedRuntimeDatabaseUrl(
  value: string,
  service: RuntimeService,
  mode = process.env.RESUME_FORGE_RUNTIME,
): string {
  const cloud = mode === "cloud";
  if (process.env.NODE_ENV === "production" && !cloud)
    throw new Error("Local runtime is not approved for production.");
  if (cloud && process.env.NODE_ENV !== "production")
    throw new Error("Cloud runtime requires production mode.");
  if (mode !== undefined && mode !== "native" && mode !== "docker" && !cloud)
    throw new Error("Invalid local runtime mode.");
  const url = new URL(value);
  const docker = mode === "docker" || cloud;
  if (
    url.protocol !== "postgresql:" ||
    url.hostname !== (docker ? "database" : "127.0.0.1") ||
    url.port !== (docker ? "5432" : "55432") ||
    url.pathname !== "/resume_forge_dev" ||
    url.username !== runtimeRoleNames()[service] ||
    !/^[a-f0-9]{64}$/.test(url.password) ||
    url.search ||
    url.hash
  )
    throw new Error("Invalid restricted local database configuration.");
  return url.href;
}
