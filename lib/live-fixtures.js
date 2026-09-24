"use strict";
const crypto=require("node:crypto");
const {mergeFixtureSnapshot}=require("./fixture-snapshot");
const identity=require("../config/fixture-identity");
const {supabaseServiceRequest}=require("./supabase-server");
const TABLE="nothingsports_fixture_sources";
const CURRENT_TABLE="nothingsports_fixture_current";
const VOLATILE=new Set(["checkedAt","updatedAt","sourceCheckedAt","canonicalSourceCheckedAt","generatedAt","statusUpdatedAt"]);
const SCORE_FIELDS=['homeScore','awayScore','scoreDisplay','score','sets','games','innings','rubbers','canonicalResultScoreline'];
function splitScores(fixtures){return {fixtures:fixtures.map(e=>Object.fromEntries(Object.entries(e).filter(([key])=>!SCORE_FIELDS.includes(key)))),scores:fixtures.map(e=>({id:String(e.id||e.eventId||e.canonicalEventId),status:e.status,...Object.fromEntries(SCORE_FIELDS.filter(k=>e[k]!=null).map(k=>[k,e[k]]))}))};}
function contentHash(fixtures){
  const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==="object"
    ?Object.fromEntries(Object.keys(value).sort().filter(key=>!VOLATILE.has(key)).map(key=>[key,stable(value[key])])):value;
  return crypto.createHash("sha256").update(JSON.stringify(stable(fixtures))).digest("hex");
}
function refreshInterval(fixtures,now=new Date()){
  if((fixtures||[]).some(e=>require('../config/match-centre').interrupted(e)&&Date.parse(e.restartTimeUtc)>=+now-120000&&Date.parse(e.restartTimeUtc)<=+now+1800000))return 120000;
  const active=(fixtures || []).filter(event=>!["completed","finished","past","cancelled","canceled","abandoned"].includes(event.status)).filter(event=>!require('../config/match-centre').interrupted(event)||(Date.parse(event.restartTimeUtc)>+now-120000&&Date.parse(event.restartTimeUtc)<+now+1800000));
  if(active.some(event=>event.status==="live" || Date.parse(event.startTimeUtc)<=+now && Date.parse(event.endTimeUtc)>+now))return 120000;
  if(active.some(event=>{const start=Date.parse(event.startTimeUtc||event.estimatedStartTimeUtc||event.timelineSortTimeUtc);return Number.isFinite(start)&&start>=+now-30*60000&&start<=+now+6*3600000;}))return 120000;
  return 30*60000;
}
function overlaySnapshots(events,snapshots){
  const updates=[...(snapshots||[])].filter(snapshot=>snapshot.source_id!=='discovery-ai-athletes').sort((a,b)=>String(a.checked_at||'').localeCompare(String(b.checked_at||''))).flatMap(snapshot=>snapshot.fixtures||[]);
  return identity.estimateTimeline(identity.mergeOverlays(events,updates));
}
function createSnapshotStore({request=supabaseServiceRequest}={}){
  const rpc=(name,body,options={})=>request(`/rest/v1/rpc/${name}`,{method:"POST",body,...options});
  return {
    async read({ids=[]}={}){
      const fixtureIds=[...new Set((ids||[]).map(String).filter(Boolean))].slice(0,60);
      try{
        const [manifest,current]=await Promise.all([
          request(`/rest/v1/${TABLE}?select=source_id,revision,checked_at,next_due_at,discovery_report&order=source_id.asc`,{timeoutMs:3000}),
          rpc("nothingsports_read_current_fixtures",{p_fixture_ids:fixtureIds.length?fixtureIds:null},{timeoutMs:3000}),
        ]);
        const bySource=new Map();
        for(const row of current||[]){
          if(!row?.source_id||!row?.fixture)continue;
          if(!bySource.has(row.source_id))bySource.set(row.source_id,[]);
          bySource.get(row.source_id).push(row.fixture);
        }
        return (manifest||[]).map(row=>({...row,scoreRevision:contentHash(bySource.get(row.source_id)||[]),fixtures:bySource.get(row.source_id)||[]}));
      }catch(error){
        // Deploys remain compatible until the additive normalized-table migration lands.
        if(![400,404].includes(Number(error?.status)))throw error;
        const rows=await request(`/rest/v1/${TABLE}?select=source_id,revision,fixtures,checked_at,next_due_at,discovery_report&order=source_id.asc`,{timeoutMs:3000});
        if(!fixtureIds.length)return rows;
        const selected=new Set(fixtureIds);
        return rows.map(row=>({...row,fixtures:(row.fixtures||[]).filter(event=>[event.id,event.eventId,event.canonicalEventId,...(event.sourceEventIds||[])].some(id=>selected.has(String(id))))}));
      }
    },
    async dueIds(){return request(`/rest/v1/${TABLE}?select=source_id,next_due_at`,{timeoutMs:3000});},
    async claim(id,token){const rows=await rpc("nothingsports_claim_fixture_source",{p_source_id:id,p_token:token});return rows?.[0] || null;},
    async publish(id,token,value){
      if(process.env.MATCH_CENTRE_SCORE_WRITES==='true'){
        const split=splitScores(value.fixtures);
        return rpc('nothingsports_publish_compact_scores',{p_source_id:id,p_token:token,p_fixtures:split.fixtures,p_scores:split.scores,p_hash:contentHash(split.fixtures),p_interval_ms:value.intervalMs,p_report:value.coverage||null});
      }
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
  // A database outage must not fan out into one failed claim per source.
  // Let the protected endpoint fail once and retain the published fallback.
  const known=store.dueIds?await store.dueIds():[];
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
const snapshotCache=new Map(),snapshotReads=new Map();
async function readLiveSnapshots({store=createSnapshotStore(),now=Date.now(),maxAgeMs=30000,ids=[]}={}){
  const scope=[...new Set((ids||[]).map(String).filter(Boolean))].sort().join(',');
  const lastSnapshot=snapshotCache.get(scope);
  if(lastSnapshot && now-lastSnapshot.readAt<maxAgeMs)return lastSnapshot;
  if(snapshotReads.has(scope))return snapshotReads.get(scope);
  const readInFlight=(async()=>{
    try{
      const sources=await store.read({ids});
      if(!Array.isArray(sources))throw new Error("Invalid snapshot response");
      const revision=contentHash(sources.map(source=>[source.source_id,source.revision,source.scoreRevision||null]));
      const snapshot={sources,revision,readAt:now,stale:false};snapshotCache.set(scope,snapshot);return snapshot;
    }catch(error){if(lastSnapshot)return {...lastSnapshot,stale:true};throw error;}
    finally{snapshotReads.delete(scope);}
  })();
  snapshotReads.set(scope,readInFlight);
  return readInFlight;
}
module.exports={TABLE,CURRENT_TABLE,refreshInterval,contentHash,overlaySnapshots,createSnapshotStore,refreshDueSources,readLiveSnapshots,splitScores};
