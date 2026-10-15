import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { spawnSync } from "node:child_process";

const script = fileURLToPath(new URL("../deploy-cloud.sh", import.meta.url));
const release = `${"a".repeat(40)}-123-1`;
const mock = `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const command = path.basename(process.argv[1]);
const mode = process.env.CASE;
fs.appendFileSync(process.env.CALLS, JSON.stringify([command, ...args]) + '\\n');
// Checksum and Docker pipeline commands overlap; only Docker owns its state.
const state = command === 'docker' ? JSON.parse(fs.readFileSync(process.env.STATE, 'utf8')) : {};
let output = '';
let code = 0;
if (command === 'flock') code = mode === 'locked' ? 1 : 0;
if (command === 'df') output = 'Filesystem 1024-blocks Used Available Capacity Mounted on\\nmock 50000000 1 ' + (mode === 'disk' ? 100 : 30000000) + ' 1% /\\n';
if (command === 'resumeforge-backup') code = mode === 'backup' ? 1 : 0;
if (command === 'curl') output = '{"status":"ok"}';
if (command === 'sha256sum') {
  const hash = data => require('node:crypto').createHash('sha256').update(data).digest('hex');
  if (args[0] === '--check') {
    const [expected, filename] = fs.readFileSync(args[1], 'utf8').trim().split(/\\s+/);
    code = hash(fs.readFileSync(filename)) === expected ? 0 : 1;
  } else output = hash(fs.readFileSync(0)) + '  -';
}
if (command === 'docker') {
  if (args[0] === 'compose') {
    const service = args.at(-1);
    if (args.includes('ps')) output = service + '-container';
    if (args.includes('up')) {
      const candidate = state[service + 'Tag'];
      if ((mode === service || mode === 'rollback') && candidate.startsWith('new')) code = 1;
      if (mode === 'rollback' && candidate.startsWith('old')) code = 1;
      if (!code) state[service] = candidate;
    }
  } else if (args[0] === 'inspect') {
    output = state[args.at(-1).split('-')[0]];
  } else if (args[0] === 'image') {
    output = args.includes('{{.Os}}/{{.Architecture}}') ? 'linux/amd64' : (args.at(-1).startsWith('forge-studio-web:') ? 'new-web' : 'new-app');
  } else if (args[0] === 'run') {
    code = mode === 'fingerprint-error' ? 1 : 0;
    output = mode === 'schema' && args.includes('old-app') ? 'old schema' : 'same schema';
  } else if (args[0] === 'tag' && args[2].endsWith(':cloud')) {
    state[args[2].startsWith('forge-studio-web:') ? 'webTag' : 'appTag'] = args[1].includes(':release-') ? (args[2].startsWith('forge-studio-web:') ? 'new-web' : 'new-app') : args[1];
  }
}
if (command === 'docker') fs.writeFileSync(process.env.STATE, JSON.stringify(state));
if (output) process.stdout.write(output + '\\n');
process.exitCode = code;
if (command === 'docker' && args[0] === 'load') process.stdin.resume();
`;

function trial(mode, id = release) {
  const root = mkdtempSync(join(tmpdir(), "forge-deploy-test-"));
  try {
    const bin = join(root, "bin");
    const bundle = join(root, "bundle");
    mkdirSync(bin);
    mkdirSync(bundle);
    for (const command of ["docker", "curl", "flock", "df", "sha256sum"])
      writeFileSync(join(bin, command), mock, { mode: 0o700 });
    for (const directory of [
      "opt/resumeforge",
      "etc/resumeforge",
      "usr/local/sbin",
    ])
      mkdirSync(join(root, directory), { recursive: true });
    writeFileSync(
      join(root, "opt/resumeforge/compose.cloud.yaml"),
      "name: resumeforge-demo\n",
    );
    writeFileSync(
      join(root, "etc/resumeforge/provider.env"),
      "GEMINI_API_KEY=PRIVATE_CANARY_DO_NOT_LOG\n",
      { mode: 0o600 },
    );
    writeFileSync(join(root, "usr/local/sbin/resumeforge-backup"), mock, {
      mode: 0o700,
    });
    const image = gzipSync(
      Buffer.from("synthetic image archive; Docker is mocked"),
    );
    writeFileSync(join(bundle, "images.tar.gz"), image);
    const hash =
      mode === "checksum"
        ? "0".repeat(64)
        : createHash("sha256").update(image).digest("hex");
    writeFileSync(
      join(bundle, "images.tar.gz.sha256"),
      `${hash}  images.tar.gz\n`,
    );
    const callsFile = join(root, "calls");
    const stateFile = join(root, "state");
    writeFileSync(callsFile, "");
    writeFileSync(
      stateFile,
      JSON.stringify({
        app: mode === "retry" ? "new-app" : "old-app",
        web: mode === "retry" ? "new-web" : "old-web",
        appTag: "old-app",
        webTag: "old-web",
      }),
    );
    const result = spawnSync(
      "bash",
      [
        "-c",
        'source "$1"; deploy_release "$2" "$3" "$4"',
        "test",
        script,
        bundle,
        id,
        root,
      ],
      {
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          CASE: mode,
          CALLS: callsFile,
          STATE: stateFile,
        },
        encoding: "utf8",
        timeout: 20000,
      },
    );
    assert.ifError(result.error);
    assert.doesNotMatch(result.stdout + result.stderr, /PRIVATE_CANARY/);
    const calls = readFileSync(callsFile, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(JSON.parse);
    const state = JSON.parse(readFileSync(stateFile, "utf8"));
    const marker = join(root, "var/lib/resumeforge/current-release");
    return {
      ...result,
      calls,
      state,
      release: existsSync(marker) ? readFileSync(marker, "utf8").trim() : null,
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
const starts = (result) =>
  result.calls.filter((call) => call[0] === "docker" && call.includes("up"));

test("healthy release backs up first, changes only app/web, and records success", () => {
  const result = trial("success");
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    starts(result).map((call) => call.at(-1)),
    ["app", "web"],
  );
  assert.ok(
    starts(result).every((call) =>
      ["--no-deps", "--no-build", "never", "--wait"].every((flag) =>
        call.includes(flag),
      ),
    ),
  );
  assert.ok(
    result.calls.findIndex((call) => call[0] === "resumeforge-backup") <
      result.calls.findIndex((call) => call.includes("up")),
  );
  assert.deepEqual(
    [result.state.app, result.state.web, result.release],
    ["new-app", "new-web", release],
  );
  assert.ok(
    result.calls.every(
      (call) =>
        !call.includes("down") &&
        !call.includes("bootstrap") &&
        !call.includes("credentials"),
    ),
  );
});
for (const mode of ["app", "web"])
  test(`${mode} startup failure restores both previous images`, () => {
    const result = trial(mode);
    assert.notEqual(result.status, 0);
    assert.deepEqual(
      [result.state.app, result.state.web, result.release],
      ["old-app", "old-web", null],
    );
    assert.match(result.stderr, /Previous release restored/);
  });
for (const mode of [
  "backup",
  "checksum",
  "schema",
  "fingerprint-error",
  "disk",
  "locked",
])
  test(`${mode} failure stops before any running service changes`, () => {
    const result = trial(mode);
    assert.notEqual(result.status, 0, result.stdout);
    assert.equal(starts(result).length, 0);
    assert.deepEqual(
      [result.state.app, result.state.web, result.release],
      ["old-app", "old-web", null],
    );
  });
test("retry of an already healthy release does not restart or back up again", () => {
  const result = trial("retry");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(starts(result).length, 0);
  assert.equal(
    result.calls.some((call) => call[0] === "resumeforge-backup"),
    false,
  );
});
test("rollback failure remains a failed release and requests operator attention", () => {
  const result = trial("rollback");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Rollback needs operator attention/);
  assert.equal(result.release, null);
});
test("invalid release identifiers are rejected before Docker or provider access", () => {
  const result = trial("success", "main; echo invalid");
  assert.notEqual(result.status, 0);
  assert.deepEqual(result.calls, []);
});
