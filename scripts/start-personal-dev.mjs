import { execFileSync, spawn } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createConnection } from "node:net";

const root = fileURLToPath(new URL("../", import.meta.url));
if (process.env.NODE_ENV === "production")
  throw new Error("Local development only.");
const common = execFileSync(
  "git",
  ["rev-parse", "--path-format=absolute", "--git-common-dir"],
  { cwd: root, encoding: "utf8" },
).trim();
const localRoot = realpathSync(
  resolve(process.env.RESUME_FORGE_LOCAL_ROOT ?? dirname(common)),
);
for (const file of [".local/runtime-database.env", ".local/auth-transport.env"])
  if (!existsSync(resolve(localRoot, file)))
    throw new Error(
      "Missing managed local configuration. See README sign-in setup.",
    );
const busy = await Promise.all(
  [3000, 3001, 3002, 3003, 4000, 4001, 4002, 4003, 4004].map(
    (port) =>
      new Promise((done) => {
        const socket = createConnection({ host: "localhost", port });
        socket.setTimeout(500);
        socket.once("connect", () => {
          socket.destroy();
          done(port);
        });
        socket.once("error", () => done(undefined));
        socket.once("timeout", () => {
          socket.destroy();
          done(undefined);
        });
      }),
  ),
);
if (busy.some(Boolean))
  throw new Error(
    `Stop the existing stack first. Busy ports: ${busy.filter(Boolean).join(", ")}.`,
  );
console.log(
  "Starting frontend and personal auth/profile/resume services with the existing managed local configuration.",
);
const child = spawn(
  "pnpm",
  [
    "--parallel",
    ...[
      "shell",
      "auth-mfe",
      "profile-mfe",
      "resume-mfe",
      "gateway",
      "auth-service",
      "profile-service",
      "resume-service",
      "ats-service",
    ].flatMap((name) => ["--filter", `@resume-forge/${name}`]),
    "dev",
  ],
  {
    cwd: root,
    env: { ...process.env, RESUME_FORGE_LOCAL_ROOT: localRoot },
    stdio: "inherit",
    detached: process.platform !== "win32",
  },
);
const stop = () => {
  if (child.pid) {
    if (process.platform === "win32") child.kill("SIGTERM");
    else {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        /* Already stopped. */
      }
    }
  }
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
child.once("exit", (code) => {
  process.exitCode = code ?? 0;
});
child.once("error", () => {
  console.error("Could not start pnpm. Check the pinned toolchain.");
  process.exitCode = 1;
});
