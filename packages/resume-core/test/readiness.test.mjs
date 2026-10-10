import test from "node:test";
import assert from "node:assert/strict";
import { computeReadiness, READINESS_COMPONENTS } from "../dist/index.js";
const good = () => ({ sections: [
  { id: "work", kind: "experience", label: "Experience", summary: [], groups: [], entries: [{ id: "entry", title: "Software Developer", subtitle: "Synthetic Studio", details: ["Built a reliable reporting workflow that helps colleagues review daily operational results."], dates: { startYear: "2022", startMonth: "1", endYear: "2024", endMonth: "2", current: false, yearOnly: false } }] },
  { id: "skills", kind: "skills", label: "Skills", summary: [], entries: [], groups: [{ label: "Tools", items: ["JavaScript", "SQL"] }] },
] });
test("approved weights, deterministic boundaries and strong/empty examples",()=>{
 assert.equal(READINESS_COMPONENTS.reduce((n,c)=>n+c.weight,0),100);
 assert.equal(computeReadiness(good()).score,100);
 assert.deepEqual(computeReadiness(good()),computeReadiness(good()));
 assert.equal(computeReadiness({sections:[]}).score,0);
 const e=good();e.sections[0].entries[0].title="";e.sections[0].entries[0].details=[];e.sections[1].groups=[];
 assert.ok(computeReadiness(e).score<100);
});
test("keyword stuffing and duplicates cannot improve skills; metrics are optional",()=>{
 const base=computeReadiness(good());const input=good();input.sections[1].groups[0].items.push("sql", "SQL");
 assert.ok(computeReadiness(input).score<base.score);
 assert.equal(base.components.find(c=>c.id==="clarity").score,100);
});
test("reverse, partial and current/end date contradictions fail with stable targets",()=>{
 for(const dates of [{endYear:"2021"},{startMonth:""},{current:true}]){
  const i=good();Object.assign(i.sections[0].entries[0].dates,dates);const r=computeReadiness(i);
  assert.ok(r.components.find(c=>c.id==="dates").score<100);
  assert.ok(r.checks.some(c=>!c.passed&&c.target?.itemId==="entry"));
 }
 const i=good();Object.assign(i.sections[0].entries[0].dates,{yearOnly:true,startMonth:"",endMonth:""});
 assert.equal(computeReadiness(i).components.find(c=>c.id==="dates").score,100);
});
test("projects replace employment; undated projects do not fail chronology when education supplies dates",()=>{
 const i=good();i.sections[0].kind="projects";const e=i.sections[0].entries[0];e.dates={startYear:"",startMonth:"",endYear:"",endMonth:"",current:false,yearOnly:false};
 i.sections.push({id:"education",kind:"education",label:"Education",summary:[],groups:[],entries:[{...e,id:"school",dates:{...e.dates,startYear:"2018",endYear:"2022",yearOnly:true}}]});
 assert.equal(computeReadiness(i).score,100);
});
test("long output is bounded while score math uses all visible rules",()=>{
 const i=good();i.sections[0].entries=Array.from({length:100},(_,n)=>({...i.sections[0].entries[0],id:`entry-${n}`}));
 const r=computeReadiness(i);assert.equal(r.checks.length,100);assert.equal(r.truncated,true);assert.equal(r.score,100);
});

test("re-evaluation resolves an entry check without changing its stable identity",()=>{
 const i=good();i.sections[0].entries[0].title="";const before=computeReadiness(i);
 i.sections[0].entries[0].title="Software Developer";const after=computeReadiness(i);
 const failure=before.checks.find(c=>!c.passed&&c.id.startsWith("entry-title"));
 assert.ok(after.checks.find(c=>c.id===failure.id).passed);
 assert.equal(after.score,Math.round(after.components.reduce((n,c)=>n+c.score*c.weight/100,0)));
});

test("no-JD editing guidance identifies exact entries without changing approved score math",()=>{
 const input=good();const entry=input.sections[0].entries[0];
 const base=computeReadiness(input,{contactComplete:false});
 assert.equal(base.rubricVersion,"readiness-v2");assert.equal(base.score,100);
 for(const rule of ["bullet-volume","entry-technologies","skill-count","education-details","contact-presence"])
   assert.ok(base.checks.some(c=>c.id.startsWith(rule)&&!c.passed&&c.scored===false));
 entry.bulletCount=2;entry.technologies="SQL";
 entry.formatting={characters:160,boldCharacters:100};
 const bold=computeReadiness(input,{contactComplete:true});
 assert.equal(bold.score,base.score);assert.deepEqual(bold.components,base.components);
 assert.ok(bold.checks.find(c=>c.id.startsWith("bold-formatting")&&!c.passed).target.itemId==="entry");
 assert.ok(bold.checks.find(c=>c.id.startsWith("contact-presence")).passed);
 for(const n of [0,1,7]){entry.bulletCount=n;assert.equal(computeReadiness(input).checks.find(c=>c.id.startsWith("bullet-volume")).passed,false);}
 for(const n of [2,6]){entry.bulletCount=n;assert.equal(computeReadiness(input).checks.find(c=>c.id.startsWith("bullet-volume")).passed,true);}
});
