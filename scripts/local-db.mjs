import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  chmodSync,
  unlinkSync,
  readFileSync,
} from "node:fs";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const local = path.join(root, ".local");
const data = path.join(local, "postgres");
const envFile = path.join(local, "database.env");
const port = "55432";
const action = process.argv[2];
function run(command, args, allowedFailure = false) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowedFailure)
    throw new Error(`${command} failed`);
  return result.status;
}

if (action === "start") {
  mkdirSync(local, { recursive: true, mode: 0o700 });
  chmodSync(local, 0o700);
  if (!existsSync(data)) {
    const password = randomBytes(32).toString("hex");
    const passwordFile = path.join(local, "init-password");
    writeFileSync(passwordFile, password, { mode: 0o600, flag: "wx" });
    try {
      run("initdb", [
        "-D",
        data,
        "-U",
        "resume_forge",
        "--encoding=UTF8",
        "--locale=C",
        "--auth=scram-sha-256",
        `--pwfile=${passwordFile}`,
      ]);
      writeFileSync(
        envFile,
        `DATABASE_URL=postgresql://resume_forge:${password}@127.0.0.1:${port}/resume_forge_dev\n`,
        { mode: 0o600 },
      );
    } finally {
      unlinkSync(passwordFile);
    }
  }
  if (!existsSync(envFile))
    throw new Error(
      "Missing .local/database.env; recover its password before starting this cluster.",
    );
  if (run("pg_ctl", ["-D", data, "status"], true) !== 0) {
    run("pg_ctl", [
      "-D",
      data,
      "-l",
      path.join(local, "postgres.log"),
      "-o",
      `-h 127.0.0.1 -p ${port} -k ''`,
      "-w",
      "start",
    ]);
  }
  const url = new URL(parseEnv(readFileSync(envFile, "utf8")).DATABASE_URL);
  process.env.PGPASSWORD = decodeURIComponent(url.password);
  const args = ["-h", "127.0.0.1", "-p", port, "-U", "resume_forge"];
  const query = spawnSync(
    "psql",
    [
      ...args,
      "-d",
      "postgres",
      "-Atc",
      "SELECT 1 FROM pg_database WHERE datname = 'resume_forge_dev'",
    ],
    { encoding: "utf8" },
  );
  if (query.status !== 0)
    throw new Error("Cannot connect to the project cluster");
  if (query.stdout.trim() !== "1")
    run("createdb", [...args, "resume_forge_dev"]);
  console.log(
    "Local PostgreSQL ready at 127.0.0.1:55432/resume_forge_dev. Credentials: .local/database.env (private).",
  );
} else if (action === "stop") {
  run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
} else if (action === "status") {
  run("pg_ctl", ["-D", data, "status"]);
} else {
  throw new Error("Usage: node scripts/local-db.mjs start|stop|status");
}
