import test from "node:test";
import assert from "node:assert/strict";
import { createAiProviders, GEMINI_MODEL, GEMINI_GENERATION_TIMEOUT_MS } from "../dist/ats/ai.js";
import { rewriteFields, validateChanges, applyRewrite } from "../dist/ats/rewrite.js";
import { editorDocumentSchema, rewriteProposalSchema } from "@resume-forge/shared-types";
const rich=(text)=>({type:"doc",content:[{type:"paragraph",content:[{type:"text",text}]}]});
const entry=(id,text)=>({id,hidden:false,title:"Engineer",subtitle:"Synthetic Co",location:"",employmentType:"",locationType:"",fieldOfStudy:"",grade:"",dates:{startMonth:"1",startYear:"2024",endMonth:"",endYear:"",current:true,yearOnly:false},description:rich(text),bullets:[],technologies:"Python",links:[]});
const doc=editorDocumentSchema.parse({synthetic:true,title:"Synthetic",header:{firstName:"Synthetic",lastName:"Person",headline:"",city:"",state:"",country:""},sampleContact:{email:"private@example.invalid",phone:"+12345678901"},sections:[{id:"work",kind:"experience",label:"Experience",hidden:false,summary:rich(""),groups:[],languages:[],entries:[entry("first","Built Python APIs in order to support operations."),entry("second","Designed React interfaces.")]}]});
const target={type:"entry",sectionId:"work",itemId:"first"};
test("rewrite projection includes only selected description, excludes contacts and other entry",()=>{const fields=rewriteFields(doc,target);assert.equal(fields.length,1);assert.equal(JSON.stringify(fields).includes("private@example"),false);assert.equal(JSON.stringify(fields).includes("React"),false);});
test("rewrites reject fabricated metrics, skill claims, field substitution, duplicates and contact leaks",()=>{
 for(const changes of [[{field:"description",proposed:"Built Python APIs reducing costs 80%."}],[{field:"description",proposed:"Built Kubernetes services."}],[{field:"description",proposed:"Built APIs to support operations."}],[{field:"other",proposed:"Supported APIs."}],[{field:"description",proposed:"Email private@example.invalid"}],[{field:"description",proposed:"Built Python APIs."},{field:"description",proposed:"Built Python APIs."}]])assert.throws(()=>validateChanges(doc,target,changes));
});
test("apply changes only selected subtree; header, second entry and original remain intact",()=>{
 const changes=validateChanges(doc,target,[{field:"description",proposed:"Built Python APIs to support operations."}]);const next=applyRewrite(doc,{target,changes});
 assert.deepEqual(next.header,doc.header);assert.deepEqual(next.sampleContact,doc.sampleContact);assert.deepEqual(next.sections[0].entries[1],doc.sections[0].entries[1]);assert.notDeepEqual(next.sections[0].entries[0].description,doc.sections[0].entries[0].description);
});
test("Gemini requires paid data mode before transport",async()=>{let called=false;const p=createAiProviders({geminiKey:"TEST",paidGemini:false},async()=>{called=true;throw new Error();});await assert.rejects(p.analyze([],[]));assert.equal(called,false);});
test("paid Gemini routes analysis and rewrites through the pinned low-cost model without tools",async()=>{
 const calls=[];const req="Build APIs",evidence="Built Python APIs for operations.";
 const p=createAiProviders({geminiKey:"TEST_GEMINI",paidGemini:true},async(url,options)=>{
  const body=JSON.parse(options.body);calls.push({url,body,headers:options.headers});
  const output=calls.length===1?{matches:[{requirement:req,evidence,sectionId:"work",itemId:"first"}]}:{changes:[]};
  return new Response(JSON.stringify({candidates:[{finishReason:"STOP",content:{parts:[{text:JSON.stringify(output)}]}}]}));
 });
 assert.equal((await p.analyze([req],[{sectionId:"work",itemId:"first",details:[evidence]}])).length,1);
 assert.deepEqual(await p.rewrite(rewriteFields(doc,target)),[]);
 for(const call of calls){assert.ok(call.url.endsWith(`${GEMINI_MODEL}:generateContent`));assert.equal(call.headers["x-goog-api-key"],"TEST_GEMINI");assert.equal(call.headers.Authorization,undefined);assert.equal(call.body.tools,undefined);assert.equal(call.body.generationConfig.thinkingConfig.thinkingLevel,"minimal");assert.equal(call.body.generationConfig.responseMimeType,"application/json");}
 assert.ok(!JSON.stringify(calls[1].body).includes("private@example"));
});
test("malformed, unsafe, truncated and non-source model results fail closed without raw errors",async()=>{
 for(const payload of [{candidates:[{finishReason:"STOP",content:{parts:[{text:'{"matches":[{"requirement":"forged","evidence":"not in source","sectionId":"work","itemId":"first"}]}'}]}}]},{candidates:[{finishReason:"MAX_TOKENS",content:{parts:[{text:'{"matches":[]}'}]}}]}]){
  const p=createAiProviders({geminiKey:"TEST",paidGemini:true},async()=>new Response(JSON.stringify(payload)));await assert.rejects(p.analyze(["Build APIs"],[{sectionId:"work",itemId:"first",details:["Built Python APIs for operations."]}]));
 }
 const p=createAiProviders({geminiKey:"TEST",paidGemini:true},async()=>new Response("private credential details",{status:401}));await assert.rejects(p.rewrite(rewriteFields(doc,target)),(e)=>!e.message.includes("private credential"));
});

test("Gemini rewriting requires paid configuration before any egress",async()=>{
 let calls=0;
 for(const settings of [{geminiKey:"TEST",paidGemini:false},{paidGemini:true}]){
  const p=createAiProviders(settings,async()=>{calls++;throw new Error();});
  assert.equal(p.rewriteAvailable,false);await assert.rejects(p.rewrite(rewriteFields(doc,target)));
 }
 assert.equal(calls,0);
});
test("Gemini quota and access errors are actionable and do not expose provider payloads",async()=>{
 for(const status of [401,403,429]){
  const p=createAiProviders({geminiKey:"TEST",paidGemini:true},async()=>new Response(JSON.stringify({error:{message:"private account details"}}),{status}));
  await assert.rejects(p.rewrite(rewriteFields(doc,target)),e=>!e.message.includes("private account")&&/Gemini (quota|access)/.test(e.message));
 }
});

import {vectorChunks,vectorLiteral} from "../dist/ats/vectors.js";
import {parseJdText} from "../dist/jd-parser.js";
test("vector chunks bind entry hashes, reject oversize and invalid dimensions",()=>{
 const entries=[{sectionId:"work",itemId:"one",details:["Built SQL pipelines."]}];
 assert.equal(vectorChunks(entries)[0].sourceHash.length,64);
 assert.notEqual(vectorChunks(entries)[0].sourceHash,vectorChunks([{...entries[0],details:["Built Python pipelines."]}])[0].sourceHash);
 for(const v of [[],Array(768).fill(0),Array(768).fill(NaN),Array(767).fill(1)])assert.throws(()=>vectorLiteral(v));
 assert.throws(()=>vectorChunks([{...entries[0],details:["a".repeat(6001)]}]));
});
test("embedding provider requests separate document/query task modes, validates dimensions and normalizes",async()=>{
 let sent; const p=createAiProviders({geminiKey:"TEST",paidGemini:true},async(url,options)=>{sent={url,body:JSON.parse(options.body)};return new Response(JSON.stringify({embeddings:[{values:Array(768).fill(2)},{values:Array(768).fill(3)}]}));});
 const result=await p.embed([{text:"Built SQL pipelines.",query:false},{text:"SQL ETL experience",query:true}]);
 assert.ok(sent.url.includes("gemini-embedding-001:batchEmbedContents"));
 assert.deepEqual(sent.body.requests.map(r=>r.taskType),["RETRIEVAL_DOCUMENT","RETRIEVAL_QUERY"]);
 assert.equal(sent.body.requests[0].outputDimensionality,768);
 assert.ok(Math.abs(Math.hypot(...result[0])-1)<1e-10);
 const bad=createAiProviders({geminiKey:"TEST",paidGemini:true},async()=>new Response(JSON.stringify({embeddings:[{values:[1,2,3]}]})));
 await assert.rejects(bad.embed([{text:"SQL",query:false}]));
});
test("informal repeated data-engineer JD retains required aliases, preferred HR migration and deduplicated duties",()=>{
 const jd="common Skils - SQL, GCP BQ, ETL pipelines using Pythin/Airflow,Experience on Spark/Hive/HDFS,Data modeling for Data conversion Resources (4)\nPrior experience working on a conv/migration HR project is additional skill needed along with above mentioned skills\nCommon Skils - SQL, GCP BQ, ETL pipelines using Pythin/Airflow,\nExperience on Spark/Hive/HDFS,\nData modeling for Data conversion Resources (4)\nData Engineer - Knows HR Knowledge , all other requirement from Functional Area given by UBER";
 const p=parseJdText(jd);
 for(const name of ["SQL","BigQuery","Python","Airflow","Spark","Hive","HDFS","ETL","Data modeling"])assert.ok(p.keywords.some(k=>k.name===name&&k.required),name);
 assert.ok(p.keywords.some(k=>k.name==="HR"&&!k.required));
 assert.equal(new Set(p.responsibilities).size,p.responsibilities.length);
 assert.ok(p.responsibilities.some(v=>v.includes("migration HR")));
});


test("Gemini rewrite validates structured output, ignores thinking, and rejects truncated or tool output",async()=>{
 const envelope=(parts,finishReason="STOP")=>({candidates:[{finishReason,content:{parts}}]});
 const changes=[{field:"description",proposed:"Built Python APIs to support operations."}];
 const p=createAiProviders({geminiKey:"TEST",paidGemini:true},async()=>new Response(JSON.stringify(envelope([{thought:true,text:"private reasoning"},{text:JSON.stringify({changes})}]))));
 assert.deepEqual(await p.rewrite(rewriteFields(doc,target)),changes);
 for(const response of [envelope([{text:'{"changes":[]}'}],"MAX_TOKENS"),envelope([{functionCall:{name:"read"}},{text:'{"changes":[]}'}]),envelope([{text:'{"changes":[{"field":"description","proposed":"x","extra":"bad"}]}'}]),{candidates:[]}]){
  const bad=createAiProviders({geminiKey:"TEST",paidGemini:true},async()=>new Response(JSON.stringify(response)));
  await assert.rejects(bad.rewrite(rewriteFields(doc,target)),/could not be validated/);
 }
});

test("stored legacy proposals remain readable while unsupported model identities fail",()=>{
 const proposal={id:"11111111-1111-4111-8111-111111111111",resumeId:"22222222-2222-4222-8222-222222222222",versionId:"33333333-3333-4333-8333-333333333333",resumeVersion:1,target,inputHash:"a".repeat(64),createdAt:new Date().toISOString(),changes:[],appliedVersion:null};
 for(const model of [GEMINI_MODEL,"mimo-v2.6-flash-free"])assert.equal(rewriteProposalSchema.parse({...proposal,model}).model,model);
 assert.equal(rewriteProposalSchema.safeParse({...proposal,model:"unapproved-model"}).success,false);
});


test("safe action inflections and explicit shorthand preserve facts without blocking Gemini", () => {
  const source=structuredClone(doc);
  source.sections[0].entries[0].description=rich("Worked across Android apps and backend APIs, integrating JWT/OTP auth with update systems.");
  const changes=validateChanges(source,target,[{field:"description",proposed:"Collaborated across Android applications and backend APIs, integrated JWT/OTP authentication with update systems."}]);
  assert.equal(changes.length,1);
  for(const proposed of ["Collaborated across Kubernetes applications and backend APIs, integrated JWT/OTP authentication with update systems.","Collaborated across Android applications and backend APIs, integrated authentication with update systems.","Collaborated across Android applications and backend APIs, integrated JWT/OTP authentication with scalable update systems.","Collaborated across Android applications and backend APIs, integrated JWT or OTP authentication with update systems."])
    assert.throws(()=>validateChanges(source,target,[{field:"description",proposed}]));
  source.sections[0].entries[0].description=rich("Did not build Android apps for 50 users.");
  for(const proposed of ["Built Android applications for 50 users.","Did not build Android applications for 500 users."])
    assert.throws(()=>validateChanges(source,target,[{field:"description",proposed}]));
});

test("Gemini prompt mirrors safe vocabulary, sends field IDs/text only, and bounds long rewrite output",async()=>{
  let sent;
  const p=createAiProviders({geminiKey:"TEST",paidGemini:true},async(url,options)=>{
    sent=JSON.parse(options.body);
    return new Response(JSON.stringify({candidates:[{finishReason:"STOP",content:{parts:[{text:'{"changes":[]}'}]}}]}));
  });
  await p.rewrite(rewriteFields(doc,target));
  assert.deepEqual(Object.keys(JSON.parse(sent.contents[0].parts[0].text).fields[0]),["field","original"]);
  assert.ok(sent.systemInstruction.parts[0].text.includes('"auth":"authentication"'));
  assert.ok(sent.systemInstruction.parts[0].text.includes("integrating"));
  assert.equal(sent.generationConfig.maxOutputTokens,8192);
});

test("Gemini generation survives eight seconds but aborts at its twenty-second deadline",async(t)=>{
  t.mock.timers.enable({apis:["setTimeout"]});
  let signal;
  const p=createAiProviders({geminiKey:"TEST",paidGemini:true},async(url,options)=>{
    signal=options.signal;
    return new Promise((resolve,reject)=>signal.addEventListener("abort",()=>reject(new Error("private provider body")),{once:true}));
  });
  const pending=assert.rejects(p.rewrite(rewriteFields(doc,target)),e=>/timed out/.test(e.message)&&!e.message.includes("private"));
  t.mock.timers.tick(8_000);assert.equal(signal.aborted,false);
  t.mock.timers.tick(GEMINI_GENERATION_TIMEOUT_MS-8_000);assert.equal(signal.aborted,true);
  await pending;
});
