import test from "node:test";
import assert from "node:assert/strict";
import { applyTailoringPreview } from "@resume-forge/shared-types";
import {
  tailoringFields,
  fieldBatches,
  groundedBatch,
  localAssessment,
  completeChanges,
} from "../dist/tailoring/facts.js";
import { loadResumeApi } from "../../../apps/resume-mfe/test/resume-api-loader.mjs";
import { fullTailoringSource, inspectFullDraft, verifiedFullChanges } from "../dist/tailoring/writer.js";
import { createAiProviders, TAILORING_MODEL, GEMINI_MODEL } from "../dist/ats/ai.js";
const { blankResume, fromResumeContent } = await loadResumeApi();
const jd =
  "Backend Engineer\nRequirements:\n- Python and PostgreSQL are required.\nResponsibilities:\n- Build Python APIs for operations.";
function draft() {
  const d = blankResume("Private Identity");
  d.sampleContact = { email: "private@example.invalid", phone: "+12345678901" };
  d.sections[1].entries = fromResumeContent({
    sections: [
      {
        id: "work",
        kind: "experience",
        entries: [
          {
            id: "work-a",
            title: "Engineer",
            description: "Built Python APIs in order to support operations.",
          },
          {
            id: "work-hidden",
            title: "Hidden role",
            hidden: true,
            description: "SECRET HIDDEN WORK",
          },
        ],
      },
    ],
  }).sections[0].entries;
  d.sections[4].groups = [
    {
      id: "stack",
      label: "Stack",
      items: [
        { id: "java", text: "Java", hidden: false },
        { id: "hidden-skill", text: "Private skill", hidden: true },
        { id: "python", text: "Python", hidden: false },
      ],
    },
  ];
  return d;
}
test("tailoring provider projection excludes contacts, identity, hidden content, metadata and labels", () => {
  const fields = tailoringFields(draft());
  assert.equal(fields.length, 1);
  const provider = JSON.stringify(
    fields.map((f) => ({ field: f.id, original: f.original })),
  );
  for (const secret of [
    "Private Identity",
    "private@example.invalid",
    "+12345678901",
    "SECRET",
    "Engineer",
    "Private skill",
  ])
    assert.ok(!provider.includes(secret));
  const unsafe = draft();
  unsafe.sections[1].entries[0].description.content[0].content[0].text +=
    " Email private@example.invalid";
  assert.throws(() => tailoringFields(unsafe));
});
test("whole-tailor grounding permits clarity but rejects metrics, new skills, leadership and unknown IDs", () => {
  const d = draft(),
    batch = tailoringFields(d);
  const changes = groundedBatch(d, batch, [
    {
      field: batch[0].id,
      proposed: batch[0].original.replace("in order to", "to"),
    },
  ]);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].facts[0], batch[0].id);
  for (const proposed of [
    "Built Python APIs, reducing costs by 35%.",
    "Led Python API teams for operations.",
    "Built Python and Spark APIs to support operations.",
  ])
    assert.throws(() =>
      groundedBatch(d, batch, [{ field: batch[0].id, proposed }]),
    );
  assert.throws(() =>
    groundedBatch(d, batch, [
      { field: "forged", proposed: "Built Python APIs." },
    ]),
  );
  assert.throws(() =>
    groundedBatch(d, batch, [
      { field: batch[0].id, proposed: "x" },
      { field: batch[0].id, proposed: "x" },
    ]),
  );
});
test("review selection retains original facts, hidden positions, contacts, dates and source object", () => {
  const d = draft(),
    before = structuredClone(d),
    fields = tailoringFields(d);
  const changes = completeChanges(
    d,
    jd,
    groundedBatch(d, fields, [
      {
        field: fields[0].id,
        proposed: fields[0].original.replace("in order to", "to"),
      },
    ]),
  );
  const order = changes.find((c) => c.kind === "order");
  assert.ok(order);
  const next = applyTailoringPreview(d, changes, [order.id]);
  assert.deepEqual(d, before);
  assert.deepEqual(next.header, d.header);
  assert.deepEqual(next.sampleContact, d.sampleContact);
  assert.deepEqual(next.sections[1], d.sections[1]);
  assert.deepEqual(
    next.sections[4].groups[0].items.map((i) => i.id),
    ["python", "hidden-skill", "java"],
  );
  assert.throws(() => applyTailoringPreview(d, changes, [order.id, order.id]));
  assert.throws(() => applyTailoringPreview(d, changes, ["forged"]));
  assert.throws(() =>
    applyTailoringPreview(
      d,
      [{ ...order, proposedIds: ["forged"] }],
      [order.id],
    ),
  );
  assert.deepEqual(applyTailoringPreview(d, changes, []), d);
});
test("new summaries use complete source facts and never insert a missing JD qualification", () => {
  const d = draft(),
    changes = completeChanges(
      d,
      jd + "\nSpark and HR migration are essential.",
      [],
    );
  const summary = changes.find((c) => c.id === "supported-summary");
  assert.ok(summary);
  assert.equal(summary.proposed, tailoringFields(d)[0].original);
  assert.ok(!summary.proposed.includes("Spark"));
  assert.ok(!summary.proposed.includes("HR"));
  assert.deepEqual(summary.facts, ["fact-0"]);
});
test("dated years count overlapping roles once and incomplete dates remain unknown", () => {
  const d = draft(),
    first = d.sections[1].entries[0],
    second = structuredClone(first);
  first.dates = {
    startYear: "2020",
    startMonth: "1",
    endYear: "2021",
    endMonth: "12",
    current: false,
    yearOnly: false,
  };
  second.id = "overlap";
  second.dates = { ...first.dates, startYear: "2021", endYear: "2022" };
  d.sections[1].entries.push(second);
  const now = Date.UTC(2026, 9, 14);
  assert.equal(
    localAssessment(d, jd + "\n3+ years of experience.", now).analysis
      .datedYears,
    3,
  );
  assert.equal(
    localAssessment(d, jd + "\n3+ years of experience.", now).analysis
      .statedYears,
    3,
  );
  second.dates.startMonth = "";
  assert.equal(localAssessment(d, jd, now).analysis.datedYears, null);
  assert.equal(
    localAssessment(
      d,
      "A role with responsibilities and no identifiable scoring criteria",
      now,
    ).analysis.score,
    null,
  );
});
test("provider batches are bounded without silently dropping fields", () => {
  const fields = Array.from({ length: 70 }, (_, i) => ({
    id: `f${i}`,
    field: "description",
    label: "Description",
    target: { type: "entry", sectionId: "work", itemId: `e${i}` },
    original: "x".repeat(700),
  }));
  const batches = fieldBatches(fields);
  assert.deepEqual(batches.flat(), fields);
  assert.ok(
    batches.every(
      (b) =>
        b.length <= 30 && b.reduce((n, f) => n + f.original.length, 0) <= 12000,
    ),
  );
});

function fullOutput(d) {
  const source=fullTailoringSource(d).provider;
  return {changes:source.fields.map(f=>({field:f.field,proposed:f.original||"Built Python APIs for operations.",facts:[f.original?f.field:source.fields.find(v=>v.original).field]}))};
}
const passed=(source)=>({checks:source.fields.map(f=>({field:f.field,supported:true,complete:true}))});
test("full writer projects every visible field and entry context without private identity, employers, dates or hidden data",()=>{
 const d=draft();d.sections[1].entries[0].subtitle="PRIVATE EMPLOYER";d.sections[1].entries[0].technologies="Python";
 const {provider}=fullTailoringSource(d);assert.equal(provider.fields.length,2);assert.equal(provider.fields[0].kind,"summary");
 const json=JSON.stringify(provider);for(const privateValue of ["Private Identity","PRIVATE EMPLOYER","private@example.invalid","12345678901","SECRET","Private skill","dates"])assert.ok(!json.includes(privateValue));
 assert.ok(json.includes("Python"));assert.ok(json.includes("Engineer"));
});
test("whole-resume coverage is mandatory; malformed or cross-entry citations cannot become proposals",()=>{
 const d=draft(),output=fullOutput(d),source=fullTailoringSource(d).provider;
 assert.throws(()=>inspectFullDraft(d,{changes:output.changes.slice(1)}));
 assert.throws(()=>inspectFullDraft(d,{changes:[output.changes[0],output.changes[0]]}));
 const f=output.changes.find(v=>v.field==="fact-0");f.facts=["forged"];f.proposed="Architected Python APIs for operations.";
 assert.deepEqual(inspectFullDraft(d,output).rejected,["fact-0"]);
 const result=verifiedFullChanges(d,jd,output,passed(source));assert.ok(!result.changes.some(c=>c.id==="fact-0"));
 const other=structuredClone(d.sections[1].entries[0]);other.id="second";other.technologies="Spark";other.description.content[0].content[0].text="Built Spark pipelines.";d.sections[1].entries.push(other);
 const cross=fullOutput(d);cross.changes.find(v=>v.field==="fact-0").facts.push("fact-1");assert.ok(inspectFullDraft(d,cross).rejected.includes("fact-0"));
});
test("stronger rewriting accepts natural wording but preserves numbers, tool evidence, negative claims and full detail",()=>{
 const d=draft(),source=fullTailoringSource(d).provider,output=fullOutput(d),f=output.changes.find(v=>v.field==="fact-0");
 f.proposed="Developed Python APIs to support operational workflows.";
 const result=verifiedFullChanges(d,jd,output,passed(source));assert.ok(result.changes.some(c=>c.id==="fact-0"));assert.equal(result.quality.fieldsChecked,2);assert.ok(result.changes.some(c=>c.field==="summary"));
 for(const unsafe of ["Developed Python APIs serving 500 users.","Developed Spark APIs for operations.","Developed Python APIs.\nLed the team.","Email private@example.invalid"]){f.proposed=unsafe;assert.ok(inspectFullDraft(d,output).rejected.includes("fact-0"));}
 f.proposed="Led the Python API team for operations.";
 const review=passed(source);review.checks.find(c=>c.field==="fact-0").supported=false;
 assert.ok(!verifiedFullChanges(d,jd,output,review).changes.some(c=>c.id==="fact-0"));
 review.checks.find(c=>c.field==="fact-0").supported=true;review.checks.find(c=>c.field==="fact-0").complete=false;
 assert.ok(!verifiedFullChanges(d,jd,output,review).changes.some(c=>c.id==="fact-0"));
 assert.throws(()=>verifiedFullChanges(d,jd,output,{checks:review.checks.slice(1)}));
});
test("tailored descriptions retain imported bullet-list layout and all source fields in the independently selected preview",()=>{
 const d=draft(),e=d.sections[1].entries[0];
 e.description={type:"doc",content:[{type:"bulletList",content:[{type:"listItem",content:[{type:"paragraph",content:[{type:"text",text:"Built Python APIs for operations."}]}]},{type:"listItem",content:[{type:"paragraph",content:[{type:"text",text:"Implemented Python integration tests."}]}]}]}]};
 const before=structuredClone(d),source=fullTailoringSource(d).provider,out=fullOutput(d);out.changes.find(c=>c.field==="fact-0").proposed="Developed Python APIs for operations.\nCreated Python integration tests.";
 const result=verifiedFullChanges(d,jd,out,passed(source)),next=applyTailoringPreview(d,result.changes,result.changes.map(c=>c.id));
 assert.deepEqual(d,before);assert.deepEqual(next.header,d.header);assert.deepEqual(next.sections.find(s=>s.id===d.sections[2].id),d.sections[2]);assert.equal(next.sections[1].entries[0].description.content[0].type,"bulletList");assert.equal(next.sections[1].entries[0].description.content[0].content.length,2);
});
test("Gemini uses low thinking for the initial draft and medium thinking for fact review and repair",async()=>{
 const source=fullTailoringSource(draft()).provider,output=fullOutput(draft()),calls=[];
 const p=createAiProviders({geminiKey:"TEST",paidGemini:true},async(url,options)=>{const body=JSON.parse(options.body);calls.push({url,body});return new Response(JSON.stringify({candidates:[{finishReason:"STOP",content:{parts:[{thought:true,text:"private reasoning"},{text:JSON.stringify(calls.length===1?output:passed(source))}]}}]}));});
 assert.deepEqual(await p.tailor(source,{terms:["Python"],responsibilities:["Build APIs"]}),output);await p.verifyTailoring(source,output);
 assert.equal(GEMINI_MODEL,"gemini-3.5-flash-lite");assert.equal(TAILORING_MODEL,"gemini-3.8-flash");assert.ok(calls.every(c=>c.url.includes(TAILORING_MODEL)));
 assert.deepEqual(calls.map(c=>c.body.generationConfig.thinkingConfig.thinkingLevel),["low","medium"]);
 assert.ok(calls.every(c=>c.body.generationConfig.maxOutputTokens===24000));
 assert.ok(calls[0].body.systemInstruction.parts[0].text.includes("Never invent"));assert.ok(calls[1].body.systemInstruction.parts[0].text.includes("independently"));
 const denied=createAiProviders({geminiKey:"TEST",paidGemini:false},async()=>{throw Error("must not call");});await assert.rejects(denied.tailor(source,{terms:[],responsibilities:[]}));
 const bad=createAiProviders({geminiKey:"TEST",paidGemini:true},async()=>new Response(JSON.stringify({candidates:[{finishReason:"MAX_TOKENS",content:{parts:[{text:JSON.stringify(output)}]}}]})));await assert.rejects(bad.tailor(source,{terms:[],responsibilities:[]}));
});
test("full writer cannot erase negation or inject known identity; review preserves source on rejected wording",()=>{
 const d=draft();d.sections[1].entries[0].description.content[0].content[0].text="Did not lead the Python API team.";
 const out=fullOutput(d);out.changes.find(c=>c.field==="fact-0").proposed="Led the Python API team.";
 assert.ok(inspectFullDraft(d,out).rejected.includes("fact-0"));
 out.changes.find(c=>c.field==="fact-0").proposed="Private Identity led the Python API team.";assert.ok(inspectFullDraft(d,out).rejected.includes("fact-0"));
});
test("professional section ordering preserves every section and hidden position, and can be rejected independently",()=>{
 const d=draft(),hidden=d.sections[2];hidden.hidden=true;d.sections=[d.sections[4],d.sections[1],hidden,d.sections[3],d.sections[0]];
 const source=fullTailoringSource(d).provider,result=verifiedFullChanges(d,jd,fullOutput(d),passed(source));
 const order=result.changes.find(c=>c.kind==="order"&&c.scope==="sections");assert.ok(order);
 const next=applyTailoringPreview(d,result.changes,[order.id]);assert.deepEqual(next.sections[2],hidden);
 assert.deepEqual(new Set(next.sections.map(s=>s.id)),new Set(d.sections.map(s=>s.id)));assert.deepEqual(next.sections.find(s=>s.id===d.sections[1].id),d.sections[1]);
 assert.deepEqual(applyTailoringPreview(d,[order],[]),d);
 assert.throws(()=>applyTailoringPreview(d,[{...order,proposedIds:["forged"]}],[order.id]));
});


test("full-tailoring correction retains medium thinking and independent output validation",async()=>{
 const source=fullTailoringSource(draft()).provider,output=fullOutput(draft()),calls=[];
 const provider=createAiProviders({geminiKey:"TEST",paidGemini:true},async(url,options)=>{
  calls.push(JSON.parse(options.body));
  return new Response(JSON.stringify({candidates:[{finishReason:"STOP",content:{parts:[{text:JSON.stringify(output)}]}}]}));
 });
 await provider.tailor(source,{terms:["Python"],responsibilities:[]},{previous:output,review:passed(source)});
 assert.equal(calls[0].generationConfig.thinkingConfig.thinkingLevel,"medium");
});
