import test from "node:test";
import assert from "node:assert/strict";
import { computeJdMatch, containsTerm, JD_WEIGHTS } from "../dist/index.js";
const dates={startYear:"2024",startMonth:"1",endYear:"",endMonth:"",current:true,yearOnly:false};
const input={sections:[{id:"experience",kind:"experience",label:"Experience",summary:[],groups:[],entries:[{id:"first",title:"Backend Engineer",subtitle:"Synthetic Co",dates,details:["Built Python APIs for operations using PostgreSQL."]},{id:"second",title:"Developer",subtitle:"Synthetic Co",dates,details:["Designed React user interfaces for customers."]}]},{id:"skills",kind:"skills",label:"Skills",summary:[],entries:[],groups:[{label:"Languages",items:["Python","PostgreSQL","React"]}]}]};
const jd={terms:[{name:"Python",required:true,skill:true},{name:"PostgreSQL",required:true,skill:true}],responsibilities:["Build Python APIs for operations"]};
test("approved weights, exact math, bounded component results and stable entry feedback",()=>{
 assert.equal(JD_WEIGHTS.reduce((a,b)=>a+b,0),100);const result=computeJdMatch(input,jd);
 assert.equal(result.partial,false);assert.equal(result.score,Math.round(result.components.reduce((n,c)=>n+c.score*c.weight,0)/100));
 assert.ok(result.components.every((c)=>c.score>=0&&c.score<=100));assert.deepEqual(result.responsibilities[0].target,{type:"entry",sectionId:"experience",itemId:"first"});
 assert.deepEqual(computeJdMatch(input,jd),result);
 assert.ok(result.checks.every(c=>c.scored!==false)); // No-JD advice cannot change JD feedback or scoring.
});
test("term boundaries stop Java matching JavaScript; aliases are explicit",()=>{assert.equal(containsTerm("JavaScript developer","Java"),false);assert.equal(containsTerm("Node.js and postgres","Node.js"),true);assert.equal(containsTerm("Postgres database","PostgreSQL"),true);});
test("missing JD dimensions stay partial, never renormalize or claim a complete zero",()=>{const r=computeJdMatch(input,{terms:[],responsibilities:[]});assert.equal(r.score,null);assert.equal(r.partial,true);assert.equal(r.components[0].score,null);});
test("empty resume with usable JD scores zero and cannot gain points by keyword repetition",()=>{
 assert.equal(computeJdMatch({sections:[]},jd).score,0);
 const one=computeJdMatch(input,jd);const twice=structuredClone(input);twice.sections[0].entries[0].details.push("Python Python Python PostgreSQL");
 assert.equal(computeJdMatch(twice,jd).components[0].score,one.components[0].score);
});
test("semantic evidence must quote a visible detail with the exact stable target",()=>{
 const req="Operate REST services";const data={...jd,responsibilities:[req]};
 assert.equal(computeJdMatch(input,data,[{requirement:req,evidence:"FORGED",sectionId:"experience",itemId:"first"}]).responsibilities[0].matched,false);
 const r=computeJdMatch(input,data,[{requirement:req,evidence:input.sections[0].entries[0].details[0],sectionId:"experience",itemId:"first"}]);assert.equal(r.responsibilities[0].method,"semantic");
});

test("technology labels support JD skills without affecting description quality; punctuation preserves keyword boundaries",()=>{
 assert.equal(containsTerm("Python. Node.js.","Python"),true);assert.equal(containsTerm("Node.js.","Node.js"),true);
 const base=computeJdMatch(input,jd);const withTech=computeJdMatch(input,jd,[],[{sectionId:"experience",itemId:"first",text:"Docker"}]);
 assert.equal(withTech.components[4].score,base.components[4].score);assert.deepEqual(withTech.checks.filter((c)=>!c.id.startsWith("jd-")),base.checks.filter((c)=>!c.id.startsWith("jd-")));
 assert.equal(computeJdMatch(input,{terms:[{name:"Docker",required:true,skill:true}],responsibilities:jd.responsibilities},[],[{sectionId:"experience",itemId:"first",text:"Docker"}]).skills[0].matched,true);
});

test("JD semantic evidence can credit a project and keeps its exact project target",()=>{
 const req="Deliver analytical reporting",evidence="Built Python dashboards for operational reporting.";
 const project={sections:[{id:"projects",kind:"projects",label:"Projects",summary:[],groups:[],entries:[{id:"reporting",title:"Reporting",subtitle:"Developer",dates,details:[evidence]}]}]};
 const requirements={terms:[{name:"Python",required:true,skill:true}],responsibilities:[req]};
 const result=computeJdMatch(project,requirements,[{requirement:req,evidence,sectionId:"projects",itemId:"reporting"}]);
 assert.equal(result.responsibilities[0].matched,true);assert.equal(result.responsibilities[0].method,"semantic");
 assert.deepEqual(result.responsibilities[0].target,{type:"entry",sectionId:"projects",itemId:"reporting"});
 assert.equal(result.components[1].score,100);
 assert.equal(computeJdMatch(project,requirements,[{requirement:req,evidence,sectionId:"projects",itemId:"wrong"}]).responsibilities[0].matched,false);
});
