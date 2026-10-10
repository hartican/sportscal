"use strict";
const crypto=require("node:crypto");
const {mergeFixtureSnapshot}=require("./fixture-snapshot");
const identity=require("../config/fixture-identity");
const {supabaseServiceRequest}=require("./supabase-server");
const TABLE="nothingsports_fixture_sources";
const CURRENT_TABLE="nothingsports_fixture_current";
// Review/check timestamps describe observation freshness, not a change to fixture facts.
const VOLATILE=new Set(["lastReviewedAt","checkedAt","updatedAt","sourceCheckedAt","canonicalSourceCheckedAt","generatedAt","statusUpdatedAt","statusCheckedAt","scoreCheckedAt","resultSourceCheckedAt","participationCheckedAt","scoreFactObservedAt","statusFactObservedAt"]);
const compactObservations=require('./compact-fixture-observations');
const splitScores=compactObservations.split;
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
function overlaySnapshots(events,snapshots,{now=new Date(),stale=false}={}){
  const updates=[...(snapshots||[])].filter(snapshot=>snapshot.source_id!=='discovery-ai-athletes').sort((a,b)=>(Date.parse(a.checked_at)||0)-(Date.parse(b.checked_at)||0)).flatMap(snapshot=>(snapshot.fixtures||[]).map(event=>{
    // A collection poll may not include this retained final at all. It cannot
    // adjudicate newer published facts by replacing their fixture observation.
    const settled=/^(completed|finished|final|abandoned)$/i.test(event.status||'');
    const observed=event.sourceCheckedAt||event.canonicalSourceCheckedAt;
    return snapshot.checked_at&&!event.fixtureObservationSchema?{...event,sourceCheckedAt:settled&&observed?observed:snapshot.checked_at, manualEstimateHeld:Boolean(snapshot.failure_count>0||snapshot.last_error)}:{...event,manualEstimateHeld:Boolean(snapshot.failure_count>0||snapshot.last_error)};
  }));
  const merged=identity.estimateTimeline(identity.mergeOverlays(events,updates)).map(event=>event.competitionId==='competition:premier-league-2026-27'&&event.season==='2026/27'?require('../scripts/lib/epl-kickoff-certainty').qualify(event):event);
  return require('./session-order-estimates').apply(stale?merged.map(e=>({...e,manualEstimateHeld:true})):merged,now);
}
function createSnapshotStore({request=supabaseServiceRequest}={}){
  const rpc=(name,body,options={})=>request(`/rest/v1/rpc/${name}`,{method:"POST",body,...options});
  return {
    async read({ids=[],scope='global',preserveIds=[]}={}){
      const fixtureIds=[...new Set((ids||[]).map(String).filter(Boolean))].slice(0,60);
      if(!['global','match-centre'].includes(scope))throw Error('Invalid snapshot scope');
      const membershipIds=[...new Set(preserveIds.map(String))].sort();
      if(membershipIds.length>5000||membershipIds.some(id=>!/^[-a-z0-9_:]{1,200}$/i.test(id)))throw Error('Invalid membership identity budget');
      const near=scope==='match-centre'&&!fixtureIds.length;
      try{
        const [manifest,result]=await Promise.all([
          rpc('nothingsports_read_fixture_source_health',{}, {timeoutMs:3000}),
          rpc(near?'nothingsports_read_match_centre_fixture_bundle':fixtureIds.length?"nothingsports_read_current_fixtures":"nothingsports_read_current_fixture_bundle",near?{p_membership_ids:membershipIds}:{p_fixture_ids:fixtureIds.length?fixtureIds:null},{timeoutMs:3000}),
        ]);
        if(!fixtureIds.length&&(result?.schemaVersion!=="current-fixture-bundle.v1"||result.complete!==true||!Array.isArray(result.rows)||result.rows.length>5000))throw Error("Incomplete current fixture bundle");
        if(near&&result.scope!=='match-centre')throw Error('Wrong membership snapshot scope');
        const current=fixtureIds.length?result:result.rows;
        const bySource=new Map();
        for(const row of current||[]){
          if(!row?.source_id||!row?.fixture)continue;
          if(!bySource.has(row.source_id))bySource.set(row.source_id,[]);
          bySource.get(row.source_id).push(row.fixture);
        }
        return (manifest||[]).map(row=>({...row,discovery_report:compactObservations.publicReport(row.discovery_report),scoreRevision:contentHash(bySource.get(row.source_id)||[]),fixtures:bySource.get(row.source_id)||[]}));
      }catch(error){
        // Deploys remain compatible until the additive normalized-table migration lands.
        if(![400,404].includes(Number(error?.status)))throw error;
        const rows=await request(`/rest/v1/${TABLE}?select=source_id,revision,fixtures,checked_at,next_due_at,discovery_report&order=source_id.asc`,{timeoutMs:3000});
        const publicRows=rows.map(row=>({...row,discovery_report:compactObservations.publicReport(row.discovery_report)}));
        if(!fixtureIds.length)return publicRows;
        const selected=new Set(fixtureIds);
        return publicRows.map(row=>({...row,fixtures:(row.fixtures||[]).filter(event=>[event.id,event.eventId,event.canonicalEventId,...(event.sourceEventIds||[])].some(id=>selected.has(String(id))))}));
      }
    },
    async dueIds(){return request(`/rest/v1/${TABLE}?select=source_id,next_due_at`,{timeoutMs:3000});},
    async claim(id,token){const rows=await rpc("nothingsports_claim_fixture_source",{p_source_id:id,p_token:token});return rows?.[0] || null;},
    async publish(id,token,value){
      if(process.env.MATCH_CENTRE_SCORE_WRITES==='true'){
        const split=splitScores(value.fixtures,{observedFixtures:value.observedFixtures||value.fixtures,now:value.observedAt||new Date()});
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
  const dueAt=new Map(known.map(row=>[row.source_id,Date.parse(row.next_due_at)]));
  // A receipt a few seconds after the cron tick must not postpone a live
  // source for an entire second tick. Wait within this invocation's existing
  // deadline, then let the database enforce the exact source minimum.
  const dueLookaheadMs=Math.min(5000,maxRuntimeMs);
  const notDue=new Set(known.filter(row=>Date.parse(row.next_due_at)>+now+dueLookaheadMs).map(row=>row.source_id));
  const eligible=sources.filter(source=>!notDue.has(source.id));
  result.skipped.push(...sources.filter(source=>notDue.has(source.id)).map(source=>source.id));
  // Rotate only due work so a slow source cannot permanently starve the tail.
  const pivot=eligible.length?Math.floor(+now/60000)%eligible.length:0;
  // Backlogged season discovery must not consume the whole invocation before
  // current scores. Keep fair rotation within each bounded priority class.
  const priority=source=>source.id==='cricket-ca-current'?0:source.id.startsWith('live-')||source.id.endsWith('-near')?1:2;
  const pending=[...eligible.slice(pivot),...eligible.slice(0,pivot)].sort((a,b)=>priority(a)-priority(b));
  async function worker(){
    while(pending.length){
      const source=pending.shift(),token=crypto.randomUUID();
      const waitMs=dueAt.get(source.id)>Date.now()?dueAt.get(source.id)-Date.now()+100:0;
      if(waitMs){
        if(Date.now()+waitMs>=deadline-(source.minimumRuntimeMs||1000)){result.skipped.push(source.id);continue;}
        await new Promise(resolve=>setTimeout(resolve,waitMs));
      }
      if(Date.now()>=deadline-(source.minimumRuntimeMs||1000)){result.skipped.push(source.id);continue;}
      let claimed=false,priorCoverage={},priorFailures=0;
      try{
        const row=await store.claim(source.id,token);
        if(!row){result.skipped.push(source.id);continue;}claimed=true;
        priorCoverage=compactObservations.publicReport(row.discovery_report)||{};
        priorFailures=Math.max(0,Number(row.failure_count)||0);
        const previous=row.fixtures?.length?row.fixtures:(source.seed || []);
        let timer;const controller=new AbortController();
        const incoming=await Promise.race([
          source.fetch({now,previous,coverage:priorCoverage,signal:controller.signal}),
          new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(new Error("Source deadline exceeded")),Math.min(source.timeoutMs||25000,Math.max(1,deadline-Date.now())));}),
        ]).finally(()=>{clearTimeout(timer);controller.abort();});
        if(!Array.isArray(incoming))throw new Error("Source response is not a fixture collection");
        const merged=mergeFixtureSnapshot(previous,incoming);
        if(incoming.length===merged.invalid&&!(incoming.length===0&&source.allowEmpty))throw new Error("Source returned no usable fixture records");
        const fixtures=merged.events.map(event=>event.enrichmentOnly?event:identity.normalizeCore(event)).filter(e=>e.enrichmentOnly||require('../config/follow-feed-policy').activeEligible(e));
        const partial=Boolean(incoming.coverage?.failures?.length);
        const intervalMs=partial?Math.max(source.retryMs||0,300000):Math.max(source.minimumIntervalMs || 0,source.refreshInterval?source.refreshInterval(fixtures,+now):refreshInterval(fixtures,now));
        await store.publish(source.id,token,{fixtures,hash:contentHash(fixtures),intervalMs,nextDueAt:+now+intervalMs,coverage:incoming.coverage,observedFixtures:incoming,observedAt:now});
        result.refreshed.push(source.id);
        if(partial)result.failed.push({sourceId:source.id,code:'source_refresh_partial'});
      }catch(error){
        // Repeated failures back off, preserving explicit longer source retry budgets.
        const baseRetryMs=source.retryMs||300000;
        const retryMs=Math.min(Math.max(baseRetryMs,1800000),baseRetryMs*2**Math.min(priorFailures,6));
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
async function readLiveSnapshots({store=createSnapshotStore(),now=Date.now(),maxAgeMs=30000,ids=[],scope='global',preserveIds=[]}={}){
  const key=JSON.stringify([scope,[...new Set((ids||[]).map(String).filter(Boolean))].sort(),scope==='match-centre'?[...new Set(preserveIds.map(String))].sort():[]]);
  const lastSnapshot=snapshotCache.get(key);
  if(lastSnapshot && now-lastSnapshot.readAt<maxAgeMs)return lastSnapshot;
  if(snapshotReads.has(key))return snapshotReads.get(key);
  const readInFlight=(async()=>{
    try{
      const sources=await store.read({ids,scope,preserveIds});
      if(!Array.isArray(sources))throw new Error("Invalid snapshot response");
      const revision=contentHash(sources.map(source=>[source.source_id,source.revision,source.scoreRevision||null]));
      const snapshot={sources,revision,readAt:now,stale:false};snapshotCache.set(key,snapshot);return snapshot;
    }catch(error){if(lastSnapshot)return {...lastSnapshot,stale:true};throw error;}
    finally{snapshotReads.delete(key);}
  })();
  snapshotReads.set(key,readInFlight);
  return readInFlight;
}
module.exports={TABLE,CURRENT_TABLE,refreshInterval,contentHash,overlaySnapshots,createSnapshotStore,refreshDueSources,readLiveSnapshots,splitScores};
