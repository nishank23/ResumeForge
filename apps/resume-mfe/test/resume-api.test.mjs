import test from "node:test";
import assert from "node:assert/strict";
import { loadResumeApi } from "./resume-api-loader.mjs";
import { editorDocumentSchema } from "@resume-forge/shared-types";
import {
  createHistory,
  editorHistory,
  isDirty,
} from "../src/editor-history.ts";
import { emptyEntry } from "../src/editor-draft.ts";
const { blankResume, toResumeContent, fromResumeContent, createResumeApi } =
  await loadResumeApi();
const workspaceId = "22222222-2222-4222-8222-222222222222",
  id = "11111111-1111-4111-8111-111111111111";
const envelope = (data) => new Response(JSON.stringify({ data }));
const tailoringFixture = () => ({
  currentVersion: 1, available: true,
  run: {
    id: "33333333-3333-4333-8333-333333333333", sourceVersion: 1, status: "ready",
    model: "gemini-3.8-flash", promptVersion: "tailor-v2", additionalFacts: [],
    quality: { sourceWords: 200, proposedWords: 210, fieldsChecked: 5, fieldsRewritten: 4, retainedOriginal: 1 }, warnings: ["Kept one original field."],
    jobTitle: "Backend Engineer", jdText: "Backend Engineer. Build Python APIs and PostgreSQL systems for operations.",
    requirements: [], responsibilities: [], createdAt: "2026-10-14T18:00:00.000Z", expiresAt: "2026-10-14T18:30:00.000Z",
    batchesDone: 2, batchesTotal: 2,
    before: { score: 50, matched: [], missing: [], statedYears: null, datedYears: null, experienceLevel: "unknown" },
    after: null, changes: [], copyId: null, error: null,
  },
});
test("tailoring client accepts full-writer metadata and restores legacy defaults without dropping quality", async () => {
 const current=tailoringFixture(),api=createResumeApi(async()=>envelope(current),workspaceId);
 assert.deepEqual(await api.tailoring(id),current);
 assert.deepEqual(await api.startTailoring(id,1,current.run.id,current.run.jdText),current);
 assert.deepEqual(await api.cancelTailoring(id,current.run.id),current);
 const legacy=tailoringFixture();for(const key of ["model","promptVersion","quality","warnings"])delete legacy.run[key];
 const restored=await createResumeApi(async()=>envelope(legacy),workspaceId).tailoring(id);
 assert.equal(restored.run.model,"gemini-3.5-flash-lite");assert.equal(restored.run.promptVersion,"tailor-v1");assert.equal(restored.run.quality,null);assert.deepEqual(restored.run.warnings,[]);
});
test("tailoring protocol failures reject results with a safe refresh message instead of raw schema JSON", async () => {
 for(const value of [null,{...tailoringFixture(),run:{...tailoringFixture().run,privateDebug:"PRIVATE VALUE"}},{...tailoringFixture(),run:{...tailoringFixture().run,quality:{...tailoringFixture().run.quality,sourceWords:-1}}}]){
  const api=createResumeApi(async()=>envelope(value),workspaceId);
  for(const action of [()=>api.tailoring(id),()=>api.startTailoring(id,1,tailoringFixture().run.id,tailoringFixture().run.jdText),()=>api.cancelTailoring(id,tailoringFixture().run.id)])await assert.rejects(action,e=>e.code==="invalid_response"&&e.message.includes("Refresh this page")&&!/PRIVATE|unrecognized_keys|ZodError/.test(e.message));
 }
});
test("blank creation uses only account name; includes no fictional professional/contact facts", () => {
  const d = blankResume("Synthetic Person");
  assert.equal(d.synthetic, false);
  assert.equal(d.header.firstName, "Synthetic");
  assert.equal(d.header.lastName, "Person");
  assert.equal(d.sampleContact.email, "");
  assert.ok(
    d.sections.every(
      (s) => !s.entries.length && s.groups.every((g) => !g.items.length),
    ),
  );
  assert.deepEqual(fromResumeContent(toResumeContent(d)), d);
});
test("lossless rich text, dates, language identity, visibility and formatting round trip", () => {
  const d = blankResume();
  const e = emptyEntry("entry-1");
  e.dates = {
    startMonth: "3",
    startYear: "2020",
    endMonth: "11",
    endYear: "2024",
    yearOnly: false,
    current: false,
  };
  e.hidden = true;
  e.description = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Supported detail", marks: [{ type: "bold" }] },
        ],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: "Nested detail",
                    marks: [{ type: "italic" }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  d.sections[1].entries = [e];
  d.sections[4].languages = [
    {
      id: "lang-1",
      text: "Language from user",
      hidden: false,
      proficiency: "Native",
    },
  ];
  d.appearance = {
    sectionGap: 18,
    itemGap: 12,
    top: 44,
    right: 48,
    bottom: 54,
    left: 48,
    typography: Object.fromEntries(
      ["section", "heading", "subheading", "body"].map((k) => [
        k,
        { font: "Georgia", size: 14, lineHeight: 1.5, color: "#222222" },
      ]),
    ),
  };
  assert.deepEqual(
    fromResumeContent(JSON.parse(JSON.stringify(toResumeContent(d)))),
    d,
  );
});
test("strict schema rejects executable markup, unsafe links, duplicate IDs and excessive nesting", () => {
  const d = blankResume();
  d.sections[0].summary = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "safe",
            marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
          },
        ],
      },
    ],
  };
  assert.equal(editorDocumentSchema.safeParse(d).success, false);
  const safe = blankResume();
  safe.sections[1].id = safe.sections[0].id;
  assert.equal(editorDocumentSchema.safeParse(safe).success, false);
});
test("checkpoint acknowledgement does not mark edits made during a save as saved", () => {
  const original = blankResume(),
    sent = { ...original, title: "Sent" },
    newer = { ...original, title: "Still typing" };
  let h = createHistory(original);
  h = editorHistory(h, { type: "edit", value: sent });
  h = editorHistory(h, { type: "edit", value: newer });
  h = editorHistory(h, { type: "checkpoint", value: sent });
  assert.equal(h.current.title, "Still typing");
  assert.equal(h.saved.title, "Sent");
  assert.equal(isDirty(h), true);
});
test("API uses scoped expected versions; conflict keeps input and never retries a write", async () => {
  let calls = 0;
  const d = blankResume(),
    before = structuredClone(d);
  const api = createResumeApi(async (path, options) => {
    calls++;
    assert.equal(path, `/api/v1/resume/${id}`);
    assert.equal(options.headers["X-Workspace-Id"], workspaceId);
    assert.equal(JSON.parse(options.body).expectedVersion, 4);
    return new Response(
      JSON.stringify({ error: { code: "revision_conflict" } }),
      { status: 409 },
    );
  }, workspaceId);
  await assert.rejects(
    api.save(id, 4, d),
    (e) => e.code === "revision_conflict",
  );
  assert.equal(calls, 1);
  assert.deepEqual(d, before);
});
test("API rejects foreign workspace responses and fake sample identifiers", async () => {
  const api = createResumeApi(
    async () =>
      envelope([
        {
          id,
          workspaceId: id,
          title: "Private",
          currentVersion: 1,
          status: "draft",
          updatedAt: new Date().toISOString(),
        },
      ]),
    workspaceId,
  );
  await assert.rejects(api.list(), (e) => e.code === "invalid_response");
  await assert.rejects(api.load("res-draft-01"), (e) => e.code === "not_found");
});
test("upload rejects unsupported and oversized files before a request", async () => {
  let calls = 0;
  const api = createResumeApi(async () => {
    calls++;
    return envelope({});
  }, workspaceId);
  await assert.rejects(
    api.parse(new File(["x"], "resume.doc")),
    (e) => e.code === "unsupported_media_type",
  );
  await assert.rejects(
    api.parse({ name: "resume.pdf", size: 10 * 1024 * 1024 + 1 }),
    (e) => e.code === "file_too_large",
  );
  assert.equal(calls, 0);
});

test("imported profile links, project details and language values survive the editor adapter and save envelope", () => {
  const content = {
    title: "Synthetic import",
    header: {
      firstName: "Alex",
      lastName: "Stone",
      links: [
        {
          id: "header-link",
          label: "LinkedIn",
          url: "https://www.linkedin.com/in/alex-profile",
        },
        {
          id: "unsafe-header-link",
          label: "Unsafe",
          url: "javascript:alert(1)",
        },
      ],
    },
    sections: [
      {
        id: "projects",
        kind: "projects",
        label: "Projects",
        entries: [
          {
            id: "project",
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
                text: "Developed supported functionality.",
                hidden: false,
              },
            ],
          },
        ],
      },
      {
        id: "skills",
        kind: "skills",
        label: "Skills",
        groups: [
          {
            id: "programming",
            label: "Programming Languages",
            items: [{ id: "python", text: "Python", hidden: false }],
          },
          {
            id: "spoken",
            label: "Languages",
            items: [{ id: "portuguese", text: "Portuguese", hidden: false }],
          },
        ],
      },
      {
        id: "languages",
        kind: "languages",
        label: "Languages",
        entries: [
          {
            id: "language-container",
            title: "Languages",
            bullets: [{ id: "english", text: "English", hidden: false }],
          },
        ],
      },
    ],
  };
  const draft = fromResumeContent(content);
  assert.deepEqual(
    draft.header.links.map((l) => l.id),
    ["header-link"],
  );
  assert.deepEqual(
    draft.sections[1].groups.map((g) => g.label),
    ["Programming Languages"],
  );
  assert.deepEqual(
    draft.sections[1].languages.map((l) => l.text),
    ["Portuguese"],
  );
  assert.deepEqual(
    draft.sections[2].languages.map((l) => l.text),
    ["English"],
  );
  assert.deepEqual(draft.sections[2].entries, []);
  const project = draft.sections[0].entries[0];
  assert.equal(project.subtitle, "Individual Project");
  assert.equal(project.dates.startMonth, "2");
  assert.equal(project.dates.startYear, "2026");
  assert.equal(project.dates.endMonth, "4");
  assert.equal(project.links[0].url, "https://example.com/atlas");
  const saved = toResumeContent(draft);
  assert.deepEqual(saved.header.links, draft.header.links);
  assert.deepEqual(fromResumeContent(JSON.parse(JSON.stringify(saved))), draft);
  const unsafe = structuredClone(draft);
  unsafe.header.links[0].url = "javascript:alert(1)";
  assert.equal(editorDocumentSchema.safeParse(unsafe).success, false);
  const duplicate = structuredClone(draft);
  duplicate.header.links[0].id = "project-link";
  assert.equal(editorDocumentSchema.safeParse(duplicate).success, false);
});

test("delete and restore send explicit saved versions, reject mismatched responses and never delete on stale data", async () => {
  const calls = [];
  const api = createResumeApi(async (path, options) => {
    calls.push({ path, options });
    return envelope({ deleted: true, id });
  }, workspaceId);
  await api.remove(id, 4);
  assert.equal(calls[0].options.method, "DELETE");
  assert.equal(JSON.parse(calls[0].options.body).expectedVersion, 4);
  await assert.rejects(api.remove(id, 0));
  assert.equal(calls.length, 1);
  const wrong = createResumeApi(
    async () => envelope({ deleted: true, id: workspaceId }),
    workspaceId,
  );
  await assert.rejects(
    wrong.remove(id, 4),
    (e) => e.code === "invalid_response",
  );
  const restored = createResumeApi(async (path, options) => {
    assert.equal(path, `/api/v1/resume/${id}/restore`);
    assert.equal(JSON.parse(options.body).expectedVersion, 4);
    return envelope({
      id,
      workspaceId,
      title: "Restored",
      currentVersion: 4,
      status: "draft",
      updatedAt: new Date().toISOString(),
      content: toResumeContent(blankResume()),
    });
  }, workspaceId);
  assert.equal((await restored.restore(id, 4)).currentVersion, 4);
});
test("PDF downloads validate the saved version, binary signature and response headers", async () => {
  const api = createResumeApi(async (path, options) => {
    assert.equal(path, `/api/v1/resume/${id}/pdf?version=4`);
    assert.equal(options.headers["X-Workspace-Id"], workspaceId);
    return new Response("%PDF-valid", {
      headers: { "Content-Type": "application/pdf", "X-Resume-Version": "4" },
    });
  }, workspaceId);
  assert.equal(await (await api.download(id, 4)).text(), "%PDF-valid");
  for (const response of [
    new Response("%PDF-valid", {
      headers: { "Content-Type": "text/html", "X-Resume-Version": "4" },
    }),
    new Response("%PDF-valid", {
      headers: { "Content-Type": "application/pdf", "X-Resume-Version": "3" },
    }),
    new Response("wrong", {
      headers: { "Content-Type": "application/pdf", "X-Resume-Version": "4" },
    }),
  ])
    await assert.rejects(
      createResumeApi(async () => response, workspaceId).download(id, 4),
      (e) => e.code === "invalid_response",
    );
  await assert.rejects(
    createResumeApi(
      async () =>
        new Response('{"error":{"code":"revision_conflict"}}', { status: 409 }),
      workspaceId,
    ).download(id, 4),
    (e) => e.code === "revision_conflict",
  );
});

test("readiness client rejects invalid identifiers and malformed assessment results", async()=>{
 const result={currentVersion:1,evaluation:null,previous:null,dismissed:[]};
 const api=createResumeApi(async()=>envelope(result),workspaceId);
 assert.deepEqual(await api.readiness(id),result);
 await assert.rejects(api.runReadiness(id,1),e=>e.code==="invalid_response");
 await assert.rejects(api.readiness("sample"),e=>e.code==="invalid_input");
 const invalid=createResumeApi(async()=>envelope({...result,currentVersion:0}),workspaceId);
 await assert.rejects(invalid.readiness(id),e=>e.code==="invalid_response");
});

test("language/proficiency import pairs retain separate editable fields",async()=>{
 const {fromResumeContent}=await loadResumeApi();
 const draft=fromResumeContent({title:"Synthetic language import",sections:[{id:"langs",kind:"languages",label:"Languages",entries:[{id:"lang-entry",title:"Languages",bullets:[{id:"english",text:"English — Fluent"},{id:"japanese",text:"Japanese — JLPT N5 (Learning)"}]}]}]});
 assert.deepEqual(draft.sections[0].languages.map(l=>[l.id,l.text,l.proficiency]),[["english","English","Fluent"],["japanese","Japanese","JLPT N5 (Learning)"]]);
});


test("explicit rewrite action sends only saved scope and processing intent, never draft/contact text", async()=>{
  const target={type:"entry",sectionId:"work",itemId:"first"};
  const proposal={id:"33333333-3333-4333-8333-333333333333",resumeId:id,resumeVersion:4,versionId:"44444444-4444-4444-8444-444444444444",target,inputHash:"a".repeat(64),createdAt:new Date().toISOString(),model:"gemini-3.5-flash-lite",changes:[],appliedVersion:null};
  let sent;
  const api=createResumeApi(async(path,options)=>{
    assert.equal(path,`/api/v1/resume/${id}/ai-rewrite`);
    sent=JSON.parse(options.body);return envelope(proposal);
  },workspaceId);
  assert.deepEqual(await api.requestRewrite(id,4,target),proposal);
  assert.deepEqual(sent,{expectedVersion:4,target,consent:true});
});

const atsFixture = () => ({
  currentVersion: 1,
  evaluation: {
    id: "33333333-3333-4333-8333-333333333333",
    resumeId: id,
    versionId: "44444444-4444-4444-8444-444444444444",
    resumeVersion: 1,
    inputHash: "a".repeat(64),
    jdHash: "b".repeat(64),
    evaluatedAt: "2026-10-23T10:00:00.000Z",
    assessment: {
      rubricVersion: "ats-evidence-v1",
      model: "synthetic-gemini",
      score: 50,
      coverage: {
        required: { supported: 1, total: 2 },
        preferred: { supported: 0, total: 0 },
      },
      requirements: [
        {
          id: "python",
          requirement: "Build Python APIs",
          jdQuote: "Build Python APIs",
          importance: "required",
          status: "supported",
          evidence: [
            { sourceId: "experience:role", quote: "Built Python APIs." },
          ],
        },
        {
          id: "operations",
          requirement: "Production operations",
          jdQuote: "Production operations",
          importance: "required",
          status: "missing",
          evidence: [],
        },
      ],
      warnings: [],
    },
  },
});
test("ATS client loads saved evidence without generating a paid assessment", async () => {
  const calls = [];
  const api = createResumeApi(async (path, options) => {
    calls.push({ path, ...options });
    return envelope({ currentVersion: 1, evaluation: null });
  }, workspaceId);
  assert.deepEqual(await api.atsAssessment(id), {
    currentVersion: 1,
    evaluation: null,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].path, `/api/v1/resume/${id}/ats-assessment`);
  assert.equal(calls[0].headers["X-Workspace-Id"], workspaceId);
  assert.equal(calls[0].body, undefined);
});
test("ATS client submits only explicit JD consent and expected saved version", async () => {
  const calls = [];
  const jdText =
    "Build Python APIs and PostgreSQL services. Production operations experience is required.";
  const api = createResumeApi(async (path, options) => {
    calls.push({ path, ...options });
    return envelope(atsFixture());
  }, workspaceId);
  assert.deepEqual(
    await api.runAtsAssessment(id, 1, `  ${jdText}  `),
    atsFixture(),
  );
  assert.equal(calls[0].method, "POST");
  assert.deepEqual(JSON.parse(calls[0].body), {
    expectedVersion: 1,
    jdText,
    consent: true,
  });
  await assert.rejects(
    api.runAtsAssessment(id, 1, "short"),
    (error) => error.code === "invalid_input",
  );
  assert.equal(calls.length, 1);
});
test("ATS client rejects wrong identity, stale POST versions, invalid evidence and arbitrary scores", async () => {
  const jdText =
    "Build Python APIs and PostgreSQL services. Production operations experience is required.";
  const mutations = [
    (value) => {
      value.evaluation.resumeId = workspaceId;
    },
    (value) => {
      value.evaluation.resumeVersion = 2;
    },
    (value) => {
      value.currentVersion = 2;
    },
    (value) => {
      value.evaluation.assessment.score = 99;
    },
    (value) => {
      value.evaluation.assessment.requirements[0].evidence = [];
    },
    (value) => {
      value.evaluation.privateDebug = "PRIVATE PROVIDER DEBUG";
    },
  ];
  for (const mutate of mutations) {
    const value = atsFixture();
    mutate(value);
    const api = createResumeApi(async () => envelope(value), workspaceId);
    await assert.rejects(
      api.runAtsAssessment(id, 1, jdText),
      (error) =>
        error.code === "invalid_response" && !error.message.includes("PRIVATE"),
    );
  }
});
test("ATS client reports safe 401 and provider errors without exposing provider response text", async () => {
  for (const [status, code, expected] of [
    [401, "unauthenticated", /Sign in again/],
    [503, "provider_unavailable", /unavailable/],
  ]) {
    const api = createResumeApi(
      async () =>
        new Response(
          JSON.stringify({
            error: { code, message: "PRIVATE PROVIDER DEBUG" },
          }),
          { status },
        ),
      workspaceId,
    );
    await assert.rejects(
      api.atsAssessment(id),
      (error) =>
        expected.test(error.message) && !error.message.includes("PRIVATE"),
    );
  }
});
