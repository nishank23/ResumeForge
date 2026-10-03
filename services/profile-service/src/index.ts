import { serve } from "@hono/node-server";
import {
  createDatabaseClient,
  assertRuntimeDatabaseRole,
} from "@resume-forge/prisma-client";
import { createLocalActorResolver } from "@resume-forge/access-policy/server";
import { createProfileApp } from "./app.js";
import { createProfileUseCases } from "./profile.js";
import { loadProfileConfig } from "./config.js";

const config = loadProfileConfig();
const db = createDatabaseClient(config.databaseUrl, { timeoutMs: 3_000 });
try {
  await assertRuntimeDatabaseRole(db, "profile");
} catch {
  await db.$disconnect();
  throw new Error(
    "Restricted profile database access unavailable. Run db:runtime:init.",
  );
}
const app = createProfileApp({
  resolveActor: createLocalActorResolver(config),
  profiles: createProfileUseCases(db),
});
serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 4002 }, () => {
  console.log("Profile service listening on http://localhost:4002");
});
