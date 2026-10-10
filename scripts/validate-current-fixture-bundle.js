'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {createSnapshotStore,readLiveSnapshots}=require('../lib/live-fixtures');
(async()=>{
 const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite'),db=new PGlite();
 try{
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to service_role;");
  for(const name of ['20260908093906_live_fixture_snapshots.sql','20260908110529_discovery_source_health.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20260914061506_right_size_fixture_runtime.sql','utf8').split('-- One write replaces')[0]);
  for(const name of ['20260924104317_compact_live_scores.sql','20261002171936_preserve_compact_fixture_observations.sql','20261006182007_bound_current_fixture_snapshot.sql','20261009041722_compact_public_fixture_bundle.sql','20261009074435_bound_match_centre_snapshot.sql','20261009082136_short_circuit_match_centre_snapshot.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8'));
  const nearReference=fs.readFileSync('supabase/migrations/20261009082136_short_circuit_match_centre_snapshot.sql','utf8').match(/create or replace function[\s\S]*?\$\$;/)[0].replace('nothingsports_read_match_centre_fixture_bundle','qa_reference_match_centre_bundle');
  await db.exec(nearReference);
  await db.exec(fs.readFileSync('supabase/migrations/20261010140637_materialize_match_centre_read_receipts.sql','utf8'));
  const nearEquivalent=async ids=>assert.equal((await db.query('select public.nothingsports_read_match_centre_fixture_bundle($1)=public.qa_reference_match_centre_bundle($1) as same',[ids])).rows[0].same,true,'Materialising source receipts preserves every current fixture field and original observation');
  const reference=fs.readFileSync('supabase/migrations/20261009041722_compact_public_fixture_bundle.sql','utf8').match(/create or replace function[\s\S]*?\$\$;/)[0].replace('nothingsports_read_current_fixture_bundle','qa_reference_fixture_bundle');
  await db.exec(reference);
  await db.exec(fs.readFileSync('supabase/migrations/20261010111935_materialize_fixture_read_inputs.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20261010112416_branch_fixture_bundle_read_scope.sql','utf8'));
  await db.exec("create table public.nothingsports_reminder_intents(fixture_id text,enabled boolean,choice text);create table public.nothingsports_reminders(event_id text,dispatched_at timestamptz);grant select on public.nothingsports_reminder_intents,public.nothingsports_reminders to service_role;");
  await db.exec(fs.readFileSync('supabase/migrations/20261010114326_bound_reminder_fixture_read_scope.sql','utf8'));
  const equivalent=async ids=>assert.equal((await db.query('select public.nothingsports_read_current_fixture_bundle($1)=public.qa_reference_fixture_bundle($1) as same',[ids])).rows[0].same,true,'Optimised shared read preserves every fixture field and original observation');
  await db.exec("insert into public.nothingsports_fixture_sources(source_id) values ('a-calendar'),('z-current');");
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const events=Array.from({length:1200},(_,i)=>({id:'fixture:'+i,status:'scheduled',date:day}));events.push({id:'late-current',key:'tennis',status:'live',date:day},{id:'expired-history',status:'completed',date:'2020-01-01'},{id:'old-live-uncertain',status:'live',date:'2020-01-01'},{id:'unknown-date',status:'scheduled'},{id:'future-outside-horizon',status:'scheduled',date:'2099-01-01'});
  const factAt=new Date(Date.now()-120000).toISOString(),receiptAt=new Date(Date.now()-60000).toISOString();
  events.push({id:'large-parent',kind:'tournament',date:day,status:'scheduled',participants:[{id:'player:1',name:'Player One'}],sourceUrl:'https://example.test/official',canonicalEventId:'canonical:parent',fixtureIdAliases:['alias:parent'],subEvents:Array.from({length:300},(_,i)=>({id:'draw:'+i,detail:'x'.repeat(1000)})),editorialNarrative:'e'.repeat(50000),storyline:{stakes:4},fullSpiel:'full context',selectedSentence:'selected',spiel:'spiel'},
   {id:'team-tie',kind:'fixture',date:day,status:'scheduled',subEvents:[{id:'rubber:1',participants:['player:1','player:2']}],rubbers:[{id:'rubber:1',score:'6-4'}]});
  await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,fixture,identity_keys,content_hash) select case when e->>'id' like 'fixture:%' then 'a-calendar' else 'z-current' end,e->>'id',e,array[e->>'id'],md5(e::text) from jsonb_array_elements($1::jsonb) e",[JSON.stringify(events)]);
  await db.query("insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash,first_completed_at) values('z-current','large-parent',$1::jsonb,'score',$2::timestamptz)",[JSON.stringify({id:'large-parent',status:'completed',homeScore:2,scoreCheckedAt:factAt,statusCheckedAt:factAt}),factAt]);
  await db.query("update public.nothingsports_fixture_sources set discovery_report=jsonb_build_object('_fixtureObservations',jsonb_build_object('large-parent',jsonb_build_object('s',$1::text,'t',$1::text))) where source_id='z-current'",[receiptAt]);
  await db.exec('set role service_role');let calls=[];
  const request=async(route,{body})=>{calls.push(route);const name=route.split('/').at(-1),parameter=body.p_membership_ids!==undefined?body.p_membership_ids:body.p_fixture_ids,rows=(await db.query(`select * from public.${name}(${parameter!==undefined?'$1':''})`,parameter!==undefined?[parameter]:[])).rows;return name.endsWith('_fixture_bundle')?rows[0][name]:rows.slice(0,1000);};
  const store=createSnapshotStore({request}),global=await store.read(),all=global.flatMap(s=>s.fixtures);
  assert.equal(calls.length,2,'The global read preserves the two-query budget');assert.equal(all.length,1205);assert(all.some(e=>e.id==='late-current'),'A later source survives the transport row ceiling');assert(!all.some(e=>e.id==='expired-history'));assert(!all.some(e=>e.id==='future-outside-horizon'));assert(all.some(e=>e.id==='old-live-uncertain'),'Explicit unresolved play retains the existing active-timeline rule');assert(all.some(e=>e.id==='unknown-date'),'Unknown dates are not deleted');
  const compact=all.find(e=>e.id==='large-parent');for(const field of ['subEvents','editorialNarrative','fullSpiel','selectedSentence','spiel'])assert.equal(compact[field],undefined,'Global parents omit duplicated '+field);assert.deepEqual(compact.storyline,{stakes:4},'Sporting priority metadata survives copy compaction');
  assert.deepEqual(compact.participants,events.at(-2).participants);assert.deepEqual(compact.fixtureIdAliases,['alias:parent']);assert.equal(compact.canonicalEventId,'canonical:parent');assert.equal(compact.sourceUrl,'https://example.test/official');assert.equal(compact.status,'completed');assert.equal(compact.homeScore,2);
  assert.equal(Date.parse(compact.scoreFactObservedAt),Date.parse(factAt));assert.equal(Date.parse(compact.statusFactObservedAt),Date.parse(factAt));assert.equal(Date.parse(compact.scoreCheckedAt),Date.parse(receiptAt));assert.equal(Date.parse(compact.firstConfirmedCompleteAt),Date.parse(factAt));
  assert.deepEqual(all.find(e=>e.id==='team-tie').subEvents,events.at(-1).subEvents,'Real team rubbers remain');assert.deepEqual(all.find(e=>e.id==='team-tie').rubbers,events.at(-1).rubbers);
  for(let read=0;read<7;read++)await equivalent(null);
  await equivalent(['large-parent']);await equivalent(['expired-history','unknown-date']);await equivalent(['missing-fixture']);await equivalent([]);
  // Exercise listing reuse through the actual SQL observation projection and
  // store, rather than only a hand-written snapshot stub.
  const observedNow=Date.now(),current={id:'late-current',key:'tennis',tournamentLevel:'WTA1000',date:day,status:'live',homeParticipantId:'player:one',awayParticipantId:'player:two',startTimeUtc:new Date(observedNow-600000).toISOString(),sets:[{home:6,away:3}],scoreCheckedAt:new Date(observedNow).toISOString(),statusCheckedAt:new Date(observedNow).toISOString()};
  await db.query("update public.nothingsports_fixture_current set fixture=$1::jsonb where fixture_id='late-current'",[JSON.stringify(current)]);
  const {createMatchCentreHandler}=require('../lib/match-centre-handler'),response=()=>({setHeader(){},status(){return this;},json(body){this.body=body;return this;}});
  calls=[];const listing=createMatchCentreHandler({enabled:()=>true,clock:()=>observedNow,published:()=>[],request,snapshotRead:async()=>({sources:await store.read(),readAt:observedNow,stale:false})}),listed=response();await listing({url:'/api/match-centre?membership=everything'},listed);
  assert.equal(calls.length,2,'Fresh listing ends after the existing two parallel membership reads');assert(!calls.some(route=>route.endsWith('nothingsports_read_match_scores')),'No duplicate score query after the real global projection');assert.equal(listed.body.fixtures.length,1);assert.deepEqual(listed.body.fixtures[0].score.sets,[{home:6,away:3}]);assert.equal(listed.body.fixtures[0].stale,false);
  calls=[];const polled=response();await listing({url:'/api/match-centre?ids=late-current'},polled);assert.equal(calls.length,1);assert(calls[0].endsWith('nothingsports_read_match_scores'),'Visible polling retains its selected-only database path');assert.deepEqual(polled.body.fixtures,listed.body.fixtures,'Both actual SQL paths return the same scores, sides, freshness and result provenance');
  const full=(await store.read({ids:['large-parent']})).flatMap(s=>s.fixtures).find(e=>e.id==='large-parent');assert.deepEqual(full.subEvents,events.at(-2).subEvents);assert.equal(full.editorialNarrative,events.at(-2).editorialNarrative);
  const selectedBundle=(await db.query('select public.nothingsports_read_current_fixture_bundle($1) as value',[['large-parent']])).rows[0].value;assert.equal(selectedBundle.rows[0].fixture.subEvents.length,300,'Explicit bundle IDs also retain context');
  const ordered=(await db.query('select public.nothingsports_read_current_fixture_bundle(null) as value')).rows[0].value.rows.map(r=>r.source_id+':'+r.fixture_id);assert.deepEqual(ordered,[...ordered].sort(),'Global transfer has deterministic source/fixture order');
  await db.query("update public.nothingsports_fixture_current set fixture=jsonb_set(fixture,'{date}','\"2020-01-01\"') where fixture_id='fixture:0'");
  await db.query("insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash) values('a-calendar','fixture:0',$1::jsonb,'date-overlay')",[JSON.stringify({id:'fixture:0',date:day})]);
  assert((await store.read()).flatMap(s=>s.fixtures).some(e=>e.id==='fixture:0'),'Effective score-overlay dates determine retention');
  calls=[];const selected=await store.read({ids:['expired-history']});assert.equal(calls.length,2);assert(selected.flatMap(s=>s.fixtures).some(e=>e.id==='expired-history'),'Explicit selected-ID reads retain archived/source context');assert(calls.some(r=>r.endsWith('nothingsports_read_current_fixtures')));
  // The near read drops only safely distant schedules, never corrections to
  // a known member, live-only arrivals, results, pauses or uncertain clocks.
  const scopedNow=Date.now(),nearStart=new Date(scopedNow+20*60000).toISOString(),farStart=new Date(scopedNow+4*3600000).toISOString(),checkAt=new Date(scopedNow).toISOString();
  const cases=[
   {id:'scope-near',status:'upcoming',startTimeUtc:nearStart},
   {id:'scope-far',status:'scheduled',startTimeUtc:farStart},
   {id:'scope-far-offset',status:'upcoming',startTimeUtc:new Date(scopedNow+4*3600000).toISOString().replace('Z','+00:00')},
   {id:'scope-rescheduled',status:'scheduled',startTimeUtc:farStart},
   {id:'scope-null-time',status:'upcoming',startTimeUtc:null},
   {id:'scope-malformed-time',status:'scheduled',startTimeUtc:'2026-02-30T12:00:00Z'},
   {id:'scope-no-zone',status:'scheduled',startTimeUtc:'2099-01-01T12:00:00'},
   {id:'scope-paused',status:'stumps',startTimeUtc:farStart},
   {id:'scope-final',status:'completed',startTimeUtc:farStart,completedAt:checkAt,homeScore:0,awayScore:0},
   {id:'scope-unknown-state',status:'unreviewed',startTimeUtc:farStart},
   {id:'scope-boundary',status:'scheduled',startTimeUtc:new Date(scopedNow+30.5*60000).toISOString()},
   {id:'scope-overlay-soon',status:'scheduled',startTimeUtc:farStart},
   {id:'scope-overlay-far',status:'scheduled',startTimeUtc:nearStart},
  ].map(e=>({key:'nrl',date:day,homeParticipantId:'team:'+e.id,awayParticipantId:'team:other',scoreCheckedAt:checkAt,statusCheckedAt:checkAt,...e}));
  await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,fixture,identity_keys,content_hash) select 'z-current',e->>'id',e,array[e->>'id',case when e->>'id'='scope-rescheduled' then 'alias:rescheduled' else e->>'id' end],md5(e::text) from jsonb_array_elements($1::jsonb) e",[JSON.stringify(cases)]);
  for(const [id,start] of [['scope-overlay-soon',nearStart],['scope-overlay-far',farStart]])await db.query("insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash) values('z-current',$1,jsonb_build_object('id',$1::text,'status','scheduled','startTimeUtc',$2::text),'clock-overlay')",[id,start]);
  await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,fixture,identity_keys,content_hash) select 'a-calendar','distant:'||i,jsonb_build_object('id','distant:'||i,'date',$1::text,'status','scheduled','startTimeUtc',$2::text),array['distant:'||i],'test' from generate_series(1,1200) i",[day,farStart]);
  calls=[];const nearSnapshot=await store.read({scope:'match-centre',preserveIds:['alias:rescheduled']}),nearEvents=nearSnapshot.flatMap(s=>s.fixtures),nearIds=new Set(nearEvents.map(e=>e.id));
  assert.equal(calls.length,2);assert(calls.some(route=>route.endsWith('nothingsports_read_match_centre_fixture_bundle')));
  for(const id of ['scope-near','scope-rescheduled','scope-null-time','scope-malformed-time','scope-no-zone','scope-paused','scope-final','scope-unknown-state','scope-boundary','scope-overlay-soon','late-current'])assert(nearIds.has(id),'Near read retains '+id);
  assert(!nearIds.has('scope-far'));assert(!nearIds.has('scope-far-offset'));assert(!nearIds.has('scope-overlay-far'));assert(!nearEvents.some(e=>e.id.startsWith('distant:')));
  assert.equal(nearEvents.find(e=>e.id==='scope-final').homeScore,0);assert.equal(nearEvents.find(e=>e.id==='scope-final').awayScore,0);
  assert.equal(nearEvents.find(e=>e.id==='scope-near').startTimeUtc,nearStart);assert.equal(Date.parse(nearEvents.find(e=>e.id==='scope-near').scoreCheckedAt),Date.parse(checkAt),'Reading does not renew original facts');
  const fullFuture=await store.read();assert(fullFuture.flatMap(s=>s.fixtures).some(e=>e.id==='distant:1199'),'Other readers retain the full future horizon');
  const publishedSoon={...cases.find(e=>e.id==='scope-rescheduled'),startTimeUtc:nearStart,fixtureIdAliases:['alias:rescheduled']};let scopeOptions;
  const corrected=createMatchCentreHandler({clock:()=>scopedNow,enabled:()=>true,published:()=>[publishedSoon],request,snapshotRead:async options=>{scopeOptions=options;return {sources:await store.read(options),readAt:scopedNow,stale:false};}}),correctedResponse=response();
  await corrected({url:'/api/match-centre?membership=everything'},correctedResponse);assert.equal(scopeOptions.scope,'match-centre');assert(scopeOptions.preserveIds.includes('scope-rescheduled'));assert(scopeOptions.preserveIds.includes('alias:rescheduled'),'Retained fixture aliases also protect corrective updates');assert(!correctedResponse.body.fixtures.some(e=>e.id==='scope-rescheduled'),'A source reschedule still removes the known upcoming card before pagination');assert(correctedResponse.body.fixtures.some(e=>e.id==='late-current'),'A genuinely new live source member survives the narrow read');
  const model=require('../config/match-centre');assert.deepEqual(model.select(nearEvents,scopedNow).map(model.id),model.select(fullFuture.flatMap(s=>s.fixtures),scopedNow).map(model.id),'Real SQL paths preserve the same current sporting membership');
  await nearEquivalent(null);await nearEquivalent(['alias:rescheduled']);
  await equivalent(null);await equivalent(['alias:rescheduled','scope-overlay-soon','scope-overlay-far']);
  const tooMany=(await db.query('select public.nothingsports_read_match_centre_fixture_bundle($1) as value',[Array.from({length:5001},(_,i)=>'fixture:'+i)])).rows[0].value;assert.equal(tooMany.complete,false,'Invalid identity budget cannot claim a complete empty result');
  const healthy=await readLiveSnapshots({store,now:Date.now(),maxAgeMs:0});const badStore=createSnapshotStore({request:async(route)=>route.endsWith('bundle')?{schemaVersion:'current-fixture-bundle.v1',complete:false,rows:[]}:[]});const retained=await readLiveSnapshots({store:badStore,now:Date.now()+1,maxAgeMs:0});assert(retained.stale);assert.equal(retained.revision,healthy.revision,'Incomplete bundles keep the last-good shared snapshot');
  await db.exec('reset role');for(const role of ['anon','authenticated'])for(const name of ['nothingsports_read_current_fixture_bundle','nothingsports_read_match_centre_fixture_bundle'])assert.equal((await db.query("select has_function_privilege($1,$2,'execute') as allowed",[role,'public.'+name+'(text[])'])).rows[0].allowed,false);assert.equal((await db.query("select count(*) as n from public.nothingsports_fixture_current")).rows[0].n,2420,'Read filtering preserves stored history');
  await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,fixture,identity_keys,content_hash) select 'a-calendar','overflow:'||i,jsonb_build_object('id','overflow:'||i,'date',$1::text,'status','scheduled'),array['overflow:'||i],'test' from generate_series(1,4200) i",[day]);const overflow=(await db.query('select public.nothingsports_read_current_fixture_bundle(null) as value')).rows[0].value;assert.equal(overflow.complete,false);assert.equal(overflow.rows.length,5001,'Oversized input is explicitly incomplete, never a silently truncated success');
  const nearOverflow=(await db.query('select public.nothingsports_read_match_centre_fixture_bundle(null) as value')).rows[0].value;assert.equal(nearOverflow.complete,false);assert.equal(nearOverflow.rows.length,5001,'Uncertain near rows retain the explicit incomplete sentinel');
  await nearEquivalent(null);
  await equivalent(null);
  console.log('Global/near transfer beyond 1000 rows, preserved current membership and reschedules, uncertain clocks, parent/detail isolation, observations/aliases/rubbers, score-overlay retention, two-read budget, degraded fallback, service-only access and complete SQL equivalence passed.');
 }finally{await db.close();}
 require('node:child_process').execFileSync(process.execPath,['scripts/validate-match-centre-snapshot-scope.js'],{stdio:'inherit'});
})().catch(e=>{console.error(e.message);process.exitCode=1;});
