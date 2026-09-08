"use strict";
const crypto=require("node:crypto");
const {mergeFixtureSnapshot}=require("./fixture-snapshot");
const identity=require("../config/fixture-identity");
const {supabaseServiceRequest}=require("./supabase-server");
const TABLE="nothingsports_fixture_sources";
const VOLATILE=new Set(["checkedAt","updatedAt","sourceCheckedAt","canonicalSourceCheckedAt","generatedAt","statusUpdatedAt"]);
function contentHash(fixtures){
  const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==="object"
    ?Object.fromEntries(Object.keys(value).sort().filter(key=>!VOLATILE.has(key)).map(key=>[key,stable(value[key])])):value;
  return crypto.createHash("sha256").update(JSON.stringify(stable(fixtures))).digest("hex");
}
function refreshInterval(fixtures,now=new Date()){
  const active=(fixtures || []).filter(event=>!["completed","finished","past","cancelled","canceled","abandoned"].includes(event.status));
  if(active.some(event=>event.status==="live" || Date.parse(event.startTimeUtc)<=+now && Date.parse(event.endTimeUtc)>+now))return 60000;
  if(active.some(event=>{const start=Date.parse(event.startTimeUtc||event.estimatedStartTimeUtc||event.timelineSortTimeUtc);return Number.isFinite(start)&&start>=+now-6*3600000&&start<=+now+86400000;}))return 300000;
  return 3600000;
}
function overlaySnapshots(events,snapshots){
  let result=events;
  for(const snapshot of [...(snapshots || [])].sort((a,b)=>String(a.checked_at||'').localeCompare(String(b.checked_at||'')))){
    const byId=new Map(result.flatMap(event=>[event.id,event.eventId,event.canonicalEventId].filter(Boolean).map(id=>[id,event])));
    const updates=(snapshot.fixtures || []).map(event=>({...byId.get(event.canonicalEventId||event.eventId||event.id),...event}));
    result=mergeFixtureSnapshot(result,updates).events;
  }
  return identity.estimateTimeline(result.map(identity.normalizeCore));
}
function createSnapshotStore({request=supabaseServiceRequest}={}){
  const rpc=(name,body)=>request(`/rest/v1/rpc/${name}`,{method:"POST",body});
  return {
    async read(){return request(`/rest/v1/${TABLE}?select=source_id,revision,fixtures,checked_at&order=source_id.asc`);},
    async claim(id,token){const rows=await rpc("nothingsports_claim_fixture_source",{p_source_id:id,p_token:token});return rows?.[0] || null;},
    async publish(id,token,value){return rpc("nothingsports_publish_fixture_source",{p_source_id:id,p_token:token,p_fixtures:value.fixtures,p_hash:value.hash,p_interval_ms:value.intervalMs});},
    async fail(id,token,value){return rpc("nothingsports_fail_fixture_source",{p_source_id:id,p_token:token,p_retry_ms:value.retryMs});},
  };
}
async function refreshDueSources({sources,store=createSnapshotStore(),now=new Date(),maxRuntimeMs=45000}={}){
  const result={refreshed:[],skipped:[],failed:[]};
  const deadline=Date.now()+maxRuntimeMs;
  // Two bounded source workers; database leases also coalesce other invocations.
  const pending=[...sources];
  async function worker(){
    while(pending.length){
      const source=pending.shift(),token=crypto.randomUUID();
      if(Date.now()>=deadline-1000){result.skipped.push(source.id);continue;}
      let claimed=false;
      try{
        const row=await store.claim(source.id,token);
        if(!row){result.skipped.push(source.id);continue;}claimed=true;
        const previous=row.fixtures?.length?row.fixtures:(source.seed || []);
        let timer;
        const incoming=await Promise.race([
          source.fetch({now,previous}),
          new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(new Error("Source deadline exceeded")),Math.min(25000,Math.max(1,deadline-Date.now())));}),
        ]).finally(()=>clearTimeout(timer));
        if(!Array.isArray(incoming))throw new Error("Source response is not a fixture collection");
        const merged=mergeFixtureSnapshot(previous,incoming);
        if(incoming.length===merged.invalid)throw new Error("Source returned no usable fixture records");
        const fixtures=merged.events.map(identity.normalizeCore);
        const intervalMs=Math.max(source.minimumIntervalMs || 0,refreshInterval(fixtures,now));
        await store.publish(source.id,token,{fixtures,hash:contentHash(fixtures),intervalMs,nextDueAt:+now+intervalMs});
        result.refreshed.push(source.id);
      }catch(error){
        if(claimed)await store.fail(source.id,token,{retryMs:300000,nextDueAt:+now+300000}).catch(()=>{});
        // Never return upstream response bodies, URLs with credentials, or secrets.
        result.failed.push({sourceId:source.id,code:"source_refresh_failed"});
      }
    }
  }
  await Promise.all([worker(),worker()]);
  return result;
}
let lastSnapshot=null,readInFlight=null;
async function readLiveSnapshots({store=createSnapshotStore(),now=Date.now(),maxAgeMs=15000}={}){
  if(lastSnapshot && now-lastSnapshot.readAt<maxAgeMs)return lastSnapshot;
  if(readInFlight)return readInFlight;
  readInFlight=(async()=>{
    try{
      const sources=await store.read();
      if(!Array.isArray(sources))throw new Error("Invalid snapshot response");
      const revision=contentHash(sources.map(source=>[source.source_id,source.revision]));
      lastSnapshot={sources,revision,readAt:now,stale:false};return lastSnapshot;
    }catch(error){if(lastSnapshot)return {...lastSnapshot,stale:true};throw error;}
    finally{readInFlight=null;}
  })();
  return readInFlight;
}
module.exports={refreshInterval,contentHash,overlaySnapshots,createSnapshotStore,refreshDueSources,readLiveSnapshots};
