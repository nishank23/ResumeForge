import { spawn } from "node:child_process";
import { readRuntime } from "./config.mjs";

if (
  process.env.RESUME_FORGE_RUNTIME !== "docker" ||
  process.env.NODE_ENV === "production"
)
  throw new Error("This launcher supports the managed local Docker app only.");
readRuntime();
const children = [];
let stopping = false;
let timer;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill("SIGTERM");
  timer = setTimeout(() => {
    for (const child of children) child.kill("SIGKILL");
  }, 12000);
  timer.unref();
}
function start(name, command, args, cwd = "/app") {
  const env = { ...process.env };
  // Absent optional credentials must stay absent, and only the owning service receives them.
  for (const key of [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GEMINI_API_KEY",
    "GEMINI_DATA_MODE",
  ]) {
    const owner = key.startsWith("GOOGLE_") ? "auth-service" : "resume-service";
    if (name !== owner || !env[key]?.trim()) delete env[key];
  }
  const child = spawn(command, args, { cwd, env, stdio: "inherit" });
  children.push(child);
  child.once("error", () => {
    console.error(`Docker process ${name} could not start.`);
    stop(1);
  });
  child.once("exit", () => {
    if (!stopping) {
      console.error(`Docker process ${name} stopped; stopping the app.`);
      stop(1);
    }
    if (
      children.every(
        (process) => process.exitCode !== null || process.signalCode !== null,
      )
    )
      clearTimeout(timer);
  });
}
for (const name of [
  "gateway",
  "auth-service",
  "profile-service",
  "resume-service",
])
  start(name, "node", [`services/${name}/dist/index.js`]);
start("audit-recipient", "node", ["scripts/start-local-audit.mjs"]);
start("audit-worker", "node", ["scripts/work-local-audit.mjs"]);
for (const name of ["shell", "auth-mfe", "profile-mfe", "resume-mfe"])
  start(
    name,
    "pnpm",
    [
      "exec",
      "vite",
      "preview",
      "--host",
      "0.0.0.0",
      "--configLoader",
      "native",
    ],
    `/app/apps/${name}`,
  );
process.once("SIGINT", () => stop(0));
process.once("SIGTERM", () => stop(0));
console.log(
  "Forge Studio Docker app starting; open http://localhost:3000 after its healthcheck passes.",
);
