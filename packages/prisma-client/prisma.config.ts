import { defineConfig } from "prisma/config";
import { existsSync } from "node:fs";

const localEnv = new URL("../../.local/database.env", import.meta.url);
if (!process.env.DATABASE_URL && existsSync(localEnv))
  process.loadEnvFile(localEnv);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://resume_forge@127.0.0.1:55432/resume_forge_dev",
  },
});
