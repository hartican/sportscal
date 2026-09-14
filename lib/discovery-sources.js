'use strict';
const fs=require('node:fs'),path=require('node:path');
const {supabaseServiceRequest,supabaseServiceRoleConfig}=require('./supabase-server');
const {discover}=require('./autonomous-discovery');
const {isMarquee}=require('../config/follow-feed-policy');
const pilot=require('../data/canonical/athlete-participation.v1.json');
let registry;
function athleteRegistry(){
 if(registry)return registry;
 const records=new Map();
 for(const sport of require('../data/follow-directory/manifest.v1.json').sports){
  const document=JSON.parse(fs.readFileSync(path.join(__dirname,'..',sport.jsonUrl),'utf8'));
  for(const record of document.records||[])if(['athlete','player','competitor'].includes(record.entityType)&&record.current!==false){
   if(!records.has(record.id))records.set(record.id,{id:record.id,displayName:record.displayName,aliases:record.aliases||[],sportKey:record.id.split(':')[1]||sport.key,countryCode:record.countryCode});
  }
 }
 for(const athlete of pilot.athletes)records.set(athlete.id,{...records.get(athlete.id),...athlete});
 registry=[...records.values()];return registry;
}
function rotateBatch(items,cursor,count){
 const ordered=items.slice().sort((a,b)=>a.id.localeCompare(b.id));
 if(!ordered.length)return {items:[],cursor:0};
 const start=Math.max(0,Number(cursor)||0)%ordered.length;
 return {items:[...ordered.slice(start),...ordered.slice(0,start)].slice(0,count),cursor:(start+Math.min(count,ordered.length))%ordered.length};
}
function discoveryJobs({fetchImpl=globalThis.fetch,environment=process.env,request=supabaseServiceRequest}={}){
 // Editorial enrichment is an operator opt-in, never a fixture prerequisite.
 if(environment.DISCOVERY_CONSENSUS_ENABLED!=='true')return [];
 return ['consensus'].map(mode=>({id:`discovery-ai-${mode}`,allowEmpty:true,minimumIntervalMs:21600000,retryMs:21600000,timeoutMs:40000,minimumRuntimeMs:41000,
  fetch:async({now,previous=[],coverage={},signal})=>{
   const {catalogue}=require('./calendar-catalogue'),{createSnapshotStore,overlaySnapshots}=require('./live-fixtures');
   // Use current source facts for fixture identity. A live-store outage must not
   // block the static calendar, but is retained in the discovery health report.
   let snapshots=[],sourceReadFailed=false;
   if(supabaseServiceRoleConfig(environment).configured)try{snapshots=await createSnapshotStore({request}).read();}catch(_){sourceReadFailed=true;}
   const fixtures=overlaySnapshots(catalogue(),snapshots).filter(event=>{
    const date=Date.parse(event.date);return Number.isFinite(date)&&date>=+now-8*86400000&&date<=+now+91*86400000&&event.published!==false;
   });
   const candidates=fixtures.filter(event=>isMarquee(event)&&Date.parse(event.date)>=+now-3*86400000&&Date.parse(event.date)<=+now+7*86400000);
   const selected=rotateBatch(candidates,coverage.cursor,10);
   const result=await discover({mode,fixtures:selected.items,previous,now,fetchImpl,environment,signal});
   Object.assign(result.coverage,{cursor:selected.cursor,population:candidates.length,batchSize:selected.items.length,minimumIntervalHours:6});
   if(sourceReadFailed){result.coverage.status='partial';result.coverage.failures.push({code:'live_identity_store_unavailable'});}
   return result;
  },
 }));
}
module.exports={athleteRegistry,rotateBatch,discoveryJobs};
