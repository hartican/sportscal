#!/usr/bin/env node
'use strict';
// This step is invoked by update-cards, never by a parallel fixture cron.
const fs=require('node:fs'),path=require('node:path');
const {discoveryJobs}=require('../lib/discovery-sources');
const {mergeEvidenceOverlays}=require('../lib/autonomous-discovery');
const OUTPUT=path.join(__dirname,'../data/discovery/enrichment.v1.json');
async function refreshDiscovery({now=new Date(),sources=discoveryJobs()}={}){
 const prior=JSON.parse(fs.readFileSync(OUTPUT,'utf8')),records=[];
 for(const source of sources){
  const old=prior.sources.find(item=>item.id===source.id)||{fixtures:[]};
  if(Date.parse(old.nextDueAt)>+now){records.push(old);continue;}
  try{
   const result=await source.fetch({now,previous:old.fixtures||[],coverage:old.coverage||{},signal:AbortSignal.timeout(40000)});
   records.push({id:source.id,fixtures:result,coverage:result.coverage,nextDueAt:new Date(+now+source.minimumIntervalMs).toISOString()});
  }catch(error){
   const allowed=['ai_not_configured','ai_billing_required','ai_auth_unavailable','ai_rate_limited','watchlist_unavailable'];
   records.push({...old,id:source.id,coverage:{...old.coverage,status:'failed',lastAttemptAt:now.toISOString(),failureCode:allowed.includes(error.code)?error.code:'discovery_failed'},nextDueAt:new Date(+now+source.retryMs).toISOString()});
  }
 }
 const events=records.reduce((events,source)=>mergeEvidenceOverlays(events,source.fixtures||[]),[]);
 const document={schemaVersion:'discovery-enrichment.v1',generatedAt:now.toISOString(),sources:records,events};
 fs.writeFileSync(OUTPUT,JSON.stringify(document,null,2)+'\n');
 console.log(`Discovery: ${events.length} fixture enrichments retained. ${records.map(source=>`${source.id}: ${source.coverage?.failureCode||source.coverage?.status||'not-checked'}`).join('; ')}.`);
 return document;
}
module.exports={refreshDiscovery};
if(require.main===module)refreshDiscovery().catch(error=>{console.error(error.message);process.exitCode=1;});
