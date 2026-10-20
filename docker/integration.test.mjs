import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { once } from "node:events";
import { readAdmin, readRuntime } from "./config.mjs";
import { Client } from "../scripts/runtime-roles.mjs";
import {
  createDatabaseClient,
  assertRuntimeDatabaseRole,
} from "../packages/prisma-client/dist/index.js";
import { createAuthApp } from "../services/auth-service/dist/app.js";
import { createLocalActorResolver } from "../packages/access-policy/dist/server.js";
import { createResumeApp } from "../services/resume-service/dist/app.js";
import { createResumeUseCases } from "../services/resume-service/dist/resume.js";
import { createGatewayApp } from "../services/gateway/dist/app.js";
import { loadResumeApi } from "../apps/resume-mfe/test/resume-api-loader.mjs";
const { serve } = createRequire(
  new URL("../services/auth-service/package.json", import.meta.url),
)("@hono/node-server");

assert.equal(
  process.env.FORGE_DOCKER_TEST,
  "1",
  "Run only through the isolated Docker test override.",
);
const { blankResume, createResumeApi, fromResumeContent } =
  await loadResumeApi();
const runtime = readRuntime();
const cloud = process.env.RESUME_FORGE_RUNTIME === "cloud";
const appOrigin = cloud
  ? process.env.FORGE_PUBLIC_ORIGIN
  : "http://localhost:3000";
const admin = new Client({ connectionString: readAdmin().href });
const owner = createDatabaseClient(readAdmin().href);
const clients = Object.fromEntries(
  Object.entries(runtime).map(([service, url]) => [
    service,
    createDatabaseClient(url.href),
  ]),
);
const cookie = (response, key) =>
  response.headers
    .getSetCookie()
    .find((v) => v.startsWith(`${key}=`))
    ?.split(";")[0];

test("full Docker app, migrated vector database and restricted personal flow", async (t) => {
  let server;
  await admin.connect();
  try {
    await t.test(
      "published app services and all three federation entries are reachable",
      async () => {
        const addresses = cloud
          ? [
              ["http://web:8080/", 200],
              ["http://web:8080/mfe/auth/remoteEntry.js", 200],
              ["http://web:8080/mfe/profile/remoteEntry.js", 200],
              ["http://web:8080/mfe/resume/remoteEntry.js", 200],
              ["http://web:8080/api/v1/health", 200],
              ["http://web:8080/api/v1/auth/me", 401],
              ["http://web:8080/api/v1/resume", 401],
              ["http://web:8080/api/v1/profile", 401],
              ["http://web:8080/internal/auth/resolve", 404],
              ["http://web:8080/mfe/missing.js", 404],
            ]
          : [
              [3000, "/", 200],
              [3001, "/remoteEntry.js", 200],
              [3002, "/remoteEntry.js", 200],
              [3003, "/remoteEntry.js", 200],
              [4000, "/api/v1/health", 200],
              [4001, "/api/v1/auth/me", 401],
              [4000, "/api/v1/resume", 401],
              [4000, "/api/v1/profile", 401],
            ].map(([port, path, status]) => [
              `http://localhost:${port}${path}`,
              status,
            ]);
        for (const [url, status] of addresses) {
          const response = await fetch(url, {
            signal: AbortSignal.timeout(5000),
          });
          assert.equal(response.status, status);
          await response.body?.cancel();
        }
        assert.equal(
          (await fetch("http://localhost:4001/api/v1/auth/google/url")).status,
          503,
        );
        assert.equal(
          (
            await fetch("http://localhost:4000/internal/auth/resolve", {
              method: "POST",
            })
          ).status,
          404,
        );
        assert.equal(
          (
            await fetch("http://localhost:4001/internal/auth/resolve", {
              method: "POST",
            })
          ).status,
          401,
        );
      },
    );
    await t.test(
      "PostgreSQL 18, pgvector, every migration and every restricted role are ready",
      async () => {
        const result = await admin.query(
          "SELECT current_setting('server_version_num')::int AS version",
        );
        assert.ok(
          result.rows[0].version >= 180000 && result.rows[0].version < 190000,
        );
        assert.equal(
          (
            await admin.query(
              "SELECT extversion FROM pg_extension WHERE extname='vector'",
            )
          ).rows[0].extversion,
          "0.8.7",
        );
        assert.equal(
          (
            await admin.query(
              'SELECT count(*)::int AS n FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL',
            )
          ).rows[0].n,
          0,
        );
        for (const [service, db] of Object.entries(clients))
          await assertRuntimeDatabaseRole(db, service);
        await assert.rejects(
          clients.resume.$queryRaw`SELECT * FROM "OAuthAccount"`,
        );
        await assert.rejects(
          clients.resume.$queryRaw`SELECT * FROM "UserContact"`,
        );
        await assert.rejects(
          clients.resume
            .$executeRaw`UPDATE "UserProfile" SET "professionalSummary"='forbidden'`,
        );
      },
    );
    const suffix = randomUUID();
    const key = "b".repeat(64); // Synthetic internal key, never used by the running app.
    const auth = createAuthApp({
      db: clients.auth,
      appOrigin,
      profileServiceKey: key,
      provider: {
        authorizationURL: (state) =>
          `https://example.invalid/auth?state=${state}`,
        identity: async (code) => ({
          sub: `docker-${suffix}-${code}`,
          email: `docker-${suffix}-${code}@example.invalid`,
          email_verified: true,
          name: "Synthetic Docker User",
        }),
      },
    });
    server = serve({ fetch: auth.fetch, hostname: "127.0.0.1", port: 0 });
    if (!server.listening) await once(server, "listening");
    const endpoint = `http://127.0.0.1:${server.address().port}/internal/auth/resolve`;
    const login = async (code) => {
      const begin = await auth.request("/api/v1/auth/google/url");
      const state = new URL((await begin.json()).url).searchParams.get("state");
      const callback = await auth.request(
        `/api/v1/auth/google/callback?state=${state}&code=${code}`,
        {
          headers: { Cookie: cookie(begin, "oauth_binding") },
        },
      );
      assert.match(callback.headers.get("location"), /signed_in=1/);
      const refreshed = await auth.request("/api/v1/auth/refresh", {
        method: "POST",
        headers: {
          Cookie: cookie(callback, "refresh_token"),
          Origin: appOrigin,
        },
      });
      assert.equal(refreshed.status, 200);
      const token = (await refreshed.json()).data.accessToken;
      const me = await auth.request("/api/v1/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(me.status, 200);
      return { token, user: (await me.json()).data };
    };
    let alice, bob;
    await t.test(
      "synthetic Google callback, persisted identity, refresh and authenticated actor resolution work",
      async () => {
        alice = await login("alice");
        bob = await login("bob");
        const resolver = createLocalActorResolver({ endpoint, key });
        assert.equal(
          (await resolver(`Bearer ${alice.token}`)).status,
          "authenticated",
        );
        assert.equal(
          (await resolver(`Bearer ${"f".repeat(64)}`)).status,
          "unauthenticated",
        );
      },
    );
    const resumes = createResumeUseCases(clients.resume, Date.now, undefined, {
      geminiAvailable: true,
      rewriteAvailable: true,
      tailor: async (source) => ({
        changes: source.fields.map((field) => {
          const fact = field.original
            ? field
            : source.fields.find((item) => item.original);
          return {
            field: field.field,
            proposed: (fact?.original ?? "").replace("in order to", "to"),
            facts: [fact?.field ?? field.field],
          };
        }),
      }),
      verifyTailoring: async (source) => ({
        checks: source.fields.map((field) => ({
          field: field.field,
          supported: true,
          complete: true,
        })),
      }),
    });
    const app = createResumeApp({
      personalEditorOnly: true,
      appOrigin,
      resolveActor: createLocalActorResolver({ endpoint, key }),
      resumes,
    });
    const gateway = createGatewayApp(
      (target, options) => app.request(target, options),
      appOrigin,
    );
    const api = (actor) =>
      createResumeApi(
        (path, options) =>
          gateway.request(path, {
            ...options,
            headers: {
              ...options?.headers,
              Authorization: `Bearer ${actor.token}`,
              Origin: appOrigin,
            },
          }),
        actor.user.workspaceId,
      );
    const a = api(alice),
      b = api(bob);
    let saved;
    const draft = blankResume("Synthetic Docker User");
    draft.title = "Docker persistence proof";
    await t.test(
      "create and edit persist immutable versions; independent reload retains fields",
      async () => {
        saved = await a.create(randomUUID(), draft);
        assert.equal(saved.currentVersion, 1);
        const changed = structuredClone(draft);
        changed.title = "Docker persistence proof saved";
        saved = await a.save(saved.id, 1, changed);
        assert.equal(saved.currentVersion, 2);
        assert.deepEqual(
          fromResumeContent((await api(alice).load(saved.id)).content),
          changed,
        );
        const versions = await owner.resumeVersion.findMany({
          where: { resumeId: saved.id },
          orderBy: { versionNumber: "asc" },
        });
        assert.equal(versions.length, 2);
        await assert.rejects(
          a.save(saved.id, 1, changed),
          (error) => error.code === "revision_conflict",
        );
      },
    );
    await t.test(
      "foreign resume reads fail; owner PDF rendering and local readiness work",
      async () => {
        await assert.rejects(
          b.load(saved.id),
          (error) => error.code === "not_found",
        );
        const pdf = await a.download(saved.id, 2);
        assert.equal(await pdf.slice(0, 5).text(), "%PDF-");
        await assert.rejects(
          b.download(saved.id, 2),
          (error) => error.code === "not_found",
        );
        const readiness = await a.runReadiness(saved.id, 2);
        assert.ok(readiness);
      },
    );
    await t.test(
      "full tailoring queues, reviews and saves one owned copy with PDF on the cloud runtime",
      async () => {
        const sourceDraft = blankResume("Synthetic Cloud Tailoring User");
        sourceDraft.sections[1].entries = fromResumeContent({
          sections: [
            {
              id: "cloud-work",
              kind: "experience",
              entries: [
                {
                  id: "cloud-python",
                  title: "Engineer",
                  description:
                    "Built Python APIs in order to support operations.",
                },
              ],
            },
          ],
        }).sections[0].entries;
        const source = await a.create(randomUUID(), sourceDraft);
        const runId = randomUUID();
        const jd =
          "Backend Engineer\nRequirements:\n- Python required.\nResponsibilities:\n- Build Python APIs for operations.";
        const queued = await a.startTailoring(source.id, 1, runId, jd);
        assert.equal(queued.run.status, "queued");
        await assert.rejects(
          b.tailoring(source.id),
          (error) => error.code === "not_found",
        );
        for (let stage = 0; stage < 6; stage++) {
          if ((await a.tailoring(source.id)).run.status === "ready") break;
          await resumes.processTailoringJobs();
        }
        const ready = (await a.tailoring(source.id)).run;
        assert.equal(ready.status, "ready");
        assert.equal(ready.model, "gemini-3.8-flash");
        assert.ok(ready.changes.length > 0);
        const selected = ready.changes.map((change) => change.id);
        const copy = await a.applyTailoring(
          source.id,
          1,
          runId,
          selected,
          "Cloud tailored proof",
        );
        assert.notEqual(copy.id, source.id);
        assert.equal(copy.currentVersion, 1);
        assert.deepEqual((await a.load(source.id)).content, source.content);
        assert.equal((await a.load(source.id)).currentVersion, 1);
        assert.equal(
          (
            await a.applyTailoring(
              source.id,
              1,
              runId,
              selected,
              "Cloud tailored proof",
            )
          ).id,
          copy.id,
        );
        const pdf = await a.download(copy.id, 1);
        assert.equal(await pdf.slice(0, 5).text(), "%PDF-");
      },
    );
    await t.test(
      "reviewed text upload and confirmed delete/undo work without a provider",
      async () => {
        const parsed = await a.parse(
          new File(
            [
              "Synthetic Docker User\nSUMMARY\nBuilt backend APIs using Python.\nSKILLS\nPython, SQL, PostgreSQL",
            ],
            "synthetic.txt",
            { type: "text/plain" },
          ),
        );
        assert.ok(parsed);
        const deleted = await a.create(
          randomUUID(),
          blankResume("Synthetic Delete User"),
        );
        await a.remove(deleted.id, 1);
        await assert.rejects(
          a.load(deleted.id),
          (error) => error.code === "not_found",
        );
        await a.restore(deleted.id, 1);
        assert.equal((await a.load(deleted.id)).currentVersion, 1);
      },
    );
    await t.test(
      "real Docker audit worker delivers sanitized outbox events",
      async () => {
        const deadline = Date.now() + 20000;
        let count = 0;
        while (Date.now() < deadline) {
          count = await owner.auditEvent.count({
            where: { actorUserId: alice.user.id },
          });
          if (count) break;
          await new Promise((done) => setTimeout(done, 500));
        }
        assert.ok(
          count > 0,
          "Docker audit worker must deliver events to the real app recipient",
        );
      },
    );
  } finally {
    if (server) {
      server.closeAllConnections();
      await new Promise((done) => server.close(done));
    }
    await Promise.all(Object.values(clients).map((db) => db.$disconnect()));
    await owner.$disconnect();
    await admin.end();
  }
});
