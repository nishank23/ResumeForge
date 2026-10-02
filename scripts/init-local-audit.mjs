import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

try {
  if (process.env.NODE_ENV === "production") throw new Error();
  const dir = new URL("../.local/", import.meta.url);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(
    new URL("audit-transport.env", dir),
    `LOCAL_AUDIT_RELAY_KEY=${randomBytes(32).toString("hex")}\n`,
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Local audit credential created in ignored .local/audit-transport.env.",
  );
} catch (error) {
  if (error.code === "EEXIST")
    console.log("Local audit credential already exists; kept unchanged.");
  else {
    console.error("Local audit credential setup failed.");
    process.exitCode = 1;
  }
}
