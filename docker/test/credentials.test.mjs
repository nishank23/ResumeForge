import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  statSync,
  chmodSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareCredentials } from "../credentials.mjs";
import { readAdmin, readRuntime } from "../config.mjs";

test("first install generates distinct credentials; repeated setup keeps every password", () => {
  const root = mkdtempSync(join(tmpdir(), "forge-docker-"));
  const admin = join(root, "admin"),
    runtime = join(root, "runtime");
  try {
    prepareCredentials(admin, runtime, false);
    const before = [
      [admin, "database.env"],
      [admin, "postgres-password"],
      [runtime, "runtime-database.env"],
      [runtime, "auth-transport.env"],
      [runtime, "audit-transport.env"],
    ].map(([directory, name]) => readFileSync(join(directory, name), "utf8"));
    const urls = readRuntime(runtime);
    const passwords = [
      readAdmin(admin).password,
      ...Object.values(urls).map((url) => url.password),
    ];
    assert.equal(new Set(passwords).size, 6);
    assert.equal(
      statSync(join(runtime, "runtime-database.env")).mode & 0o777,
      0o400,
    );
    prepareCredentials(admin, runtime, false);
    const after = [
      [admin, "database.env"],
      [admin, "postgres-password"],
      [runtime, "runtime-database.env"],
      [runtime, "auth-transport.env"],
      [runtime, "audit-transport.env"],
    ].map(([directory, name]) => readFileSync(join(directory, name), "utf8"));
    assert.deepEqual(after, before);
    chmodSync(join(admin, "postgres-password"), 0o600);
    writeFileSync(join(admin, "postgres-password"), "mismatched\n", {
      mode: 0o600,
    });
    assert.throws(
      () => prepareCredentials(admin, runtime, false),
      /incomplete/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test("retained runtime credentials cannot become admin or target a hosted database", () => {
  const root = mkdtempSync(join(tmpdir(), "forge-docker-"));
  const admin = join(root, "admin"),
    runtime = join(root, "runtime");
  try {
    prepareCredentials(admin, runtime, false);
    const file = join(runtime, "runtime-database.env");
    const original = readFileSync(file, "utf8");
    for (const bad of [
      original.replace("rf_local_resume:", "resume_forge:"),
      original.replaceAll("@database:", "@example.invalid:"),
    ]) {
      chmodSync(file, 0o600);
      writeFileSync(file, bad);
      assert.throws(() => prepareCredentials(admin, runtime, false));
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
