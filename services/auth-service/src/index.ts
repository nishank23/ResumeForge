import { serve } from "@hono/node-server";
import { createDatabaseClient } from "@resume-forge/prisma-client";
import { loadConfig } from "./config.js";
import { createGoogleProvider } from "./google.js";
import { createAuthApp } from "./app.js";

const config = loadConfig();
const db = createDatabaseClient(config.DATABASE_URL);
const origin = `http://localhost:${String(config.AUTH_SERVICE_PORT)}`;
const provider =
  config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET
    ? createGoogleProvider(
        config.GOOGLE_CLIENT_ID,
        config.GOOGLE_CLIENT_SECRET,
        `${origin}/api/v1/auth/google/callback`,
      )
    : undefined;
const app = createAuthApp({ db, provider, appOrigin: "http://localhost:3000" });
serve(
  { fetch: app.fetch, port: config.AUTH_SERVICE_PORT, hostname: "127.0.0.1" },
  () => {
    console.log(`Auth service listening on ${origin}`);
  },
);
