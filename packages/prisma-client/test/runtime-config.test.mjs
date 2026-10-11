import test from "node:test";
import assert from "node:assert/strict";
import { managedRuntimeDatabaseUrl, runtimeRoleNames } from "../dist/index.js";

const password = "a".repeat(64);
const native = (role) =>
  `postgresql://${role}:${password}@127.0.0.1:55432/resume_forge_dev`;
const docker = (role) =>
  `postgresql://${role}:${password}@database:5432/resume_forge_dev`;
test("all five restricted roles work in their managed native and Docker modes", () => {
  for (const [service, role] of Object.entries(runtimeRoleNames())) {
    assert.equal(
      managedRuntimeDatabaseUrl(native(role), service, "native"),
      native(role),
    );
    assert.equal(
      managedRuntimeDatabaseUrl(docker(role), service, "docker"),
      docker(role),
    );
    assert.throws(() =>
      managedRuntimeDatabaseUrl(docker(role), service, "native"),
    );
    assert.throws(() =>
      managedRuntimeDatabaseUrl(native(role), service, "docker"),
    );
  }
});
test("reject administrator, wrong role, hosted destinations and URL overrides", () => {
  for (const mode of ["native", "docker"]) {
    const valid = new URL(
      (mode === "native" ? native : docker)("rf_local_resume"),
    );
    for (const [key, value] of [
      ["username", "resume_forge"],
      ["username", "rf_local_auth"],
      ["hostname", "example.invalid"],
      ["port", "5433"],
      ["pathname", "/postgres"],
      ["password", "weak"],
      ["search", "?options=-c%20role=resume_forge"],
      ["hash", "#private"],
    ]) {
      const url = new URL(valid);
      url[key] = value;
      assert.throws(() => managedRuntimeDatabaseUrl(url.href, "resume", mode));
    }
    assert.throws(() =>
      managedRuntimeDatabaseUrl(
        valid.href.replace("postgresql:", "http:"),
        "resume",
        mode,
      ),
    );
  }
  assert.throws(() =>
    managedRuntimeDatabaseUrl(native("rf_local_resume"), "resume", "hosted"),
  );
});
