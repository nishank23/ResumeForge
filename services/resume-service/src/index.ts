import { serve } from "@hono/node-server";
import { createDatabaseClient } from "@resume-forge/prisma-client";
import { createLocalActorResolver } from "@resume-forge/access-policy/server";
import { createResumeApp } from "./app.js";
import { createResumeUseCases } from "./resume.js";
import { loadResumeConfig } from "./config.js";

const config = loadResumeConfig();
const db = createDatabaseClient(config.databaseUrl, { timeoutMs: 5_000 });

const app = createResumeApp({
  resolveActor: createLocalActorResolver({
    endpoint: config.endpoint,
    key: config.authKey,
  }),
  resumes: createResumeUseCases(db),
});

serve({ fetch: app.fetch, hostname: "127.0.0.1", port: config.port }, () => {
  console.log(`Resume service listening on http://localhost:${String(config.port)}`);
});
