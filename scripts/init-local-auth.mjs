import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

try {
  if (process.env.NODE_ENV === "production") throw new Error();
  const dir = new URL("../.local/", import.meta.url);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(
    new URL("auth-transport.env", dir),
    `LOCAL_PROFILE_SERVICE_KEY=${randomBytes(32).toString("hex")}\n`,
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Local auth service credential created in ignored .local/auth-transport.env.",
  );
} catch (error) {
  if (error.code === "EEXIST")
    console.log(
      "Local auth service credential already exists; kept unchanged.",
    );
  else {
    console.error("Local auth service credential setup failed.");
    process.exitCode = 1;
  }
}
