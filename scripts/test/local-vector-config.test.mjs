import test from "node:test";
import assert from "node:assert/strict";
import { validateVectorDatabase } from "../local-vector-config.mjs";

const local = `postgresql://resume_forge:${"a".repeat(64)}@127.0.0.1:55432/resume_forge_dev`;
test("only managed local admin database is accepted", () => {
  assert.equal(
    validateVectorDatabase(local, "development").hostname,
    "127.0.0.1",
  );
  for (const candidate of [
    local.replace("127.0.0.1", "hosted.example.invalid"),
    local.replace("55432", "5432"),
    local.replace("resume_forge_dev", "postgres"),
    local.replace("resume_forge:", "runtime:"),
    local + "?sslmode=require",
    local + "#fragment",
    local.replace("postgresql:", "https:"),
    local.replace("a".repeat(64), "short"),
  ])
    assert.throws(() => validateVectorDatabase(candidate, "development"));
  assert.throws(() => validateVectorDatabase(local, "production"));
  assert.throws(
    () => validateVectorDatabase("malformed-private-value", "development"),
    (error) =>
      !error.message.includes("malformed-private-value") &&
      error.cause === undefined,
  );
});
