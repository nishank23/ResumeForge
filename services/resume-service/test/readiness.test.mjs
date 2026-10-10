import test from "node:test";
import assert from "node:assert/strict";
import { readinessProjection } from "../dist/readiness-projection.js";
import { computeReadiness } from "@resume-forge/resume-core";
const rich=(text)=>({type:"doc",content:[{type:"paragraph",content:[{type:"text",text}]}]});
test("projection excludes contact/header/source/appearance and hidden facts, preserves rich paragraphs",()=>{
 const doc={ header:{firstName:"PRIVATE",email:"private@example.invalid"}, sampleContact:{email:"secret@example.invalid",phone:"SECRET"}, rawText:"HIDDEN EXTRACTION",appearance:{}, sections:[
 {id:"hidden",kind:"experience",label:"SECRET SECTION",hidden:true,summary:rich("SECRET"),entries:[],groups:[]},
 {id:"work",kind:"experience",label:"Experience",hidden:false,summary:rich(""),groups:[],entries:[
 {id:"hidden-entry",hidden:true,title:"SECRET",description:rich("SECRET"),bullets:[],dates:{}},
 {id:"visible",hidden:false,title:"Developer",subtitle:"Synthetic",dates:{},description:rich("Visible description is retained for professional scoring without contacts."),bullets:[{hidden:true,text:"SECRET"},{hidden:false,text:"Visible achievement remains"}]}
 ]},
 {id:"skills",kind:"skills",label:"Skills",hidden:false,summary:rich(""),entries:[],groups:[{label:"Tools",items:[{hidden:true,text:"SECRET"},{hidden:false,text:"SQL"}]}]}
 ]};
 const input=readinessProjection(doc);assert.equal(input.sections.length,2);assert.equal(input.sections[0].entries.length,1);assert.ok(!JSON.stringify(input).includes("SECRET"));assert.ok(!JSON.stringify(input).includes("PRIVATE"));assert.ok(!JSON.stringify(input).includes("example.invalid"));
 assert.deepEqual(input.sections[1].groups[0].items,["SQL"]);assert.equal(input.sections[0].entries[0].details.length,2);
 const before=computeReadiness(input);doc.header.firstName="Other private name";doc.sampleContact.email="other@example.invalid";assert.deepEqual(computeReadiness(readinessProjection(doc)),before);
});

test("guidance counts rich bullets/bold and exposes only a contact presence boolean",async()=>{
 const {readinessHints}=await import("@resume-forge/shared-types");
 const doc={header:{firstName:"Private",lastName:"Person",city:"Somewhere",state:"",country:""},sampleContact:{email:"private@example.invalid",phone:"5551234567"},sections:[{id:"work",kind:"experience",label:"Work",hidden:false,summary:rich(""),groups:[],entries:[{id:"entry",hidden:false,title:"Engineer",subtitle:"Example",technologies:"SQL",dates:{},description:{type:"doc",content:[{type:"bulletList",content:[{type:"listItem",content:[{type:"paragraph",content:[{type:"text",text:"Supported text",marks:[{type:"bold"}]}]}]}]}]},bullets:[{hidden:true,text:"SECRET"},{hidden:false,text:"Visible contribution"}]}]}]};
 const projected=readinessProjection(doc);assert.equal(projected.sections[0].entries[0].bulletCount,2);assert.equal(projected.sections[0].entries[0].formatting.boldCharacters,14);
 assert.deepEqual(readinessHints(doc),{contactComplete:true});assert.ok(!JSON.stringify(projected).includes("private@example"));
 doc.sampleContact.phone="";assert.deepEqual(readinessHints(doc),{contactComplete:false});
});
