'use strict';
const fs=require('node:fs'),{performance}=require('node:perf_hooks');
const loader=require('../refresh-f1-results'),reviewed=require('./f1-reviewed-classifications');
const SURFACES=['feeds/incoming/events.json','data/events.json'];
function validateRetained(documents,now=new Date()){
 const canonical=new Map();
 for(const [file,document]of documents){
  if(!document||!Array.isArray(document.events))throw Error('F1 retained Feed is malformed');
  const ids=new Set(),identities=new Set();
  for(const event of document.events){
   if(ids.has(event.id))throw Error('Duplicate retained Feed ID');ids.add(event.id);
   if(event.key!=='f1')continue;
   if(!/^event:f1:2026:/.test(event.canonicalEventId||''))continue;
   if(identities.has(event.canonicalEventId))throw Error('Ambiguous retained F1 identity');identities.add(event.canonicalEventId);
   if(reviewed.forEvent(event)){
    const valid=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&[new Date(value).toISOString(),new Date(value).toISOString().replace('.000Z','Z')].includes(value);
    for(const key of ['sourceCheckedAt','statusCheckedAt','scoreCheckedAt','resultSourceCheckedAt','resultPublishedAt'])if(event[key]!=null&&(!valid(event[key])||Date.parse(event[key])>+now))throw Error('Invalid or future retained F1 observation');
    if(event.status==='completed'&&(!valid(event.scoreCheckedAt)||!valid(event.fixtureResults?.checkedAt)||Date.parse(event.scoreCheckedAt)<Date.parse(event.startTimeUtc)||Date.parse(event.fixtureResults.checkedAt)<Date.parse(event.startTimeUtc)||Date.parse(event.fixtureResults.checkedAt)>+now))throw Error('Retained F1 final lacks a genuine post-session result observation');
   }
   const old=canonical.get(event.canonicalEventId);
   if(old&&(old.id!==event.id||Date.parse(old.startTimeUtc)!==Date.parse(event.startTimeUtc)))throw Error('Conflicting retained F1 identity/start');
   if(old?.status==='completed'&&event.status==='completed'&&JSON.stringify(old.fixtureResults?.rows)!==JSON.stringify(event.fixtureResults?.rows))throw Error('Conflicting retained F1 finals');
   if(!old||event.status==='completed')canonical.set(event.canonicalEventId,event);
  }
 }
 return [...canonical.values()];
}
async function refresh({now=new Date(),deadline,clock=()=>performance.now(),context=require('../../data/canonical/f1-context-2026.json')}={}){
 const documents=SURFACES.map(file=>[file,JSON.parse(fs.readFileSync(file,'utf8'))]);
 const union=validateRetained(documents,now),eligible=loader.eligibleSessions(union,now);
 const report={mode:'f1-results',checkedAt:now.toISOString(),changed:[],updatedFixtureIdsBySurface:{},deferrals:[],unchanged:[],sources:[],aiCalls:0,publicationState:'candidate'};
 const selected=eligible.filter(event=>{if(reviewed.forEvent(event))return true;report.deferrals.push(reviewed.deferral(event));return false;});
 // Older pending sessions are visible deferrals, never an implicit wider query.
 for(const event of union)if(event.status!=='completed'&&Date.parse(event.startTimeUtc)<+now-7*86400000)report.deferrals.push({...reviewed.deferral(event),reason:'Outside existing seven-day F1 result window'});
 if(!selected.length){for(const file of SURFACES)report.updatedFixtureIdsBySurface[file]=[];report.publicationState='unchanged-with-deferrals';return report;}
 const budget=require('./f1-source-budget').createBudget({sessions:loader.resourcePlan(selected,now),clock,deadline});
 try{
  // Read all selected facts before any write, sharing exact resources across
  // both surfaces. Each surface supplies its own retained observations/copy.
  const candidates=[];
  for(const [file,document]of documents){
   const updates=await loader.updatesFor(document.events,now,undefined,context,{budget,report});
   const patched=require('./known-fixture-patch').patchKnown(document.events,updates);
   const changed=patched.events.filter((event,i)=>event!==document.events[i]).map(event=>event.id);
   for(const update of updates)if(!changed.includes(update.id))report.unchanged.push({surface:file,id:update.id});
   report.updatedFixtureIdsBySurface[file]=changed;
   if(changed.length)report.changed.push(`F1 ${file} ${changed.length}`);
   candidates.push([file,{...document,events:patched.events},changed.length]);
  }
  budget.check();
  report.sources=budget.summary().resources;
  report.deferrals=report.deferrals.filter((row,i,all)=>all.findIndex(other=>other.id===row.id&&other.reason===row.reason)===i);
  if(!report.changed.length&&!report.unchanged.length)throw Error('No supported F1 result observations; retained last-good facts');
  for(const [file,candidate,count]of candidates)if(count)fs.writeFileSync(file,JSON.stringify(candidate,null,2)+'\n');
  budget.check();return report;
 }catch(error){error.f1Report=report;throw error;}
 finally{budget.close();report.resources=budget.summary();}
}
module.exports={refresh,validateRetained,SURFACES};
