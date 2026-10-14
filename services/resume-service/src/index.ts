import { createAiProviders, loadAiSettings } from "./ats/ai.js";
import { serve } from "@hono/node-server";
import {
  assertRuntimeDatabaseRole,
  createDatabaseClient,
} from "@resume-forge/prisma-client";
import { createLocalActorResolver } from "@resume-forge/access-policy/server";
import { createResumeApp } from "./app.js";
import { createResumeUseCases } from "./resume.js";
import { loadResumeConfig } from "./config.js";

const config = loadResumeConfig();
const db = createDatabaseClient(config.databaseUrl, { timeoutMs: 5_000 });

await assertRuntimeDatabaseRole(db, "resume");

const app = createResumeApp({
  personalEditorOnly: true,
  appOrigin: config.appOrigin,
  resolveActor: createLocalActorResolver({
    endpoint: config.endpoint,
    key: config.authKey,
  }),
  resumes: createResumeUseCases(
    db,
    Date.now,
    undefined,
    createAiProviders(loadAiSettings()),
  ),
});

serve({ fetch: app.fetch, hostname: "127.0.0.1", port: config.port }, () => {
  console.log(
    `Resume service listening on http://localhost:${String(config.port)}`,
  );
});
