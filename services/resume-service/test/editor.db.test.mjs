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
    let rewriteCalls=0, fullWriterCalls=0, fullReviewCalls=0, embeddingCalls=0, beforeEmbeddingReturn=async()=>{}, beforeRewriteReturn=async()=>{};
    const providers={geminiAvailable:true,rewriteAvailable:true,
      embed:async(inputs)=>{embeddingCalls++;await beforeEmbeddingReturn();return inputs.map((_,i)=>Array.from({length:768},(_,j)=>j===i%2?1:0));},
      analyze:async(requirements,entries)=>requirements.length&&entries.length?[{requirement:requirements[0],evidence:entries[0].details[0],sectionId:entries[0].sectionId,itemId:entries[0].itemId}]:[],
      rewrite:async(fields)=>{rewriteCalls++;await beforeRewriteReturn();return fields.filter((f)=>f.original.includes("in order to")).map((f)=>({field:f.field,proposed:f.original.replace("in order to","to")}));},
    };
    providers.tailor=async(source)=>{fullWriterCalls++;await beforeRewriteReturn();return {changes:source.fields.map(f=>({field:f.field,proposed:f.kind==="summary"&&!f.original?source.fields.find(v=>v.original)?.original??"":f.original.replace("in order to","to"),facts:[f.kind==="summary"&&!f.original?source.fields.find(v=>v.original)?.field:f.field]}))};};
    providers.verifyTailoring=async(source)=>{fullReviewCalls++;return {checks:source.fields.map(f=>({field:f.field,supported:true,complete:true}))};};
    const resumes = createResumeUseCases(runtime,Date.now,undefined,providers);
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
      "gateway keeps AI, direct import and sharing disconnected",
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
          401,
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
      "saved PDF traverses client/gateway/service; owner/version checks and private audit",
      async () => {
        saved = await a.load(saved.id);
        const bytes = await a.download(saved.id, saved.currentVersion);
        assert.equal(await bytes.slice(0, 5).text(), "%PDF-");
        await assert.rejects(
          b.download(saved.id, saved.currentVersion),
          (e) => e.code === "not_found",
        );
        await assert.rejects(
          a.download(saved.id, 1),
          (e) => e.code === "revision_conflict",
        );
        for (const query of [
          "version=0",
          "version=3&version=3",
          "version=3&token=private",
          "",
        ]) {
          const response = await app.request(
            `/api/v1/resume/${saved.id}/pdf?${query}`,
            { headers: { Authorization: "Bearer alice" } },
          );
          assert.equal(response.status, 422);
        }
        const events = await owner.auditOutbox.findMany();
        assert.ok(
          events.some((e) => JSON.stringify(e).includes("resume.downloaded")),
        );
        assert.ok(!JSON.stringify(events).includes("User supplied fact"));
      },
    );
    await t.test(
      "confirmed recoverable deletion survives reads; stale/foreign writes fail; Undo preserves immutable versions",
      async () => {
        const r = await a.create(randomUUID(), blankResume("Deletion Check"));
        await assert.rejects(b.remove(r.id, 1), (e) => e.code === "not_found");
        await assert.rejects(b.restore(r.id, 1), (e) => e.code === "not_found");
        await assert.rejects(
          a.remove(r.id, 2),
          (e) => e.code === "revision_conflict",
        );
        const before = await owner.resumeVersion.count({
          where: { resumeId: r.id },
        });
        const malformed = await app.request(`/api/v1/resume/${r.id}`, {
          method: "DELETE",
          headers: { Authorization: "Bearer alice" },
          body: "{",
        });
        assert.equal(malformed.status, 422);
        await a.remove(r.id, 1);
        await a.remove(r.id, 1);
        assert.ok(
          !(await client("alice").list()).some((row) => row.id === r.id),
        );
        await assert.rejects(a.load(r.id), (e) => e.code === "not_found");
        await assert.rejects(
          a.save(r.id, 1, blankResume()),
          (e) => e.code === "not_found",
        );
        await assert.rejects(
          a.create(r.id, blankResume()),
          (e) => e.code === "not_found",
        );
        await assert.rejects(
          a.download(r.id, 1),
          (e) => e.code === "not_found",
        );
        const restored = await a.restore(r.id, 1);
        assert.equal(restored.currentVersion, 1);
        assert.equal(restored.status, "draft");
        assert.equal(
          await owner.resumeVersion.count({ where: { resumeId: r.id } }),
          before,
        );
        assert.deepEqual(
          fromResumeContent((await a.load(r.id)).content),
          blankResume("Deletion Check"),
        );
        await a.remove(r.id, 1);
      },
    );
    await t.test(
      "deletion, saves and expiry during rendering deny retrieval and leave no successful download audit",
      async () => {
        const r = await a.create(randomUUID(), blankResume("Race Check"));
        const context = {
          actor: {
            userId: alice.id,
            personalWorkspaceId: alice.personalWorkspace.id,
            expiresAt: Date.now() + 60000,
          },
          workspaceId: alice.personalWorkspace.id,
          correlationId: randomUUID(),
        };
        const auditBefore = await owner.auditOutbox.count();
        let release, started;
        const start = new Promise((resolve) => (started = resolve));
        const usecases = createResumeUseCases(runtime, Date.now, async () => {
          started();
          return new Promise((resolve) => (release = resolve));
        });
        const pending = usecases.downloadPdf(context, r.id, 1);
        const rejected = assert.rejects(pending, (e) => e.code === "not_found");
        await start;
        await a.remove(r.id, 1);
        release(new Uint8Array(Buffer.from("%PDF-")));
        await rejected;
        assert.equal(await owner.auditOutbox.count(), auditBefore + 1);
        await a.restore(r.id, 1);
        let now = Date.now();
        const expired = createResumeUseCases(
          runtime,
          () => now,
          async () => {
            now = context.actor.expiresAt + 1;
            return new Uint8Array(Buffer.from("%PDF-"));
          },
        );
        await assert.rejects(
          expired.downloadPdf(context, r.id, 1),
          (e) => e.code === "unauthenticated",
        );
        const changed = createResumeUseCases(runtime, Date.now, async () => {
          await a.save(r.id, 1, { ...blankResume(), title: "New save" });
          return new Uint8Array(Buffer.from("%PDF-"));
        });
        await assert.rejects(
          changed.downloadPdf(context, r.id, 1),
          (e) => e.code === "revision_conflict",
        );
        await a.remove(r.id, 2);
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
    await t.test("readiness is saved-version scoped, replay-safe, private and persistently dismissible", async () => {
      const record = await a.create(randomUUID(), blankResume("Synthetic Readiness"));
      assert.equal((await a.readiness(record.id)).evaluation, null);
      const before = await owner.resumeVersion.count({ where: { resumeId: record.id } });
      const evaluated = await a.runReadiness(record.id, 1);
      assert.equal(evaluated.evaluation.score, 0);
      assert.equal(evaluated.evaluation.resumeVersion, 1);
      assert.ok(!JSON.stringify(evaluated).includes("Synthetic Readiness"));
      assert.deepEqual(await a.runReadiness(record.id, 1), evaluated);
      const readyPath=`/api/v1/resume/${record.id}/readiness`;
      assert.equal((await gateway.request(readyPath)).status,401);
      assert.equal((await gateway.request(readyPath,{headers:{Authorization:"Bearer alice","X-Workspace-Id":actors.bob.personalWorkspace.id}})).status,403);
      assert.equal((await gateway.request(readyPath,{method:"POST",headers:{Authorization:"Bearer alice","X-Workspace-Id":actors.alice.personalWorkspace.id,"Content-Type":"application/json"},body:JSON.stringify({expectedVersion:1,score:100})})).status,422);
      assert.equal((await gateway.request(readyPath,{method:"POST",headers:{Authorization:"Bearer alice","X-Workspace-Id":actors.alice.personalWorkspace.id,"Content-Type":"application/json"},body:"{"})).status,422);

      assert.equal(await owner.resumeVersion.count({ where: { resumeId: record.id } }), before);
      await assert.rejects(b.readiness(record.id));
      await assert.rejects(b.runReadiness(record.id, 1));
      const issueId = evaluated.evaluation.checks[0].id;
      const dismissed = await a.setReadinessDismissed(record.id, 1, evaluated.evaluation.id, issueId, true);
      assert.equal(dismissed.evaluation.score, evaluated.evaluation.score);
      assert.ok((await a.readiness(record.id)).dismissed.includes(issueId));
      assert.deepEqual((await a.setReadinessDismissed(record.id,1,evaluated.evaluation.id,issueId,false)).dismissed,[]);
      const next = await a.save(record.id,1,blankResume("Synthetic Readiness"));
      const stale = await a.readiness(record.id);
      assert.equal(stale.currentVersion,2);assert.equal(stale.evaluation.resumeVersion,1);
      await assert.rejects(a.runReadiness(record.id,1),e=>e.code==="revision_conflict");
      await assert.rejects(a.setReadinessDismissed(record.id,2,evaluated.evaluation.id,issueId,true),e=>e.code==="revision_conflict");
      const rechecked=await a.runReadiness(record.id,next.currentVersion);
      assert.equal(rechecked.previous.id,evaluated.evaluation.id);
      assert.equal(rechecked.evaluation.resumeVersion,2);
      const persisted=await owner.resume.findUnique({where:{id:record.id}});
      assert.equal(persisted.atsScore,null);
      assert.equal(persisted.atsBreakdown.readiness.evaluations.length,2);
      const rollbackRecord=await a.create(randomUUID(),blankResume("Synthetic audit rollback"));
      await admin.query('ALTER TABLE "AuditOutbox" ADD CONSTRAINT readiness_audit_reject CHECK (false) NOT VALID');
      try {
        await assert.rejects(a.runReadiness(rollbackRecord.id,1));
        assert.equal((await a.readiness(rollbackRecord.id)).evaluation,null);
      } finally { await admin.query('ALTER TABLE "AuditOutbox" DROP CONSTRAINT readiness_audit_reject'); }

      await a.remove(record.id,2);
      await assert.rejects(a.readiness(record.id));await assert.rejects(a.runReadiness(record.id,2));
    });
    await t.test("legacy readiness is readable but refreshes the rubric on the same saved version",async()=>{
      const record=await a.create(randomUUID(),blankResume("Synthetic Rubric Refresh"));
      const current=await a.runReadiness(record.id,1);
      const legacy={...current.evaluation,rubricVersion:"readiness-v1",checks:current.evaluation.checks.filter(c=>c.scored!==false)};
      // Keep the same hash deliberately: rubric identity must independently gate replay.
      await owner.resume.update({where:{id:record.id},data:{atsBreakdown:{readiness:{evaluations:[legacy],dismissed:[]}}}});
      assert.equal((await a.readiness(record.id)).evaluation.rubricVersion,"readiness-v1");
      await assert.rejects(a.setReadinessDismissed(record.id,1,legacy.id,legacy.checks[0].id,true),e=>e.code==="revision_conflict");
      const updated=await a.runReadiness(record.id,1);
      assert.equal(updated.evaluation.rubricVersion,"readiness-v2");assert.notEqual(updated.evaluation.id,legacy.id);
      assert.equal(updated.previous.id,legacy.id);assert.equal(updated.evaluation.score,legacy.score);
      assert.equal(await owner.resumeVersion.count({where:{resumeId:record.id}}),1);
      assert.ok(updated.evaluation.checks.some(c=>c.id==="contact-presence"&&c.scored===false));
      assert.ok(!JSON.stringify(updated).includes("Synthetic Rubric Refresh"));
    });
    await t.test("JD assessments and Gemini apply cross client/gateway/restricted DB with isolation and freshness",async()=>{
      const d=blankResume("Synthetic ATS Flow");
      d.sections[1].entries=fromResumeContent({sections:[{id:"work",kind:"experience",label:"Experience",entries:[{id:"first",title:"Backend Engineer",description:"Built Python APIs in order to support operations.",technologies:"Python, PostgreSQL"},{id:"second",title:"Frontend Engineer",description:"Designed React interfaces for customers."}]}]}).sections[0].entries;
      d.sections[4].groups=[{id:"languages",label:"Languages",items:[{id:"python",text:"Python",hidden:false},{id:"postgres",text:"PostgreSQL",hidden:false}]}];
      const record=await a.create(randomUUID(),d),jd="Python Backend Engineer\nRequirements:\n- Python and PostgreSQL are required.\nResponsibilities:\n- Build Python APIs for operations.\n- Design PostgreSQL data storage.";
      assert.equal((await a.jdMatch(record.id)).evaluation,null);
      const general=await a.runReadiness(record.id,1),local=await a.runJdMatch(record.id,1,jd,false,false);
      assert.equal(local.evaluation.analysis,"local");assert.equal(local.evaluation.resumeVersion,1);assert.ok(local.evaluation.components.some((c)=>c.weight===30));
      assert.deepEqual(await a.runJdMatch(record.id,1,jd,false,false),local);assert.equal((await a.readiness(record.id)).evaluation.id,general.evaluation.id);
      await assert.rejects(b.jdMatch(record.id));await assert.rejects(b.runJdMatch(record.id,1,jd,false,false));
      await assert.rejects(a.runJdMatch(record.id,1,jd,true,false));
      const semantic=await a.runJdMatch(record.id,1,jd,true,true);assert.equal(semantic.evaluation.model,"gemini-3.5-flash-lite");
      // A provider model switch must not reuse a result made with the prior model.
      const persisted=await owner.resume.findUnique({where:{id:record.id}});
      const oldMeta=structuredClone(persisted.atsBreakdown);
      oldMeta.jdMatching.evaluations.at(-1).model="gemini-3.8-flash";
      await owner.resume.update({where:{id:record.id},data:{atsBreakdown:oldMeta}});
      const refreshed=await a.runJdMatch(record.id,1,jd,true,true);
      assert.notEqual(refreshed.evaluation.id,semantic.evaluation.id);
      assert.equal(refreshed.evaluation.model,"gemini-3.5-flash-lite");
      assert.equal(refreshed.evaluation.retrieval.reusedChunks,2);
      const target={type:"entry",sectionId:d.sections[1].id,itemId:"first"};
      const count=rewriteCalls;await assert.rejects(a.requestRewrite(record.id,1,target,false));await assert.rejects(b.requestRewrite(record.id,1,target,true));assert.equal(rewriteCalls,count);
      const proposal=await a.requestRewrite(record.id,1,target);assert.equal(proposal.changes.length,1);assert.equal(proposal.model,"gemini-3.5-flash-lite");
      assert.equal((await a.load(record.id)).currentVersion,1);
      await assert.rejects(b.applyRewrite(record.id,1,proposal.id));
      const applied=await a.applyRewrite(record.id,1,proposal.id);assert.equal(applied.currentVersion,2);assert.deepEqual(applied.draft.header,d.header);assert.deepEqual(applied.draft.sections[1].entries[1],d.sections[1].entries[1]);
      assert.deepEqual((await a.load(record.id)).content,applied.content);
      assert.equal((await a.jdMatch(record.id)).evaluation.resumeVersion,1);
      const replay=await a.applyRewrite(record.id,1,proposal.id);assert.equal(replay.currentVersion,2);assert.equal(await owner.resumeVersion.count({where:{resumeId:record.id}}),2);
      await assert.rejects(a.runJdMatch(record.id,1,jd,false,false),e=>e.code==="revision_conflict");
      assert.equal((await a.runJdMatch(record.id,2,jd,false,false)).evaluation.resumeVersion,2);
      const stale=await a.requestRewrite(record.id,2,{...target,itemId:"second"},true);
      await a.save(record.id,2,{...applied.draft,title:"Synthetic updated"});await assert.rejects(a.applyRewrite(record.id,2,stale.id),e=>e.code==="revision_conflict");
      beforeRewriteReturn=async()=>{const latest=await a.load(record.id);await a.save(record.id,latest.currentVersion,fromResumeContent(latest.content));};
      await assert.rejects(a.requestRewrite(record.id,3,target,true),e=>e.code==="revision_conflict");beforeRewriteReturn=async()=>{};
      const beforeCalls=rewriteCalls;
      await admin.query('ALTER TABLE "AuditOutbox" ADD CONSTRAINT ats_egress_audit_reject CHECK (false) NOT VALID');
      try{await assert.rejects(a.requestRewrite(record.id,4,target,true));assert.equal(rewriteCalls,beforeCalls);}finally{await admin.query('ALTER TABLE "AuditOutbox" DROP CONSTRAINT ats_egress_audit_reject');}
      assert.equal(await owner.userContact.count(),0);
    });
    await t.test("full tailoring crosses client/gateway/restricted DB, reviews choices, saves one independent copy and recomputes both rubrics", async () => {
      const d = blankResume("Synthetic Tailoring Person");
      d.sampleContact = { email: "synthetic-private@example.invalid", phone: "+15555550123" };
      d.sections[1].entries = fromResumeContent({sections:[{id:"work",kind:"experience",entries:[{id:"tailor-work",title:"Engineer",description:"Built Python APIs in order to support operations.",startDate:"2020-01",endDate:"2022-12"}]}]}).sections[0].entries;
      d.sections[4].groups=[{id:"tailor-skills",label:"Skills",items:[{id:"java-tailor",text:"Java",hidden:false},{id:"hidden-tailor",text:"Hidden skill",hidden:true},{id:"python-tailor",text:"Python",hidden:false}]}];
      const source=await a.create(randomUUID(),d), jd="Backend Engineer\nRequirements:\n- Python and PostgreSQL required.\nResponsibilities:\n- Build Python APIs for operations.";
      const requestId=randomUUID(),calls=fullWriterCalls,reviews=fullReviewCalls;
      const start=await a.startTailoring(source.id,1,requestId,jd);
      assert.equal(start.run.status,"queued");assert.equal(fullWriterCalls,calls,"start only queues; no provider egress");
      await assert.rejects(b.tailoring(source.id)); await assert.rejects(b.startTailoring(source.id,1,randomUUID(),jd));
      await assert.rejects(a.startTailoring(source.id,1,requestId,jd+"\nSQL essential"),e=>e.code==="revision_conflict");
      await a.startTailoring(source.id,1,requestId,jd);
      assert.equal((await a.tailoring(source.id)).run.id,requestId);
      let releaseWriter;
      const heldWriter=new Promise(resolve=>{releaseWriter=resolve;});
      beforeRewriteReturn=async()=>heldWriter;
      const firstWorker=resumes.processTailoringJobs();
      while(fullWriterCalls===calls)await new Promise(resolve=>setTimeout(resolve,5));
      await resumes.processTailoringJobs();
      releaseWriter();await firstWorker;beforeRewriteReturn=async()=>{};
      const pending=(await a.tailoring(source.id)).run;
      assert.equal(pending.status,"queued");assert.equal(pending.batchesDone,1);assert.deepEqual(pending.changes,[],"unverified draft is private");assert.equal(fullWriterCalls,calls+1,"concurrent workers respect persisted lease");
      await resumes.processTailoringJobs();
      const ready=(await a.tailoring(source.id)).run;
      assert.equal(ready.status,"ready");assert.equal(fullReviewCalls,reviews+1);assert.equal(ready.model,"gemini-3.8-flash");assert.equal(ready.promptVersion,"tailor-v2");assert.equal(ready.quality.fieldsChecked,2);
      assert.ok(ready.changes.some(c=>c.kind==="text"));assert.ok(ready.changes.some(c=>c.kind==="order"));
      await assert.rejects(b.applyTailoring(source.id,1,requestId,[],"forbidden"));
      await assert.rejects(a.applyTailoring(source.id,1,requestId,["forged"],"invalid"),e=>e.code==="invalid_input");
      const order=ready.changes.find(c=>c.kind==="order"&&c.scope==="skills"), selections=[order.id];
      await admin.query(`ALTER TABLE "AuditOutbox" ADD CONSTRAINT tailor_copy_reject CHECK ((payload->>'action') <> 'resume.created') NOT VALID`);
      try { await assert.rejects(a.applyTailoring(source.id,1,requestId,selections,"Reviewed copy"));assert.equal((await a.tailoring(source.id)).run.status,"ready"); }
      finally { await admin.query('ALTER TABLE "AuditOutbox" DROP CONSTRAINT tailor_copy_reject'); }
      const count=await owner.resume.count({where:{ownerUserId:alice.id}});
      const copy=await a.applyTailoring(source.id,1,requestId,selections,"Reviewed copy"), copyDoc=fromResumeContent(copy.content);
      assert.notEqual(copy.id,source.id);assert.equal(copy.status,"draft");assert.equal(copy.title,"Reviewed copy");assert.equal(copyDoc.title,"Reviewed copy");
      assert.deepEqual(copyDoc.header,d.header);assert.deepEqual(copyDoc.sampleContact,d.sampleContact);assert.deepEqual(copyDoc.sections[1],d.sections[1],"rejected text proposals stay original");
      assert.deepEqual(copyDoc.sections[4].groups[0].items.map(v=>v.id),["python-tailor","hidden-tailor","java-tailor"]);
      assert.deepEqual((await a.load(source.id)).content,source.content);assert.equal((await a.load(source.id)).currentVersion,1);
      assert.equal((await a.runJdMatch(copy.id,1,jd,false,false)).evaluation.score,(await a.jdMatch(copy.id)).evaluation.score);
      assert.equal((await a.readiness(copy.id)).evaluation.resumeVersion,1);
      assert.equal((await a.applyTailoring(source.id,1,requestId,selections,"Reviewed copy")).id,copy.id);
      assert.equal(await owner.resume.count({where:{ownerUserId:alice.id}}),count+1);assert.equal(await owner.resumeVersion.count({where:{resumeId:source.id}}),1);
      await assert.rejects(a.applyTailoring(source.id,1,requestId,[],"Reviewed copy"),e=>e.code==="revision_conflict");
      const pdf=await a.download(copy.id,1);assert.equal(await pdf.slice(0,5).text(),"%PDF-");
    });
    await t.test("tailoring cancellation, stale inputs, provider failure and restart recovery preserve the source", async () => {
      const d=blankResume("Synthetic Recovery");
      d.sections[1].entries=fromResumeContent({sections:[{id:"work",kind:"experience",entries:[{id:"recovery-entry",title:"Engineer",description:"Built Python APIs in order to support operations."}]}]}).sections[0].entries;
      const source=await a.create(randomUUID(),d),jd="Backend Engineer\nRequirements:\n- Python required.\nResponsibilities:\n- Build Python APIs for operations.";
      let runId=randomUUID();await a.startTailoring(source.id,1,runId,jd);
      beforeRewriteReturn=async()=>{await a.cancelTailoring(source.id,runId);};
      try { await resumes.processTailoringJobs(); } finally { beforeRewriteReturn=async()=>{}; }
      assert.equal((await a.tailoring(source.id)).run.status,"cancelled");await assert.rejects(a.applyTailoring(source.id,1,runId,[],"cancelled"));
      runId=randomUUID();await a.startTailoring(source.id,1,runId,jd);
      const row=await owner.resume.findUnique({where:{id:source.id}}), meta=structuredClone(row.atsBreakdown);
      meta.tailoring.runs.at(-1).run.status="drafting";meta.tailoring.runs.at(-1).lease=randomUUID();meta.tailoring.runs.at(-1).leaseUntil=Date.now()-1;
      await owner.resume.update({where:{id:source.id},data:{atsBreakdown:meta}});
      await createResumeUseCases(runtime,Date.now,undefined,providers).processTailoringJobs();
      assert.equal((await a.tailoring(source.id)).run.batchesDone,1,"new worker recovers abandoned lease");
      await resumes.processTailoringJobs();
      assert.equal((await a.tailoring(source.id)).run.status,"ready");
      await a.save(source.id,1,{...d,title:"New source revision"});
      await assert.rejects(a.applyTailoring(source.id,1,runId,[],"stale"),e=>e.code==="revision_conflict");
      runId=randomUUID();await a.startTailoring(source.id,2,runId,jd);
      beforeRewriteReturn=async()=>{throw new Error("PRIVATE PROVIDER BODY");};
      try { await resumes.processTailoringJobs(); } finally { beforeRewriteReturn=async()=>{}; }
      const failed=(await a.tailoring(source.id)).run;assert.equal(failed.status,"failed");assert.equal(failed.changes.length,0);assert.ok(!failed.error.includes("PRIVATE"));
      assert.equal((await a.load(source.id)).currentVersion,2);assert.deepEqual((await a.load(source.id)).content.editorDraft.sections,d.sections);
      runId=randomUUID();await a.startTailoring(source.id,2,runId,jd);await resumes.processTailoringJobs();await resumes.processTailoringJobs();assert.equal((await a.tailoring(source.id)).run.status,"ready");
    });
    await t.test("full tailoring repairs only rejected fields once and never exposes unverified candidates",async()=>{
      const d=blankResume("Synthetic Correction");
      d.sections[1].entries=fromResumeContent({sections:[{id:"work",kind:"experience",entries:[{id:"repair-entry",title:"Engineer",description:"Built Python APIs in order to support operations."}]}]}).sections[0].entries;
      const source=await a.create(randomUUID(),d),jd="Backend Engineer\nRequirements: Python required.\nResponsibilities: Build Python APIs for operations.",runId=randomUUID();
      const writer=providers.tailor;let calls=0;
      providers.tailor=async(input,job,revision)=>{
        calls++;
        if(revision){assert.equal(input.fields.length,1);assert.equal(input.fields[0].field,"fact-0");assert.equal(revision.review.checks[0].supported,false);return {changes:[{field:"fact-0",proposed:"Developed Python APIs to support operations.",facts:["fact-0"]}]};}
        const result=await writer(input,job);result.changes.find(c=>c.field==="fact-0").proposed="Developed Python APIs, reducing costs by 35%.";return result;
      };
      try {
        await a.startTailoring(source.id,1,runId,jd);
        await resumes.processTailoringJobs();await resumes.processTailoringJobs();
        const pending=(await a.tailoring(source.id)).run;assert.equal(pending.status,"queued");assert.equal(pending.batchesTotal,4);assert.deepEqual(pending.changes,[]);
        await resumes.processTailoringJobs();await resumes.processTailoringJobs();
        const ready=(await a.tailoring(source.id)).run;assert.equal(ready.status,"ready");assert.equal(calls,2);assert.equal(ready.batchesDone,4);assert.equal(ready.quality.retainedOriginal,0);assert.ok(ready.changes.some(c=>c.id==="fact-0"));assert.ok(!JSON.stringify(ready.changes).includes("35%"));
        const copy=await a.applyTailoring(source.id,1,runId,ready.changes.map(c=>c.id),"Corrected copy");assert.equal(copy.currentVersion,1);assert.equal((await a.load(source.id)).currentVersion,1);assert.deepEqual((await a.load(source.id)).content,source.content);
        const row=await owner.resume.findUnique({where:{id:source.id}});assert.equal(row.atsBreakdown.tailoring.runs.at(-1).draft,null);assert.equal(row.atsBreakdown.tailoring.runs.at(-1).review,null);
      } finally {providers.tailor=writer;}
    });
    await t.test("second failed semantic review retains originals; cancellation during review discards private draft",async()=>{
      const d=blankResume("Synthetic Review Failure");d.sections[1].entries=fromResumeContent({sections:[{id:"work",kind:"experience",entries:[{id:"review-entry",title:"Engineer",description:"Built Python APIs in order to support operations."}]}]}).sections[0].entries;
      const source=await a.create(randomUUID(),d),jd="Backend Engineer\nRequirements: Python required.\nResponsibilities: Build Python APIs for operations.";
      const reviewer=providers.verifyTailoring;
      providers.verifyTailoring=async(input)=>({checks:input.fields.map(f=>({field:f.field,supported:f.kind==="summary",complete:true}))});
      try {
        let runId=randomUUID();await a.startTailoring(source.id,1,runId,jd);for(let i=0;i<4;i++)await resumes.processTailoringJobs();
        const ready=(await a.tailoring(source.id)).run;assert.equal(ready.status,"ready");assert.equal(ready.quality.retainedOriginal,1);assert.ok(!ready.changes.some(c=>c.id==="fact-0"));assert.ok(ready.warnings.some(w=>w.includes("Kept 1 original")));
        runId=randomUUID();await a.startTailoring(source.id,1,runId,jd);await resumes.processTailoringJobs();
        providers.verifyTailoring=async(input)=>{await a.cancelTailoring(source.id,runId);return reviewer(input);};
        await resumes.processTailoringJobs();const cancelled=(await a.tailoring(source.id)).run;assert.equal(cancelled.status,"cancelled");assert.deepEqual(cancelled.changes,[]);
        const row=await owner.resume.findUnique({where:{id:source.id}});assert.equal(row.atsBreakdown.tailoring.runs.at(-1).draft,null);assert.equal(row.atsBreakdown.tailoring.runs.at(-1).review,null);
      } finally {providers.verifyTailoring=reviewer;}
    });
    await t.test("vector cache uses current owned version, deduplicates documents, denies cross-owner RLS, purges on delete",async()=>{
      const d=blankResume("Synthetic Vector Lifecycle");
      d.sections[1].entries=fromResumeContent({sections:[{id:"work",kind:"experience",label:"Experience",entries:[{id:"entry",title:"Engineer",description:"Built Python APIs for operations."}]}]}).sections[0].entries;
      const record=await a.create(randomUUID(),d);
      const jd="Data Engineer\nRequirements:\n- Python and SQL are required.\nResponsibilities:\n- Build Python pipelines for operations.";
      const first=await a.runJdMatch(record.id,1,jd,true,true);
      assert.equal(first.evaluation.retrieval.indexedChunks,1);
      assert.equal(first.evaluation.retrieval.reusedChunks,0);
      assert.equal(first.evaluation.retrieval.hits.length,1);
      const calls=embeddingCalls;await a.runJdMatch(record.id,1,jd,true,true);assert.equal(embeddingCalls,calls);
      const second=await a.runJdMatch(record.id,1,jd+"\n- Maintain pipelines.",true,true);
      assert.equal(second.evaluation.retrieval.reusedChunks,1);
      assert.equal((await runtime.$queryRaw`SELECT count(*)::int AS count FROM "ResumeSearchChunk"`)[0].count,0,"unscoped runtime sees no vectors");
      const visible=async(user,workspace)=>runtime.$transaction(async tx=>{
       await tx.$executeRaw`SELECT set_config('resume_forge.actor',${user},true),set_config('resume_forge.workspace',${workspace},true)`;
       return tx.$queryRaw`SELECT "versionId" FROM "ResumeSearchChunk" WHERE "resumeId"=${record.id}::uuid`;
      });
      assert.equal((await visible(bob.id,bob.personalWorkspace.id)).length,0);
      assert.equal((await visible(alice.id,alice.personalWorkspace.id)).length,1);
      await a.save(record.id,1,d);
      assert.equal((await visible(alice.id,alice.personalWorkspace.id)).length,0,"old vectors invisible immediately after save");
      await a.runJdMatch(record.id,2,jd,true,true);
      assert.equal((await visible(alice.id,alice.personalWorkspace.id)).length,1);
      assert.equal((await admin.query('SELECT count(*)::int AS count FROM "ResumeSearchChunk" WHERE "resumeId"=$1',[record.id])).rows[0].count,1,"old cache purged on new index");
      beforeEmbeddingReturn=async()=>{await a.save(record.id,2,d);};
      await assert.rejects(a.runJdMatch(record.id,2,jd+"\n- Design storage.",true,true),e=>e.code==="revision_conflict");beforeEmbeddingReturn=async()=>{};
      await a.remove(record.id,3);
      assert.equal((await admin.query('SELECT count(*)::int AS count FROM "ResumeSearchChunk" WHERE "resumeId"=$1',[record.id])).rows[0].count,0);
      await a.restore(record.id,3);
      assert.equal((await visible(alice.id,alice.personalWorkspace.id)).length,0,"restore requires new consented indexing");
      const beforeCalls=embeddingCalls;
      await admin.query('ALTER TABLE "AuditOutbox" ADD CONSTRAINT vector_audit_reject CHECK(false) NOT VALID');
      try{await assert.rejects(a.runJdMatch(record.id,3,jd,true,true));assert.equal(embeddingCalls,beforeCalls);}finally{await admin.query('ALTER TABLE "AuditOutbox" DROP CONSTRAINT vector_audit_reject');}
      assert.equal(await owner.userContact.count(),0);
    });
    await t.test("vector rollback and rebuild preserve immutable source, contacts and audit records",async()=>{
      const source=async()=>Promise.all(["Resume","ResumeVersion","UserContact","AuditOutbox"].map(async table=>
        (await admin.query(`SELECT to_jsonb(t) AS row FROM "${table}" t ORDER BY "id"`)).rows));
      const before=await source();
      await admin.query(readFileSync(new URL("../../../docs/resume-vector-rollback.sql",import.meta.url),"utf8"));
      assert.deepEqual(await source(),before);
      assert.equal((await admin.query(`SELECT to_regclass('public."ResumeSearchChunk"') AS cache`)).rows[0].cache,null);
      await admin.query(readFileSync(new URL("../../../packages/prisma-client/prisma/migrations/20261009130000_resume_vectors/migration.sql",import.meta.url),"utf8"));
      assert.deepEqual(await source(),before);
      assert.equal((await admin.query('SELECT count(*)::int AS count FROM "ResumeSearchChunk"')).rows[0].count,0);
    });
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
