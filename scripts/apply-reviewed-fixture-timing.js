#!/usr/bin/env node
'use strict';
// Called inside update-cards only. Apply reviewed field provenance without
// replacing fixture identity, scores, editorial or primary observation dates.
const fs=require('node:fs'),assert=require('node:assert/strict'),identity=require('../config/fixture-identity'),reviewed=require('../config/reviewed-fixture-repairs');
function apply(ids){
 const targets=new Set(ids.map(identity.canonicalFixtureId));for(const id of targets){const facts=reviewed.facts(id);assert(facts?.startTimeUtc&&facts?.timingProvenance?.checkedAt&&facts?.timingProvenance?.sourceUrl,'Reviewed timing evidence required: '+id);}
 const reports=[];
 for(const file of ['feeds/incoming/events.json','data/events.json','data/follow-sources/coverage.v1.json']){
  const before=fs.readFileSync(file,'utf8'),document=JSON.parse(before);let changed=0;
  document.events=document.events.map(record=>{
   const id=identity.canonicalFixtureId(record.id||record.eventId);if(!targets.has(id))return record;
   const facts=reviewed.facts(id),normalized=identity.normalizeCore(record),next={...record,startTimeUtc:normalized.startTimeUtc,date:normalized.date,time:normalized.time,timePrecision:normalized.timePrecision,timingProvenance:facts.timingProvenance};
   if(record.endTimeBasis==='scheduled-live-window')next.endTimeUtc=facts.endTimeUtc;
   if(JSON.stringify(record)!==JSON.stringify(next))changed++;return next;
  });
  if(changed)fs.writeFileSync(file,JSON.stringify(document,null,2)+'\n');reports.push({file,changed});
 }
 return reports;
}
if(require.main===module){const arg=process.argv.find(x=>x.startsWith('--ids='));if(!arg)throw Error('An explicit reviewed identity scope is required');console.log(JSON.stringify(apply(arg.slice(6).split(','))));}
module.exports={apply};
