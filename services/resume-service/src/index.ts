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

const resumes = createResumeUseCases(
  db,
  Date.now,
  undefined,
  createAiProviders(loadAiSettings()),
);
let workerBusy = false;
const worker = setInterval(() => {
  if (workerBusy) return;
  workerBusy = true;
  void resumes
    .processTailoringJobs()
    .catch(() => {
      console.error(
        "Tailoring queue check failed; pending work will retry. No private request data was logged.",
      );
    })
    .finally(() => {
      workerBusy = false;
    });
}, 1000);
worker.unref();
process.once("exit", () => {
  clearInterval(worker);
});
const app = createResumeApp({
  personalEditorOnly: true,
  resolveActor: createLocalActorResolver({
    endpoint: config.endpoint,
    key: config.authKey,
  }),
  resumes,
});

serve({ fetch: app.fetch, hostname: "127.0.0.1", port: config.port }, () => {
  console.log(
    `Resume service listening on http://localhost:${String(config.port)}`,
  );
});
