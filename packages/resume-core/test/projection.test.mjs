import test from "node:test";
import assert from "node:assert/strict";
import { readinessProjection } from "../dist/index.js";
const paragraph = text => ({type:"paragraph",content:[{type:"text",text}]});
test("one shared projection retains nested professional text and excludes hidden and private fields", () => {
  const doc = {header:{firstName:"SECRET"},sampleContact:{email:"SECRET"},rawText:"SECRET",appearance:{font:"SECRET"},sections:[
    {id:"hidden",kind:"experience",hidden:true},
    {id:"work",kind:"experience",label:"Work",hidden:false,summary:{type:"doc",content:[]},groups:[],entries:[
      {id:"entry",title:"Synthetic role",subtitle:"Synthetic team",hidden:false,dates:{startYear:"2020",startMonth:"",endYear:"2021",endMonth:"",current:false,yearOnly:true},description:{type:"doc",content:[paragraph("First paragraph"),{type:"bulletList",content:[{type:"listItem",content:[paragraph("Nested point"),{type:"bulletList",content:[{type:"listItem",content:[paragraph("Deeper point")]}]}]}]}]},bullets:[{text:"SECRET",hidden:true},{text:"Visible bullet",hidden:false}]}
    ]}
  ]};
  const projection = readinessProjection(doc);
  assert.deepEqual(projection.sections[0].entries[0].details,["First paragraph","Nested point","Deeper point","Visible bullet"]);
  assert.equal(projection.sections.length,1);
  assert.ok(!JSON.stringify(projection).includes("SECRET"));
  assert.equal(projection.sections[0].entries[0].dates.yearOnly,true);
});
