'use strict';
const fs=require('node:fs'),path=require('node:path');
const {supabaseServiceRequest,supabaseServiceRoleConfig}=require('./supabase-server');
const {expandedFollowEntityIds}=require('./follow-fixture-resolver');
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
async function followedAthletes({request=supabaseServiceRequest,environment=process.env}={}){
 const known=new Map(athleteRegistry().map(athlete=>[athlete.id,athlete])),ids=new Set(pilot.athletes.map(athlete=>athlete.id));
 if(!supabaseServiceRoleConfig(environment).configured)return {athletes:[...ids].map(id=>known.get(id)),watchScope:'pilot-only-no-account-access'};
 // Read preferences only, paginate all profiles, and discard the per-user
 // associations here. No profile ID or per-user follow association leaves this service.
 for(let offset=0;;offset+=500){
  const rows=await request(`/rest/v1/nothingsports_user_state?select=preferences&order=user_id.asc&limit=500&offset=${offset}`);
  if(!Array.isArray(rows))throw Object.assign(new Error('Follow discovery unavailable'),{code:'watchlist_unavailable'});
  for(const row of rows)for(const id of expandedFollowEntityIds({preferences:row.preferences}))if(known.has(id))ids.add(id);
  if(rows.length<500)break;
 }
 return {athletes:[...ids].sort().map(id=>known.get(id)),watchScope:'pilot-and-registered-followed-athletes'};
}
function rotateBatch(items,cursor,count){
 const ordered=items.slice().sort((a,b)=>a.id.localeCompare(b.id));
 if(!ordered.length)return {items:[],cursor:0};
 const start=Math.max(0,Number(cursor)||0)%ordered.length;
 return {items:[...ordered.slice(start),...ordered.slice(0,start)].slice(0,count),cursor:(start+Math.min(count,ordered.length))%ordered.length};
}
function discoveryJobs({fetchImpl=globalThis.fetch,environment=process.env,request=supabaseServiceRequest}={}){
 return ['athletes','consensus'].map(mode=>({id:`discovery-ai-${mode}`,allowEmpty:true,minimumIntervalMs:21600000,retryMs:21600000,timeoutMs:40000,minimumRuntimeMs:41000,
  fetch:async({now,previous=[],coverage={},signal})=>{
   const {catalogue}=require('./calendar-catalogue'),{createSnapshotStore,overlaySnapshots}=require('./live-fixtures');
   // Use current source facts for fixture identity. A live-store outage must not
   // block the static calendar, but is retained in the discovery health report.
   let snapshots=[],sourceReadFailed=false;
   if(supabaseServiceRoleConfig(environment).configured)try{snapshots=await createSnapshotStore({request}).read();}catch(_){sourceReadFailed=true;}
   const fixtures=overlaySnapshots(catalogue(),snapshots).filter(event=>{
    const date=Date.parse(event.date);return Number.isFinite(date)&&date>=+now-8*86400000&&date<=+now+91*86400000&&event.published!==false;
   });
   let selected,watchScope=null,athletes=[],population=0;
   if(mode==='athletes'){
    const watch=await followedAthletes({request,environment});watchScope=watch.watchScope;population=watch.athletes.length;
    selected=rotateBatch(watch.athletes,coverage.cursor,8);athletes=selected.items;
   }else{
    const candidates=fixtures.filter(event=>isMarquee(event)&&Date.parse(event.date)>=+now-3*86400000&&Date.parse(event.date)<=+now+7*86400000);
    selected=rotateBatch(candidates,coverage.cursor,10);population=candidates.length;
   }
   const primaryKeys=new Set(athletes.map(athlete=>athlete.sportKey));
   const relevant=mode==='athletes'?fixtures.filter(event=>!primaryKeys.has(event.key)).sort((a,b)=>Math.abs(Date.parse(a.date)-now)-Math.abs(Date.parse(b.date)-now)).slice(0,100):selected.items;
   const result=await discover({mode,athletes,fixtures:relevant,knownFixtures:fixtures,previous,now,fetchImpl,environment,signal});
   Object.assign(result.coverage,{cursor:selected.cursor,population,watchScope,batchSize:selected.items.length,minimumIntervalHours:6});
   if(sourceReadFailed){result.coverage.status='partial';result.coverage.failures.push({code:'live_identity_store_unavailable'});}
   return result;
  },
 }));
}
module.exports={athleteRegistry,followedAthletes,rotateBatch,discoveryJobs};
