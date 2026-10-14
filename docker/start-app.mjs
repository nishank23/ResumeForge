import { spawn } from "node:child_process";
import { readRuntime } from "./config.mjs";
import { runtimeAppOrigin } from "../packages/access-policy/dist/server.js";
import { waitForCloudPort } from "./cloud-start.mjs";

const cloud = process.env.RESUME_FORGE_RUNTIME === "cloud";
if (
  !cloud &&
  (process.env.RESUME_FORGE_RUNTIME !== "docker" ||
    process.env.NODE_ENV === "production")
)
  throw new Error("This launcher supports the managed local Docker app only.");
runtimeAppOrigin();
readRuntime();
const children = [];
const startup = new AbortController();
let stopping = false;
let timer;
function stop(code) {
  if (stopping) return;
  stopping = true;
  startup.abort();
  process.exitCode = code;
  for (const child of children) child.kill("SIGTERM");
  timer = setTimeout(() => {
    for (const child of children) child.kill("SIGKILL");
  }, 12000);
  timer.unref();
}
function start(name, command, args, cwd = "/app") {
  const env = { ...process.env };
  if (cloud && name !== "resume-service")
    env.NODE_OPTIONS = "--max-old-space-size=128";
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
process.once("SIGINT", () => stop(0));
process.once("SIGTERM", () => stop(0));
try {
  for (const [name, port] of [
    ["gateway", 4000],
    ["auth-service", 4001],
    ["profile-service", 4002],
    ["resume-service", 4003],
  ]) {
    start(name, "node", [`services/${name}/dist/index.js`]);
    if (cloud) await waitForCloudPort(port, startup.signal);
  }
  start("audit-recipient", "node", ["scripts/start-local-audit.mjs"]);
  if (cloud) await waitForCloudPort(4005, startup.signal);
  start("audit-worker", "node", ["scripts/work-local-audit.mjs"]);
} catch {
  if (!stopping) {
    console.error(
      "Cloud startup failed before all private services became ready.",
    );
    stop(1);
  }
}
for (const name of cloud
  ? []
  : ["shell", "auth-mfe", "profile-mfe", "resume-mfe"])
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
console.log(
  cloud
    ? "Forge Studio personal APIs starting in production mode."
    : "Forge Studio Docker app starting; open http://localhost:3000 after its healthcheck passes.",
);
