import { createDatabaseClient } from "../packages/prisma-client/dist/index.js";
import { readRuntime } from "./config.mjs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export const checks = [
  [3000, "/", 200],
  [3001, "/remoteEntry.js", 200],
  [3002, "/remoteEntry.js", 200],
  [3003, "/remoteEntry.js", 200],
  [4000, "/api/v1/health", 200],
  [4001, "/api/v1/auth/me", 401],
  [4002, "/api/v1/profile", 401],
  [4003, "/api/v1/resume", 401],
];
export async function checkApp(host = "127.0.0.1") {
  const db = createDatabaseClient(readRuntime().resume.href, {
    timeoutMs: 3000,
  });
  try {
    await db.$queryRaw`SELECT 1`;
  } finally {
    await db.$disconnect();
  }
  await Promise.all(
    checks.map(async ([port, path, expected]) => {
      const response = await fetch(`http://${host}:${port}${path}`, {
        signal: AbortSignal.timeout(3000),
        redirect: "error",
      });
      await response.body?.cancel();
      if (response.status !== expected) throw new Error("App is not ready.");
    }),
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    await checkApp();
  } catch {
    process.exitCode = 1;
  }
}
