import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { taskStatus, startTask, finishTask } from "../development-task.mjs";

const initial = `# Preserved project\n\n<!-- BEGIN:CURRENT_TASK -->\n\`\`\`json\n${JSON.stringify({ status: "idle", task: null, owner: null, lastResult: "Earlier work preserved" })}\n\`\`\`\n<!-- END:CURRENT_TASK -->\n\nUser documentation stays here.\n`;
function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), "rf-development-task-"));
  writeFileSync(path.join(directory, "README.md"), initial);
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test("claim, competing claim and owner-only completion preserve surrounding documentation", (t) => {
  const directory = fixture(t);
  const owner = startTask("Synthetic task", directory);
  assert.ok(owner);
  assert.equal(taskStatus(directory).status, "ongoing");
  assert.equal(startTask("Competing task", directory), null);
  assert.throws(() => finishTask("wrong-owner", "Not authorized", directory));
  assert.equal(taskStatus(directory).owner, owner);
  finishTask(owner, "Verified synthetic task", directory);
  assert.equal(taskStatus(directory).status, "idle");
  assert.equal(taskStatus(directory).lastResult, "Verified synthetic task");
  const document = readFileSync(path.join(directory, "README.md"), "utf8");
  assert.ok(document.startsWith("# Preserved project\n\n"));
  assert.ok(document.endsWith("\n\nUser documentation stays here.\n"));
  assert.throws(() => finishTask(owner, "Duplicate completion", directory));
  assert.ok(startTask("Next task", directory));
});

test("an orphaned lock blocks new work without overwriting README", (t) => {
  const directory = fixture(t);
  mkdirSync(path.join(directory, ".local/development-task.lock"), {
    recursive: true,
  });
  assert.equal(taskStatus(directory).status, "ongoing");
  assert.equal(startTask("Must wait", directory), null);
  assert.equal(
    readFileSync(path.join(directory, "README.md"), "utf8"),
    initial,
  );
});

test("ongoing README remains busy even if its lock is missing", (t) => {
  const directory = fixture(t);
  writeFileSync(
    path.join(directory, "README.md"),
    initial
      .replace('"idle"', '"ongoing"')
      .replace('"task":null', '"task":"Prior task"')
      .replace('"owner":null', '"owner":"prior-run"'),
  );
  assert.equal(startTask("Must wait", directory), null);
});

test("missing, malformed or ambiguous task markers fail closed", (t) => {
  const directory = fixture(t);
  for (const document of [
    "No marker",
    initial.replace('"idle"', '"invalid"'),
    initial.replace('"owner":null', '"owner":"inconsistent-owner"'),
    initial + "<!-- BEGIN:CURRENT_TASK -->",
    initial + "<!-- END:CURRENT_TASK -->",
  ]) {
    writeFileSync(path.join(directory, "README.md"), document);
    assert.throws(() => startTask("Must not start", directory));
    assert.equal(
      readFileSync(path.join(directory, "README.md"), "utf8"),
      document,
    );
  }
});

test("invalid task descriptions do not acquire ownership", (t) => {
  const directory = fixture(t);
  for (const title of ["", "multiline\nnote", "x".repeat(241)])
    assert.throws(() => startTask(title, directory));
  assert.equal(taskStatus(directory).status, "idle");
});

test("simultaneous processes elect exactly one task owner", async (t) => {
  const directory = fixture(t);
  mkdirSync(path.join(directory, "scripts"));
  copyFileSync(
    new URL("../development-task.mjs", import.meta.url),
    path.join(directory, "scripts/development-task.mjs"),
  );
  const claim = () =>
    new Promise((resolve, reject) => {
      const child = spawn(
        globalThis.process.execPath,
        ["scripts/development-task.mjs", "start", "Concurrent task"],
        { cwd: directory, stdio: "ignore" },
      );
      child.on("error", reject);
      child.on("close", resolve);
    });
  assert.deepEqual((await Promise.all([claim(), claim()])).sort(), [0, 2]);
  assert.equal(taskStatus(directory).status, "ongoing");
  const owner = taskStatus(directory).owner;
  const finish = () =>
    new Promise((resolve, reject) => {
      const child = spawn(
        globalThis.process.execPath,
        [
          "scripts/development-task.mjs",
          "finish",
          owner,
          "Concurrent completion verified",
        ],
        { cwd: directory, stdio: "ignore" },
      );
      child.on("error", reject);
      child.on("close", resolve);
    });
  assert.deepEqual((await Promise.all([finish(), finish()])).sort(), [0, 1]);
  assert.equal(taskStatus(directory).status, "idle");
  assert.ok(startTask("Next owner remains protected", directory));
});
