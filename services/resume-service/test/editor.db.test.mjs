import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  createDatabaseClient,
  runtimeRoleNames,
  assertRuntimeDatabaseRole,
} from "@resume-forge/prisma-client";
import {
  Client,
  provisionRuntimeRoles,
} from "../../../scripts/runtime-roles.mjs";
import { createResumeUseCases } from "../dist/resume.js";
import { createResumeApp } from "../dist/app.js";
import { createGatewayApp } from "../../gateway/dist/app.js";
import { loadResumeApi } from "../../../apps/resume-mfe/test/resume-api-loader.mjs";
const { blankResume, createResumeApi, fromResumeContent, toResumeContent } =
  await loadResumeApi();
const root = process.env.RESUME_FORGE_LOCAL_ROOT
  ? pathToFileURL(`${process.env.RESUME_FORGE_LOCAL_ROOT}/`)
  : new URL("../../../", import.meta.url);
const base = new URL(
  parseEnv(readFileSync(new URL(".local/database.env", root), "utf8"))
    .DATABASE_URL,
);
assert.equal(base.hostname, "127.0.0.1");
assert.equal(base.port, "55432");
const suffix = randomUUID().replaceAll("-", "").slice(0, 16),
  databaseName = `rf_editor_test_${suffix}`,
  prefix = `rf_e_${suffix}`;
const names = runtimeRoleNames(prefix),
  passwords = Object.fromEntries(
    Object.keys(names).map((s) => [s, randomBytes(32).toString("hex")]),
  );
const lifecycleUrl = new URL(base);
lifecycleUrl.pathname = "/postgres";
const lifecycle = new Client({ connectionString: lifecycleUrl.href });
const url = new URL(base);
url.pathname = `/${databaseName}`;
const owner = createDatabaseClient(url.href);
const admin = new Client({ connectionString: url.href });
let runtime;
test("owned editor persistence through client, gateway, service and restricted PostgreSQL role", async (t) => {
  await lifecycle.connect();
  let created = false;
  try {
    await lifecycle.query(`CREATE DATABASE "${databaseName}"`);
    created = true;
    const migration = spawnSync(
      "pnpm",
      ["exec", "prisma", "migrate", "deploy"],
      {
        cwd: new URL("../../../packages/prisma-client/", import.meta.url),
        env: { ...process.env, DATABASE_URL: url.href },
        encoding: "utf8",
      },
    );
    assert.equal(migration.status, 0, "disposable migrations deploy");
    await admin.connect();
    await provisionRuntimeRoles(admin, { databaseName, prefix, passwords });
    const runtimeUrl = new URL(url);
    runtimeUrl.username = names.resume;
    runtimeUrl.password = passwords.resume;
    runtime = createDatabaseClient(runtimeUrl.href);
    await assertRuntimeDatabaseRole(runtime, "resume", names.resume);
    const alice = await owner.user.create({
        data: {
          email: "editor-alice@example.invalid",
          personalWorkspace: { create: { type: "individual" } },
        },
        include: { personalWorkspace: true },
      }),
      bob = await owner.user.create({
        data: {
          email: "editor-bob@example.invalid",
          personalWorkspace: { create: { type: "individual" } },
        },
        include: { personalWorkspace: true },
      });
    const actors = { alice, bob };
    const resumes = createResumeUseCases(runtime);
    const app = createResumeApp({
      personalEditorOnly: true,
      resumes,
      resolveActor: async (auth) => {
        const user = actors[auth?.replace("Bearer ", "")];
        return user
          ? {
              status: "authenticated",
              actor: {
                userId: user.id,
                personalWorkspaceId: user.personalWorkspace.id,
                expiresAt: Date.now() + 60000,
              },
            }
          : { status: "unauthenticated" };
      },
    });
    const gateway = createGatewayApp((target, options) =>
      app.request(target, options),
    );
    const client = (user) =>
      createResumeApi(
        (path, options) =>
          gateway.request(path, {
            ...options,
            headers: {
              ...options.headers,
              Authorization: `Bearer ${user}`,
              Origin: "http://localhost:3000",
            },
          }),
        actors[user].personalWorkspace.id,
      );
    const a = client("alice"),
      b = client("bob");
    let saved;
    const draft = blankResume("Synthetic Person");
    await t.test(
      "no profile setup; creation and initial version survive independent reads",
      async () => {
        saved = await a.create(randomUUID(), draft);
        assert.equal(saved.currentVersion, 1);
        assert.deepEqual(
          fromResumeContent((await a.load(saved.id)).content),
          draft,
        );
        assert.equal((await a.list()).length, 1);
        const p = await owner.userProfile.findUnique({
          where: { userId: alice.id },
          include: { contact: true },
        });
        assert.equal(p.fullName, "");
        assert.equal(p.professionalSummary, null);
        assert.equal(p.contact, null);
      },
    );
    await t.test(
      "creation retries allocate one resume, initial version and audit event",
      async () => {
        const again = await a.create(saved.id, draft);
        assert.equal(again.id, saved.id);
        assert.equal(await owner.resume.count(), 1);
        assert.equal(await owner.resumeVersion.count(), 1);
        await Promise.all([
          a.create(saved.id, draft),
          a.create(saved.id, draft),
        ]);
        assert.equal(await owner.resume.count(), 1);
        assert.equal(await owner.resumeVersion.count(), 1);
        assert.equal(await owner.auditOutbox.count(), 1);
      },
    );
    await t.test(
      "save rich summary, links, project dates, visibility and languages; new client reload keeps values",
      async () => {
        const d = structuredClone(draft);
        d.title = "Synthetic database proof";
        d.header.links = [
          {
            id: "profile-link",
            label: "Website",
            url: "https://example.com/alex",
          },
        ];
        const project = fromResumeContent({
          sections: [
            {
              id: "imported-projects",
              kind: "projects",
              label: "Projects",
              entries: [
                {
                  id: "imported-project",
                  title: "Atlas",
                  subtitle: "Individual Project",
                  startDate: "2026-02",
                  endDate: "2026-04",
                  technologies: "Python, PostgreSQL",
                  links: [
                    {
                      id: "project-link",
                      label: "Website",
                      url: "https://example.com/atlas",
                    },
                  ],
                  bullets: [
                    {
                      id: "project-bullet",
                      text: "Supported imported fact.",
                      hidden: false,
                    },
                  ],
                },
              ],
            },
          ],
        }).sections[0].entries[0];
        d.sections[3].entries = [project];
        d.sections[0].summary = {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "User supplied fact",
                  marks: [{ type: "bold" }],
                },
              ],
            },
          ],
        };
        d.sections[4].languages = [
          {
            id: "language-1",
            text: "Spanish",
            proficiency: "Conversational",
            hidden: true,
          },
        ];
        saved = await a.save(saved.id, 1, d);
        assert.equal(saved.currentVersion, 2);
        assert.deepEqual(
          fromResumeContent((await client("alice").load(saved.id)).content),
          d,
        );
        assert.equal(await owner.resumeVersion.count(), 2);
      },
    );
    await t.test(
      "two simultaneous tabs produce one successful version and one conflict",
      async () => {
        const d = fromResumeContent(saved.content);
        const result = await Promise.allSettled([
          a.save(saved.id, 2, { ...d, title: "Tab one" }),
          a.save(saved.id, 2, { ...d, title: "Tab two" }),
        ]);
        assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
        assert.equal(
          result.filter(
            (r) =>
              r.status === "rejected" && r.reason.code === "revision_conflict",
          ).length,
          1,
        );
        assert.equal(await owner.resumeVersion.count(), 3);
      },
    );
    await t.test(
      "wrong owner, foreign selector and anonymous read never disclose drafts",
      async () => {
        await assert.rejects(b.load(saved.id), (e) => e.code === "not_found");
        assert.deepEqual(await b.list(), []);
        assert.equal((await app.request("/api/v1/resume")).status, 401);
        const foreign = await app.request("/api/v1/resume", {
          headers: {
            Authorization: "Bearer alice",
            "X-Workspace-Id": bob.personalWorkspace.id,
          },
        });
        assert.notEqual(foreign.status, 200);
      },
    );
    await t.test(
      "restricted role cannot read OAuth, contacts or modify master professional data",
      async () => {
        await assert.rejects(runtime.$queryRaw`SELECT * FROM "OAuthAccount"`);
        await assert.rejects(runtime.$queryRaw`SELECT * FROM "UserContact"`);
        await assert.rejects(
          runtime.$executeRaw`UPDATE "UserProfile" SET "professionalSummary"='forbidden'`,
        );
      },
    );
    await t.test(
      "authenticated text upload stages without persistence or master mutation",
      async () => {
        const count = await owner.resume.count();
        const parsed = await a.parse(
          new File(
            [
              "Synthetic Person\nSUMMARY\nUser supplied wording\nSKILLS\nTypeScript",
            ],
            "synthetic.txt",
            { type: "text/plain" },
          ),
        );
        assert.ok(parsed.text.includes("User supplied wording"));
        assert.equal(await owner.resume.count(), count);
        assert.equal(await owner.userContact.count(), 0);
        assert.equal(
          (
            await app.request("/api/v1/resume/parse", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: "{}",
            })
          ).status,
          401,
        );
      },
    );
    await t.test(
      "gateway keeps AI, direct import, deletion and sharing disconnected",
      async () => {
        for (const path of [
          "/api/v1/resume/import",
          `/api/v1/resume/${saved.id}/suggest`,
          `/api/v1/resume/${saved.id}/apply-suggestion`,
        ])
          assert.equal(
            (await gateway.request(path, { method: "POST" })).status,
            404,
          );
        assert.equal(
          (
            await gateway.request(`/api/v1/resume/${saved.id}`, {
              method: "DELETE",
            })
          ).status,
          404,
        );
      },
    );
    await t.test(
      "invalid creation leaves no resume, version or profile anchor",
      async () => {
        const invalid = blankResume();
        invalid.synthetic = true;
        const count = await owner.resume.count();
        await assert.rejects(b.create(randomUUID(), invalid));
        assert.equal(await owner.resume.count(), count);
        assert.equal(
          await owner.userProfile.count({ where: { userId: bob.id } }),
          0,
        );
      },
    );
    await t.test(
      "50-row pages have stable IDs and reject another owner's cursor",
      async () => {
        const profile = await owner.userProfile.findUnique({
          where: { userId: alice.id },
        });
        await owner.resume.createMany({
          data: Array.from({ length: 51 }, (_, i) => ({
            id: randomUUID(),
            profileId: profile.id,
            ownerUserId: alice.id,
            workspaceId: alice.personalWorkspace.id,
            workspaceType: "individual",
            createdByUserId: alice.id,
            content: toResumeContent({
              ...blankResume(),
              title: `Synthetic page ${i}`,
            }),
          })),
        });
        const first = await a.list(),
          second = await a.list(undefined, first.at(-1).id);
        assert.equal(first.length, 50);
        assert.equal(second.length, 2);
        assert.equal(new Set([...first, ...second].map((r) => r.id)).size, 52);
        await assert.rejects(
          b.list(undefined, first[0].id),
          (e) => e.code === "not_found",
        );
      },
    );
  } finally {
    await runtime?.$disconnect();
    await owner.$disconnect();
    await admin.end();
    if (created)
      await lifecycle.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    for (const name of Object.values(names))
      await lifecycle.query(`DROP ROLE IF EXISTS "${name}"`);
    await lifecycle.end();
  }
});
