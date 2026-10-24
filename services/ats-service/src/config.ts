import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { ATS_PROVIDER_TIMEOUT_MS } from "./gemini.js";
export function deriveAtsServiceKey(authKey: string): string {
  if (authKey.length < 32)
    throw new Error("Internal ATS credentials are unavailable.");
  return createHmac("sha256", authKey).update("ats-service-v1").digest("hex");
}
/** Reads existing private configuration; creates no files and exposes no credential values. */
export function loadAtsConfig(
  environment: Record<string, string | undefined> = process.env,
) {
  const root = environment.RESUME_FORGE_LOCAL_ROOT ?? process.cwd();
  const env: Record<string, string | undefined> = {};
  for (const name of [
    ".env",
    ".local/ai-provider.env",
    ".local/auth-transport.env",
  ]) {
    const path = resolve(root, name);
    if (existsSync(path))
      Object.assign(env, parseEnv(readFileSync(path, "utf8")));
  }
  Object.assign(env, environment);
  const key =
    env.ATS_SERVICE_KEY?.trim() ||
    deriveAtsServiceKey(env.LOCAL_PROFILE_SERVICE_KEY?.trim() ?? "");
  const host = env.ATS_SERVICE_HOST?.trim() || "127.0.0.1";
  const port = Number(env.ATS_SERVICE_PORT || 4004);
  const timeoutMs = Number(
    env.ATS_SERVICE_TIMEOUT_MS || ATS_PROVIDER_TIMEOUT_MS,
  );
  if (
    key.length < 32 ||
    !["127.0.0.1", "0.0.0.0"].includes(host) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 60_000
  )
    throw new Error("Internal ATS service configuration is invalid.");
  return {
    key,
    host,
    port,
    timeoutMs,
    geminiKey: env.GEMINI_API_KEY,
    paidGemini: env.GEMINI_DATA_MODE === "paid",
  };
}
