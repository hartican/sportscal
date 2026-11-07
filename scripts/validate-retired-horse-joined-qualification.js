#!/usr/bin/env node
"use strict";
// Source-only proposal; runtime qualification requires independently enforced isolation.
const assert = require("node:assert/strict");
const guardStatus = require("./lib/retired-horse-qualification-guards");
const {createRetirementIndex} = require("../lib/retired-horse-coverage");
const {applyFixtureAndResultEvidence} = require("./apply-current-card-evidence");
const sample = require("./fixtures/retired-horse-joined-qualification.v1.json");
const suites = ["official-results", "reviewed-evidence", "reminder-catalogue", "reminder-decisions"];
async function main() {
  const cases=[];
  for (const name of suites) {
    try {
      const report=await require("./validate-retired-horse-"+name).validate();
      cases.push({name,status:report.status,details:report.cases});
    } catch(error) { cases.push({name,status:"FAIL",message:String(error.message).slice(0,512)}); }
  }
  function check(name,fn){try{fn();cases.push({name,status:"PASS"});}catch(error){cases.push({name,status:"FAIL",message:String(error.message).slice(0,512)});}}
  const child=sample.typedParent.subEvents[0];
  const result={id:child.id,score:"synthetic",outcomeText:"synthetic",recapText:"synthetic"};
  for(const [order,records] of [["nested-first",[sample.typedParent,child]],["flat-first",[child,sample.typedParent]]]) check("opaque nested child "+order,()=>{
    const before=JSON.stringify(records);
    const out=applyFixtureAndResultEvidence(records,{checkedAt:sample.clock,fixtureOverrides:[],resultOverrides:[result]});
    assert.deepEqual(out,records);assert.equal(JSON.stringify(records),before);
  });
  check("explicit parent remains directed",()=>{
    const i=createRetirementIndex([sample.typedParent,sample.explicitChild]);
    assert(i.isRetired(sample.explicitChild));
  });
  check("typed child does not retire ordinary parent or sibling",()=>{
    const [typed,sibling]=sample.ordinaryParent.subEvents;
    const i=createRetirementIndex([sample.ordinaryParent,{...typed,parentId:sample.ordinaryParent.id},{...sibling,parentId:sample.ordinaryParent.id}]);
    assert(i.isRetired(typed));assert(!i.isRetired(sample.ordinaryParent));assert(!i.isRetired(sibling));
  });
  const fs=require("node:fs"), path=require("node:path");
  const writer=require("./apply-current-card-evidence");
  const accepted=require("./lib/accepted-result-projection");
  const root="/withdrawal-synthetic-memory-root";
  const evidencePath="data/canonical/current-card-evidence-2026.json";
  const majorPath="data/major-events.v1.json";
  const urls={sourceUrl:"https://www.espn.com/test",sourceName:"Synthetic",sourceCheckedAt:sample.clock};
  const row=id=>({id,status:"completed",score:"2-1",outcomeText:"Synthetic",recapText:"Synthetic",...urls});
  function capsule(id){const r={...row(id),sourceType:"reputable"};r.acceptedResultProjection={schemaVersion:"accepted-result-projection.v1",sourceSha256:"a".repeat(64),payloadSha256:accepted.hash(accepted.payload(r)),aliases:[id],participantIds:["test:home","test:away"],fixtureDate:"2026-10-31"};return r;}
  function virtualRun(selected, major, ids){
    const events=ids.map(id=>({id,status:"scheduled",participantIds:["test:home","test:away"],date:"2026-10-31",startTimeUtc:"2026-10-31T00:00:00Z",editorialNarrative:{hook:"retain"},sourceCheckedAt:"2026-10-30T00:00:00Z"}));
    const objects={ [evidencePath]:{fixtureOverrides:[],resultOverrides:selected}, [majorPath]:major,
      "feeds/incoming/events.json":{events:structuredClone(events)},"data/events.json":{events:structuredClone(events)},
      "data/canonical/official-card-results-2026.json":{results:[]},"data/canonical/afl-nrl-2026.json":{events:structuredClone(events)},
      "data/follow-sources/coverage.v1.json":{events:[]} };
    const files=new Map(Object.entries(objects).filter(([,v])=>v!==undefined).map(([k,v])=>[path.join(root,k),typeof v==="string"?v:JSON.stringify(v)]));
    let writes=0;const before=new Map(files),read=fs.readFileSync,write=fs.writeFileSync;
    fs.readFileSync=function(file,...args){if(files.has(String(file)))return files.get(String(file));if(path.resolve(String(file)).startsWith(root+path.sep)){const e=Error("Virtual file not found");e.code="ENOENT";throw e;}return read.call(this,file,...args);};
    fs.writeFileSync=function(file,value){assert(String(file).startsWith(root+path.sep));writes++;files.set(String(file),String(value));};
    let error;try{writer.applySelectedResults(ids,{root});}catch(e){error=e;}finally{fs.readFileSync=read;fs.writeFileSync=write;}
    return {files,before,writes,error};
  }
  for(const mode of ["nonaccepted","accepted","mixed"]) check("selected opaque nested retirement "+mode,()=>{
    const id=sample.typedParent.subEvents[0].id;
    const selected=mode==="nonaccepted"?[row(id)]:mode==="accepted"?[capsule(id)]:[row(id),capsule("test:ordinary")];
    const out=virtualRun(selected,{events:[sample.typedParent]},selected.map(x=>x.id));
    assert(out.error);assert.match(out.error.message,/withdrawn/);assert.equal(out.writes,0);assert.deepEqual(out.files,out.before);
  });
  for(const [kind,major] of [["missing",undefined],["malformed","{bad json"],["missing-events",{bad:[]}]]) check("major "+kind+" fails without writes",()=>{
    const out=virtualRun([row("test:ordinary")],major,["test:ordinary"]);
    assert(out.error);assert.equal(out.writes,0);assert.deepEqual(out.files,out.before);
  });
  check("ordinary selected result preserves editorial and source clock",()=>{
    const out=virtualRun([row("test:ordinary")],{events:[]},["test:ordinary"]);assert.ifError(out.error);
    const event=JSON.parse(out.files.get(path.join(root,"feeds/incoming/events.json"))).events[0];
    assert.equal(event.editorialNarrative.hook,"retain");assert.equal(event.sourceCheckedAt,sample.clock);
  });
  check("accepted capsule is validated and does not leak into output",()=>{
    const r=capsule("test:ordinary");assert(accepted.validateAcceptedResult(r));
    const merged=accepted.mergeAcceptedResult({id:r.id,status:"scheduled",participantIds:["test:home","test:away"],date:"2026-10-31",startTimeUtc:"2026-10-31T00:00:00Z"},r);
    assert(!Object.hasOwn(merged,"acceptedResultProjection"));assert.equal(merged.sourceCheckedAt,sample.clock);
    assert.throws(()=>accepted.validateAcceptedResult({...r,score:"corrupt"}));
  });
  check("accepted projection retains spoiler-safe editorial without leaking capsule",()=>{
    const r=capsule("test:spoiler");
    const original={id:r.id,status:"scheduled",participantIds:["test:home","test:away"],date:"2026-10-31",startTimeUtc:"2026-10-31T00:00:00Z",editorialNarrative:{hook:"A match to watch"},spoilerLevel:"sensitive"};
    const merged=accepted.mergeAcceptedResult(original,r);
    assert.equal(merged.editorialNarrative.hook,"A match to watch");
    assert.equal(merged.spoilerLevel,"sensitive");
    assert(!Object.hasOwn(merged,"acceptedResultProjection"));
  });
  const guardViolations=guardStatus.violations();
  const status=guardViolations||cases.some(c=>c.status!=="PASS")?"FAIL_OR_UNRUN":"PASS";
  const report={schemaVersion:"retired-horse-joined-qualification.v1",status,guardViolations,cases,
    separateUnrun:["hosted spoiler rendering", "full release and production", "independent OS isolation admission"]};
  const text=JSON.stringify(report)+"\n";
  if(Buffer.byteLength(text)>1048576)throw Error("Qualification report exceeds limit");
  const reportDir=process.env.NS_WITHDRAWAL_QUAL_REPORT_DIR;
  if(!reportDir)throw Error("UNRUN: report destination missing");
  fs.writeFileSync(path.join(reportDir,"qualification.json"),text,{flag:"wx",mode:0o600});
  console.log(text);
  process.exitCode=status==="PASS"?0:1;
}
main().catch(error=>{console.error(String(error.message).slice(0,512));process.exitCode=1;});
