import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deriveAtsServiceKey, loadAtsConfig } from "../dist/config.js";
import { key } from "./fixtures.mjs";
test("derives separate credential from managed auth key without writing configuration", () => {
  assert.equal(
    deriveAtsServiceKey(key),
    createHmac("sha256", key).update("ats-service-v1").digest("hex"),
  );
  assert.notEqual(deriveAtsServiceKey(key), key);
  assert.throws(() => deriveAtsServiceKey("short"));
});
test("loads existing private settings, environment wins, loopback defaults", () => {
  const root = mkdtempSync(join(tmpdir(), "ats-config-"));
  try {
    mkdirSync(join(root, ".local"));
    writeFileSync(
      join(root, ".env"),
      "GEMINI_API_KEY=synthetic-base\nGEMINI_DATA_MODE=paid\n",
    );
    writeFileSync(
      join(root, ".local/ai-provider.env"),
      "GEMINI_API_KEY=synthetic-override\n",
    );
    writeFileSync(
      join(root, ".local/auth-transport.env"),
      `LOCAL_PROFILE_SERVICE_KEY=${key}\n`,
    );
    const config = loadAtsConfig({ RESUME_FORGE_LOCAL_ROOT: root });
    assert.equal(config.host, "127.0.0.1");
    assert.equal(config.port, 4004);
    assert.equal(config.timeoutMs, 45000);
    assert.equal(config.geminiKey, "synthetic-override");
    assert.equal(config.paidGemini, true);
    assert.equal(config.key, deriveAtsServiceKey(key));
    const explicit = loadAtsConfig({
      RESUME_FORGE_LOCAL_ROOT: root,
      ATS_SERVICE_KEY: key,
      GEMINI_API_KEY: "synthetic-env",
      ATS_SERVICE_HOST: "0.0.0.0",
    });
    assert.equal(explicit.key, key);
    assert.equal(explicit.geminiKey, "synthetic-env");
    assert.equal(explicit.host, "0.0.0.0");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test("invalid host/port/timeout or missing credentials fail closed", () => {
  const root = mkdtempSync(join(tmpdir(), "ats-invalid-config-"));
  try {
    for (const extra of [
      {},
      { ATS_SERVICE_KEY: "short" },
      { ATS_SERVICE_KEY: key, ATS_SERVICE_HOST: "example.com" },
      { ATS_SERVICE_KEY: key, ATS_SERVICE_HOST: "::1" },
      { ATS_SERVICE_KEY: key, ATS_SERVICE_PORT: "0" },
      { ATS_SERVICE_KEY: key, ATS_SERVICE_TIMEOUT_MS: "60001" },
    ])
      assert.throws(() =>
        loadAtsConfig({ RESUME_FORGE_LOCAL_ROOT: root, ...extra }),
      );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
