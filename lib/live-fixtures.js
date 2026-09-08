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
  const updates=[...(snapshots||[])].sort((a,b)=>String(a.checked_at||'').localeCompare(String(b.checked_at||''))).flatMap(snapshot=>snapshot.fixtures||[]);
  return identity.estimateTimeline(identity.mergeOverlays(events,updates));
}
function createSnapshotStore({request=supabaseServiceRequest}={}){
  const rpc=(name,body)=>request(`/rest/v1/rpc/${name}`,{method:"POST",body});
  return {
    async read(){return request(`/rest/v1/${TABLE}?select=source_id,revision,fixtures,checked_at,discovery_report&order=source_id.asc`);},
    async dueIds(){return request(`/rest/v1/${TABLE}?select=source_id,next_due_at`);},
    async claim(id,token){const rows=await rpc("nothingsports_claim_fixture_source",{p_source_id:id,p_token:token});return rows?.[0] || null;},
    async publish(id,token,value){
      return rpc(value.coverage?'nothingsports_publish_fixture_source_report':'nothingsports_publish_fixture_source',{p_source_id:id,p_token:token,p_fixtures:value.fixtures,p_hash:value.hash,p_interval_ms:value.intervalMs,...(value.coverage?{p_report:value.coverage}:{})});
    },
    async fail(id,token,value){
      return rpc(value.coverage?'nothingsports_fail_fixture_source_report':'nothingsports_fail_fixture_source',{p_source_id:id,p_token:token,p_retry_ms:value.retryMs,...(value.coverage?{p_report:value.coverage}:{})});
    },
  };
}
async function refreshDueSources({sources,store=createSnapshotStore(),now=new Date(),maxRuntimeMs=45000}={}){
  const result={refreshed:[],skipped:[],failed:[]};
  const deadline=Date.now()+maxRuntimeMs;
  // Two bounded source workers; database leases also coalesce other invocations.
  const known=store.dueIds?await store.dueIds().catch(()=>[]):[];
  const notDue=new Set(known.filter(row=>Date.parse(row.next_due_at)>+now).map(row=>row.source_id));
  const eligible=sources.filter(source=>!notDue.has(source.id));
  result.skipped.push(...sources.filter(source=>notDue.has(source.id)).map(source=>source.id));
  // Rotate only due work so a slow source cannot permanently starve the tail.
  const pivot=eligible.length?Math.floor(+now/60000)%eligible.length:0;
  const pending=[...eligible.slice(pivot),...eligible.slice(0,pivot)];
  async function worker(){
    while(pending.length){
      const source=pending.shift(),token=crypto.randomUUID();
      if(Date.now()>=deadline-(source.minimumRuntimeMs||1000)){result.skipped.push(source.id);continue;}
      let claimed=false,priorCoverage={};
      try{
        const row=await store.claim(source.id,token);
        if(!row){result.skipped.push(source.id);continue;}claimed=true;
        priorCoverage=row.discovery_report||{};
        const previous=row.fixtures?.length?row.fixtures:(source.seed || []);
        let timer;const controller=new AbortController();
        const incoming=await Promise.race([
          source.fetch({now,previous,coverage:priorCoverage,signal:controller.signal}),
          new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(new Error("Source deadline exceeded")),Math.min(source.timeoutMs||25000,Math.max(1,deadline-Date.now())));}),
        ]).finally(()=>{clearTimeout(timer);controller.abort();});
        if(!Array.isArray(incoming))throw new Error("Source response is not a fixture collection");
        const merged=mergeFixtureSnapshot(previous,incoming);
        if(incoming.length===merged.invalid&&!(incoming.length===0&&source.allowEmpty))throw new Error("Source returned no usable fixture records");
        const fixtures=merged.events.map(event=>event.enrichmentOnly?event:identity.normalizeCore(event));
        const partial=Boolean(incoming.coverage?.failures?.length);
        const intervalMs=partial?Math.max(source.retryMs||0,300000):Math.max(source.minimumIntervalMs || 0,refreshInterval(fixtures,now));
        await store.publish(source.id,token,{fixtures,hash:contentHash(fixtures),intervalMs,nextDueAt:+now+intervalMs,coverage:incoming.coverage});
        result.refreshed.push(source.id);
        if(partial)result.failed.push({sourceId:source.id,code:'source_refresh_partial'});
      }catch(error){
        const retryMs=source.retryMs||300000;
        const code=['ai_not_configured','ai_billing_required','ai_auth_unavailable','ai_rate_limited','watchlist_unavailable'].includes(error.code)?error.code:'source_refresh_failed';
        if(claimed)await store.fail(source.id,token,{retryMs,nextDueAt:+now+retryMs,...(source.id.startsWith('discovery-')?{coverage:{...priorCoverage,status:'failed',lastAttemptAt:now.toISOString(),failureCode:code}}:{})}).catch(()=>{});
        // Never return upstream response bodies, URLs with credentials, or secrets.
        result.failed.push({sourceId:source.id,code});
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
