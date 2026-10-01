import { existsSync } from "node:fs";
import { z } from "zod";

for (const file of ["../../../.env", "../../../.local/database.env"]) {
  const url = new URL(file, import.meta.url);
  if (existsSync(url)) process.loadEnvFile(url);
}
const schema = z.object({
  DATABASE_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  AUTH_SERVICE_PORT: z.coerce.number().int().min(1).max(65535).default(4001),
});
export function loadConfig() {
  const result = schema.safeParse(process.env);
  if (!result.success)
    throw new Error(
      "Invalid auth configuration. Check database and OAuth settings; see docs/google-login.md.",
    );
  if (process.env.NODE_ENV === "production")
    throw new Error("Local auth is not approved for production deployment.");
  return result.data;
}
