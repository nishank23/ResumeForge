import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const begin = "<!-- BEGIN:CURRENT_TASK -->";
const end = "<!-- END:CURRENT_TASK -->";
const root = fileURLToPath(new URL("../", import.meta.url));
const lockPath = (directory) =>
  path.join(directory, ".local/development-task.lock");

function readState(directory) {
  const document = readFileSync(
    path.join(directory, "context", "development-status.md"),
    "utf8",
  );
  const start = document.indexOf(begin);
  const stop = document.indexOf(end);
  if (
    start < 0 ||
    stop < start ||
    document.indexOf(begin, start + 1) >= 0 ||
    document.indexOf(end, stop + 1) >= 0
  )
    throw new Error(
      "Development-status current-task marker is missing or ambiguous.",
    );
  const block = document.slice(start + begin.length, stop).trim();
  const match = /^```json\n([\s\S]+)\n```$/.exec(block);
  const state = match && JSON.parse(match[1]);
  if (
    !state ||
    !["idle", "ongoing"].includes(state.status) ||
    (state.status === "idle" &&
      (state.owner !== null || state.task !== null)) ||
    (state.status === "ongoing" &&
      (typeof state.owner !== "string" ||
        !state.owner ||
        typeof state.task !== "string" ||
        !state.task))
  )
    throw new Error(
      "Development-status current-task status is invalid; do not start work.",
    );
  return { document, start, stop, state };
}

function writeState(directory, state) {
  // Read immediately before the atomic replace; preserve all other task-document content.
  const { document, start, stop } = readState(directory);
  const updated = `${document.slice(0, start)}${begin}\n\`\`\`json\n${JSON.stringify(state, null, 2)}\n\`\`\`\n${document.slice(stop)}`;
  const temporary = path.join(
    directory,
    "context",
    `.development-task-${randomUUID()}.tmp`,
  );
  try {
    writeFileSync(temporary, updated, { flag: "wx", mode: 0o644 });
    renameSync(
      temporary,
      path.join(directory, "context", "development-status.md"),
    );
  } finally {
    rmSync(temporary, { force: true });
  }
}

function safeNote(value) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 240 ||
    /[\r\n\x00-\x1f]/.test(value)
  )
    throw new Error("Use a short, non-private, single-line task description.");
  return value.trim();
}

export function taskStatus(directory = root) {
  const { state } = readState(directory);
  // A lock may exist before the task-document update, or after a crash. Fail closed.
  return {
    ...state,
    status: existsSync(lockPath(directory)) ? "ongoing" : state.status,
  };
}

export function startTask(task, directory = root) {
  task = safeNote(task);
  if (taskStatus(directory).status === "ongoing") return null;
  const lock = lockPath(directory);
  mkdirSync(path.dirname(lock), { recursive: true, mode: 0o700 });
  try {
    mkdirSync(lock, { mode: 0o700 });
  } catch (error) {
    if (error.code === "EEXIST") return null;
    throw error;
  }
  const owner = randomUUID();
  try {
    writeFileSync(path.join(lock, "owner"), owner, { flag: "wx", mode: 0o600 });
    const { state } = readState(directory);
    if (state.status === "ongoing") {
      rmSync(lock, { recursive: true });
      return null;
    }
    const now = new Date().toISOString();
    writeState(directory, {
      ...state,
      status: "ongoing",
      task,
      owner,
      startedAt: now,
      updatedAt: now,
    });
    return owner;
  } catch (error) {
    rmSync(lock, { recursive: true, force: true });
    throw error;
  }
}

export function finishTask(owner, result, directory = root) {
  result = safeNote(result);
  const lock = lockPath(directory);
  const { state } = readState(directory);
  if (
    typeof owner !== "string" ||
    state.status !== "ongoing" ||
    state.owner !== owner ||
    readFileSync(path.join(lock, "owner"), "utf8") !== owner
  )
    throw new Error("Only the run that owns the task may finish it.");
  // Serialize completion too: two finish processes must not erase a new claim.
  const finishing = path.join(lock, "finishing");
  mkdirSync(finishing);
  try {
    if (
      readState(directory).state.owner !== owner ||
      readFileSync(path.join(lock, "owner"), "utf8") !== owner
    )
      throw new Error("Task ownership changed; do not finish it.");
    writeState(directory, {
      status: "idle",
      task: null,
      owner: null,
      startedAt: null,
      updatedAt: new Date().toISOString(),
      lastResult: result,
    });
    rmSync(lock, { recursive: true });
  } catch (error) {
    rmSync(finishing, { recursive: true, force: true });
    throw error;
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const [action, ...args] = process.argv.slice(2);
    if (action === "status" && args.length === 0)
      console.log(JSON.stringify(taskStatus(), null, 2));
    else if (action === "start" && args.length === 1) {
      const owner = startTask(args[0]);
      if (owner) console.log(owner);
      else {
        console.log(
          "A task is ongoing; skip this run and check again in 15 minutes.",
        );
        process.exitCode = 2;
      }
    } else if (action === "finish" && args.length === 2) {
      finishTask(args[0], args[1]);
      console.log(
        "Task finished; development status is idle for the next scheduled check.",
      );
    } else
      throw new Error(
        "Usage: development-task.mjs status | start <title> | finish <owner> <result>",
      );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
