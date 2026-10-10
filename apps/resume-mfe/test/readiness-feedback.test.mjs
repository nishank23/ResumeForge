import test from "node:test";
import assert from "node:assert/strict";
import { needsReadinessCheck, readinessGroups, compactCheckGroups, readinessRuleGroups } from "../src/readiness-feedback.ts";
import { computeReadiness, readinessProjection, READINESS_RUBRIC } from "@resume-forge/resume-core";
import { loadResumeApi } from "./resume-api-loader.mjs";
const { blankResume } = await loadResumeApi();

test("initially passing checks belong to Completed; dismissing a failure never completes it", () => {
  const checks = [
    { id: "already-pass", passed: true },
    { id: "pending", passed: false },
    { id: "dismissed", passed: false },
  ];
  const groups = readinessGroups({ checks }, ["dismissed", "already-pass", "removed-rule"]);
  assert.deepEqual(groups.Completed.map(c => c.id), ["already-pass"]);
  assert.deepEqual(groups.Pending.map(c => c.id), ["pending"]);
  assert.deepEqual(groups.Deleted.map(c => c.id), ["dismissed"]);
  assert.deepEqual(readinessGroups(null, []), {Pending:[],Completed:[],Deleted:[]});
});
test("automatic checks require current saved identity; replay and older browser versions do not rerun", () => {
  assert.equal(needsReadinessCheck({currentVersion:1,evaluation:null},1),true);
  assert.equal(needsReadinessCheck({currentVersion:2,evaluation:{resumeVersion:1}},2),true);
  assert.equal(needsReadinessCheck({currentVersion:2,evaluation:{resumeVersion:2,rubricVersion:READINESS_RUBRIC}},2),false);
  assert.equal(needsReadinessCheck({currentVersion:3,evaluation:{resumeVersion:2,rubricVersion:READINESS_RUBRIC}},2),false);
  assert.equal(needsReadinessCheck({currentVersion:0,evaluation:null},0),false);
});
test("draft preview responds to supported edits without changing saved evidence or contacts", () => {
  const saved = blankResume("Synthetic Person");
  const savedResult = computeReadiness(readinessProjection(saved));
  const draft = structuredClone(saved);
  draft.sections.find(s => s.kind === "skills").groups[0].items.push({id:"skill",text:"SQL",hidden:false});
  draft.sampleContact.email = "private@example.invalid";
  const preview = computeReadiness(readinessProjection(draft));
  assert.ok(preview.score > savedResult.score);
  assert.ok(readinessGroups(preview, []).Completed.length > 0);
  assert.equal(savedResult.score,0);
  assert.equal(saved.sections.find(s => s.kind === "skills").groups[0].items.length,0);
  assert.deepEqual(computeReadiness(readinessProjection(saved)),savedResult);
  assert.ok(!JSON.stringify(preview).includes("private@example.invalid"));
  assert.deepEqual(computeReadiness(readinessProjection(JSON.parse(JSON.stringify(draft)))), preview);
});

test("compact areas retain all check IDs and exact per-entry targets across statuses", () => {
 const checks = Array.from({length:45}, (_,i) => ({id:`rule:${i}`,componentId:["structure","detail","skills","clarity","dates"][i%5],passed:i%3===0,target:{type:"entry",sectionId:"work",itemId:`entry-${i}`}}));
 const areas=compactCheckGroups(checks);
 assert.equal(areas.length,5);assert.equal(areas.flatMap(a=>a.checks).length,45);
 assert.deepEqual(new Set(areas.flatMap(a=>a.checks.map(c=>c.id))),new Set(checks.map(c=>c.id)));
 for(const area of areas)for(const check of area.checks)assert.equal(check.target,checks.find(c=>c.id===check.id).target);
 assert.equal(compactCheckGroups(readinessGroups({checks},["rule:1"]).Deleted)[0].checks[0].id,"rule:1");
 assert.deepEqual(compactCheckGroups([]),[]);
});

test("rule families stay pending for mixed outcomes and complete only after every entry passes",()=>{
 const checks=[{id:"bullet-volume:a",title:"Balance bullet point volume",passed:false,scored:false,target:{type:"entry",sectionId:"work",itemId:"a"}},{id:"bullet-volume:b",title:"Balance bullet point volume",passed:true,scored:false,target:{type:"entry",sectionId:"work",itemId:"b"}}];
 let groups=readinessRuleGroups(checks,[]);assert.equal(groups.Pending.length,1);assert.equal(groups.Completed.length,0);assert.equal(groups.Pending[0].checks[0].target.itemId,"a");
 groups=readinessRuleGroups(checks,[checks[0].id]);assert.equal(groups.Pending.length,0);assert.equal(groups.Deleted.length,1);assert.equal(groups.Completed.length,0);
 checks[0].passed=true;groups=readinessRuleGroups(checks,[]);assert.equal(groups.Completed.length,1);assert.equal(groups.Pending.length,0);
});
test("same saved version with an older rubric rechecks automatically",()=>{
 assert.equal(needsReadinessCheck({currentVersion:2,evaluation:{resumeVersion:2,rubricVersion:"readiness-v1"}},2),true);
});

test("a dismissed entry stays restorable while other entries in its rule still need fixes",()=>{
 const checks=[{id:"entry-technologies:a",title:"Tools",passed:false},{id:"entry-technologies:b",title:"Tools",passed:false}];
 const groups=readinessRuleGroups(checks,["entry-technologies:a"]);
 assert.equal(groups.Pending.length,1);assert.equal(groups.Deleted.length,1);assert.equal(groups.Completed.length,0);
});
