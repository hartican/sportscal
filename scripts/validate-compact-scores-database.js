'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {splitScores,contentHash,createSnapshotStore,overlaySnapshots}=require('../lib/live-fixtures');
const {createMatchCentreHandler}=require('../lib/match-centre-handler');
(async()=>{
 const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite'),db=new PGlite();
 const evidence={schema:'compact-observations-test.v1',scenarios:[],benchmarks:[]};
 try{
  await db.exec("set timezone='UTC';create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to service_role;");
  for(const name of ['20260908093906_live_fixture_snapshots.sql','20260908110529_discovery_source_health.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20260914061506_right_size_fixture_runtime.sql','utf8').split('-- One write replaces')[0]);
  await db.exec(fs.readFileSync('supabase/migrations/20260924104317_compact_live_scores.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20261002171936_preserve_compact_fixture_observations.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20261006182007_bound_current_fixture_snapshot.sql','utf8'));
  await db.exec('set role service_role');
  const token='11111111-1111-4111-8111-111111111111';
  const request=async(path,{body}={})=>{
   const name=path.split('/').at(-1);
   const keys={nothingsports_publish_compact_scores:['p_source_id','p_token','p_fixtures','p_scores','p_hash','p_interval_ms','p_report'],nothingsports_read_current_fixture_bundle:['p_fixture_ids'],nothingsports_read_current_fixtures:['p_fixture_ids'],nothingsports_read_match_scores:['p_fixture_ids'],nothingsports_read_fixture_source_health:[]}[name];
   assert(keys,'Unexpected RPC '+name);
   const result=(await db.query(`select * from public.${name}(${keys.map((k,i)=>'$'+(i+1)).join(',')})`,keys.map(k=>['p_fixtures','p_scores','p_report'].includes(k)?body[k]===null?null:JSON.stringify(body[k]):body[k]))).rows;return name==='nothingsports_read_current_fixture_bundle'?result[0][name]:result;
  };
  const store=createSnapshotStore({request});
  const previousMode=process.env.MATCH_CENTRE_SCORE_WRITES;process.env.MATCH_CENTRE_SCORE_WRITES='true';
  const at=n=>`2026-09-24T${String(n).padStart(2,'0')}:00:00+00:00`;
  const event={id:'match',key:'nrl',status:'completed',startTimeUtc:'2026-09-24T08:00:00Z',homeParticipantId:'home',awayParticipantId:'away',homeScore:1,awayScore:0,sourceCheckedAt:at(12)};
  const lease=async source=>db.query("insert into public.nothingsports_fixture_sources(source_id,lease_token,lease_until) values($1,$2,now()+interval '1 hour') on conflict(source_id) do update set lease_token=excluded.lease_token,lease_until=excluded.lease_until",[source,token]);
  const publish=async(fixtures,observedFixtures=fixtures,source='test',coverage)=>{await lease(source);return store.publish(source,token,{fixtures,observedFixtures,hash:contentHash(fixtures),intervalMs:120000,coverage});};
  const read=async(id='match')=>(await request('/rpc/nothingsports_read_match_scores',{body:{p_fixture_ids:[id]}}))[0].fixture;
  const rows=async source=>(await db.query("select fixture_id,ctid::text,score,first_completed_at from public.nothingsports_live_scores where source_id=$1 order by fixture_id",[source])).rows;
  try{
   await publish([event]);const initial=await rows('test');const firstComplete=initial[0].first_completed_at;
   const rechecked={...event,sourceCheckedAt:at(13)};await publish([rechecked]);
   assert.equal((await rows('test'))[0].ctid,initial[0].ctid,'verification-only tick never writes compact row');
   let fixture=await read();assert.equal(fixture.scoreCheckedAt,at(13));assert.equal(fixture.scoreFactObservedAt,at(12));assert.equal(fixture.awayScore,0);
   assert.equal((await db.query('select count(*) n from public.nothingsports_fixture_snapshots')).rows[0].n,1);
   const correction={...rechecked,homeScore:2,sourceCheckedAt:at(14)};await publish([correction]);
   fixture=await read();assert.equal(fixture.homeScore,2);assert.equal(fixture.scoreFactObservedAt,at(14));
   const base={...event,sourceCheckedAt:at(13)};
   assert.equal(overlaySnapshots([base],[{checked_at:at(20),fixtures:[fixture]}])[0].homeScore,2,'actual Feed overlay accepts genuinely newer correction');
   const handler=createMatchCentreHandler({enabled:()=>true,published:()=>[base],request});let result;
   await handler({url:'/api/match-centre?ids=match'},{setHeader(){},status(){return this;},json(value){result=value;}});
   assert.equal(result.fixtures[0].score.home,2,'actual Match Centre handler renders corrected final');assert.equal(result.fixtures[0].score.away,0);
   evidence.scenarios.push('genuine final correction, zero score, actual Feed/Match Centre, original observations');
   const changedCtid=(await rows('test'))[0].ctid;
   for(const bad of [{...correction,homeScore:9,sourceCheckedAt:at(13)},{...correction,homeScore:9,sourceCheckedAt:at(14)},{...correction,status:'live',homeScore:3,sourceCheckedAt:at(15)},{...correction,status:'scheduled',homeScore:3,sourceCheckedAt:at(16)},{...correction,homeScore:9,sourceCheckedAt:'nonsense'},{...correction,homeScore:9,sourceCheckedAt:'2999-01-01T00:00:00Z'}]){
    await publish([bad]);fixture=await read();assert.equal(fixture.homeScore,2);assert.equal(fixture.status,'completed');assert.equal(fixture.scoreCheckedAt,at(14));
   }
   assert.equal((await rows('test'))[0].ctid,changedCtid,'rejected observations do not churn score rows');
   evidence.scenarios.push('older/equal contradictory/future/invalid clocks rejected; settled result never reopened');
   await publish([correction],[{id:'match',status:'completed',homeScore:7,sourceCheckedAt:at(16)}]);assert.equal((await read()).homeScore,2,'partial home/away observations cannot overwrite or verify a pair');
   await publish([correction],[]);fixture=await read();assert.equal(fixture.scoreCheckedAt,at(14),'omitted fixture is not reverified');
   await publish([{...correction,sourceCheckedAt:at(17)}],[{id:'match',status:'completed',sourceCheckedAt:at(17)}]);
   fixture=await read();assert.equal(fixture.scoreCheckedAt,at(14));assert.equal(fixture.statusCheckedAt,at(17),'status-only response does not freshen omitted scores');
   assert.equal((await rows('test'))[0].ctid,changedCtid,'status verification uses receipt only');
   await lease('test');await db.query('select public.nothingsports_fail_fixture_source_report($1,$2,$3,$4)',['test',token,300000,JSON.stringify({status:'failed'})]);
   assert.equal((await read()).scoreCheckedAt,at(14),'failed source does not erase/freshen receipts');
   const health=await request('/rpc/nothingsports_read_fixture_source_health');assert(!JSON.stringify(health).includes('_fixtureObservations'));
   assert.equal(health.find(s=>s.source_id==='test').discovery_report.status,'failed');
   evidence.scenarios.push('omitted fixture/score independent from status; failure retains last observations; private receipts absent from source DTO');
   await publish([{...correction,sourceCheckedAt:at(18)}]);fixture=await read();assert.equal(fixture.scoreCheckedAt,at(18));assert.equal(fixture.scoreFactObservedAt,at(14));
   assert.equal(+(await rows('test'))[0].first_completed_at,+firstComplete,'first completion survives correction/recovery');
   assert.equal((await db.query("select count(*) n from public.nothingsports_fixture_snapshots where source_id='test'")).rows[0].n,4,'non-score status changes use the existing snapshot channel');
   // Legacy deployments retain their caller signature; genuine source clocks are recovered.
   const legacy={...event,id:'legacy',status:'live',homeScore:0,awayScore:0};await lease('legacy');
   const oldSplit=splitScores([legacy]);oldSplit.scores=oldSplit.scores.map(({observationSchema,scoreObserved,statusObserved,scoreCheckedAt,statusCheckedAt,...s})=>s);
   await db.query('select public.nothingsports_publish_compact_scores($1,$2,$3,$4,$5,$6)',['legacy',token,JSON.stringify(oldSplit.fixtures),JSON.stringify(oldSplit.scores),contentHash(oldSplit.fixtures),120000]);
   assert.equal((await read('legacy')).scoreCheckedAt,at(12));
   const unknown={...legacy,id:'unknown'};delete unknown.sourceCheckedAt;await publish([unknown],[unknown],'unknown');
   fixture=await read('unknown');assert.equal(fixture.scoreCheckedAt,null);assert.equal(fixture.statusCheckedAt,null);
   const knownBase={...unknown,homeScore:1,sourceCheckedAt:at(13)};assert.equal(overlaySnapshots([knownBase],[{checked_at:at(20),fixtures:[fixture]}])[0].homeScore,1,'unknown compact date cannot beat known published score');
   evidence.scenarios.push('compatible old publisher; unknown-clock transition remains unknown');
   const live={...legacy,id:'stationary',sourceCheckedAt:at(12)};await publish([live],[live],'stationary');const liveRow=(await rows('stationary'))[0];
   await publish([{...live,sourceCheckedAt:at(13)}],undefined,'stationary');fixture=await read('stationary');assert.equal(fixture.scoreCheckedAt,at(13));assert.equal(fixture.scoreFactObservedAt,at(12));assert.equal((await rows('stationary'))[0].ctid,liveRow.ctid);
   assert.equal((await db.query("select count(*) n from public.nothingsports_fixture_snapshots where source_id='stationary'")).rows[0].n,1);
   evidence.scenarios.push('stationary live 0–0 remains genuinely verified without score/history churn');
   // Replay a real production final whose check clocks previously caused full-season churn.
   const captured=require('./fixtures/epl-result-observation-clocks.json').rows.map(({fixture})=>{
    const score=require('./fixtures/epl-result-observation-score.json').fixture;
    return {...fixture,...score,scoreCheckedAt:fixture.scoreCheckedAt,statusCheckedAt:fixture.sourceCheckedAt};
   });
   await publish([captured[0]],undefined,'epl-captured');
   const finalRow=(await rows('epl-captured'))[0];
   await publish([captured[1]],undefined,'epl-captured');
   assert.equal((await db.query("select count(*) n from public.nothingsports_fixture_snapshots where source_id='epl-captured'")).rows[0].n,1,'actual final recheck must not create a full fixture snapshot');
   assert.equal((await rows('epl-captured'))[0].ctid,finalRow.ctid,'actual final recheck must not rewrite its compact score');
   fixture=await read(captured[0].id);
   assert.equal(Date.parse(fixture.scoreCheckedAt),Date.parse(captured[1].scoreCheckedAt),'actual verification receipt advances');
   assert.equal(Date.parse(fixture.scoreFactObservedAt),Date.parse(captured[0].scoreCheckedAt),'unchanged score retains original fact observation');
   assert.equal(fixture.homeScore,3);assert.equal(fixture.awayScore,0);
   const retained=(await db.query("select fixtures from public.nothingsports_fixture_snapshots where source_id='epl-captured'")).rows[0].fixtures[0];
   assert.equal(retained.resultSourceCheckedAt,captured[0].resultSourceCheckedAt,'stored snapshot keeps its original result observation');
   // A source written by the previous hash algorithm gets one transition, then stabilises.
   await db.query("update public.nothingsports_fixture_sources set content_hash=$1 where source_id='epl-captured'",['9d5732845a0fc2dbc6e4a883800657ccf151984b118d0e393f551165b670b6ca']);
   await publish([captured[1]],undefined,'epl-captured');await publish([captured[1]],undefined,'epl-captured');
   assert.equal((await db.query("select count(*) n from public.nothingsports_fixture_snapshots where source_id='epl-captured'")).rows[0].n,2,'one old-hash transition is followed by stable unchanged reruns');
   const resultCorrection={...captured[1],homeScore:4,score:'Arsenal 4-0 Coventry City',canonicalResultScoreline:'Arsenal 4-0 Coventry City',scoreCheckedAt:'2026-10-02T18:00:00Z',sourceCheckedAt:'2026-10-02T18:00:00Z'};
   await publish([resultCorrection],undefined,'epl-captured');
   assert.equal((await read(captured[0].id)).homeScore,4,'real final correction still persists');
   assert.notEqual((await rows('epl-captured'))[0].ctid,finalRow.ctid,'real corrected score uses its compact row');
   assert.equal((await db.query("select count(*) n from public.nothingsports_fixture_snapshots where source_id='epl-captured'")).rows[0].n,2,'score-only correction avoids another full snapshot');
   evidence.scenarios.push('captured EPL final: stable full snapshot/compact row, genuine verification, original clocks, one old-hash transition and real correction');
   assert.equal((await request('/rpc/nothingsports_read_match_scores',{body:{p_fixture_ids:[]}})).length,0);
   assert.equal((await request('/rpc/nothingsports_read_match_scores',{body:{p_fixture_ids:Array(61).fill('match')}})).length,0);
   await assert.rejects(db.query('select public.nothingsports_publish_compact_scores($1,$2,$3,$4,$5,$6)',['test',token,'[]','[]','bad',120000]),/Lease expired/);
   assert.throws(()=>splitScores([event],{observedFixtures:[event,{...event}]}),/Ambiguous/);
   assert.throws(()=>splitScores(Array(5001).fill(event)),/budget/);
   evidence.scenarios.push('lease fencing, identity ambiguity, 60-ID reads and 5000-record budget');
   const representation={...event,id:'representation',scoreDisplay:'1–0'};await publish([representation],undefined,'representation');
   await publish([{...representation,homeScore:2,scoreDisplay:undefined,sourceCheckedAt:at(14)}],undefined,'representation');
   assert.equal((await read('representation')).homeScore,2);assert.equal((await read('representation')).scoreDisplay,undefined,'accepted score group removes contradictory older display');
   await publish([{...correction,status:'abandoned',sourceCheckedAt:at(19)}]);assert.equal((await read()).status,'abandoned');
   await publish([{...correction,status:'completed',sourceCheckedAt:at(20)}]);assert.equal((await read()).status,'completed');
   evidence.scenarios.push('whole observed score representation replaces conflicting old display; newer settled adjudications retained');
   // Representative largest current source (~959 rows); full ceiling benchmark is opt-in.

   for(const count of (process.env.COMPACT_FULL_BENCH==='1'?[1000,5000]:[1000])){
    const batch=Array.from({length:count},(_,i)=>({...live,id:`bench-${count}-${i}`}));const source='bench-'+count;
    let start=performance.now();await publish(batch,undefined,source);const initialMs=performance.now()-start;
    const before=await rows(source);start=performance.now();await publish(batch.map(e=>({...e,sourceCheckedAt:at(13)})),undefined,source);const unchangedMs=performance.now()-start;
    assert.deepEqual((await rows(source)).map(r=>r.ctid),before.map(r=>r.ctid));
    const size=(await db.query("select octet_length((discovery_report->'_fixtureObservations')::text) bytes from public.nothingsports_fixture_sources where source_id=$1",[source])).rows[0].bytes;
    const bounded=await store.read({ids:[batch[0].id]});assert.equal(bounded.find(s=>s.source_id===source).fixtures.length,1);assert(!JSON.stringify(bounded).includes('_fixtureObservations'));
    evidence.benchmarks.push({count,initialMs:Math.round(initialMs),unchangedMs:Math.round(unchangedMs),receiptBytes:size,boundedReadBytes:Buffer.byteLength(JSON.stringify(bounded))});
   }
   for(const role of ['anon','authenticated']){
   await db.exec('reset role;set role '+role);
   for(const query of ['select * from public.nothingsports_live_scores','select * from public.nothingsports_read_fixture_source_health()','select * from public.nothingsports_read_match_scores(array[\'match\'])','select public.nothingsports_fixture_observation_time(\'2026-09-24T12:00:00Z\')'])await assert.rejects(db.query(query),/permission denied/);
   }
   evidence.scenarios.push('service-only invoker helpers/readers; anonymous and authenticated execution denied');
  }finally{if(previousMode===undefined)delete process.env.MATCH_CENTRE_SCORE_WRITES;else process.env.MATCH_CENTRE_SCORE_WRITES=previousMode;}
  if(process.env.COMPACT_OBSERVATION_EVIDENCE)fs.writeFileSync(process.env.COMPACT_OBSERVATION_EVIDENCE,JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify(evidence,null,2));
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
