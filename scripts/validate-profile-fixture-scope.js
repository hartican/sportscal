#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {createSnapshotStore,readLiveSnapshots}=require('../lib/live-fixtures');
const {requirements}=require('../lib/profile-fixture-requirements');
const registry=require('../config/sport-domain-registry');
const migration=fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_scope_participant_fixture_reads.sql'));
async function database({withReadContext=true}={}){
 const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite'),db=new PGlite();
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to service_role;');
 for(const name of ['20260908093906_live_fixture_snapshots.sql','20260908110529_discovery_source_health.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20260914061506_right_size_fixture_runtime.sql','utf8').split('-- One write replaces')[0]);
 for(const name of ['20260924104317_compact_live_scores.sql','20261002171936_preserve_compact_fixture_observations.sql','20261006182007_bound_current_fixture_snapshot.sql','20261009041722_compact_public_fixture_bundle.sql','20261009074435_bound_match_centre_snapshot.sql','20261009082136_short_circuit_match_centre_snapshot.sql','20261010140637_materialize_match_centre_read_receipts.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8'));
 // The final qualification replaces the prior Match Centre body, with its real guard.
 await db.exec(fs.readFileSync('supabase/migrations/20261012133505_qualify_match_centre_read_candidates.sql','utf8'));
 await db.exec('create table public.nothingsports_reminder_intents(fixture_id text,enabled boolean,choice text);create table public.nothingsports_reminders(event_id text,dispatched_at timestamptz);');
 await db.exec(fs.readFileSync('supabase/migrations/20261010114326_bound_reminder_fixture_read_scope.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/'+migration,'utf8'));
 if(withReadContext){
  const prepared=fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_prepare_participant_fixture_context.sql'));
  if(prepared)await db.exec('BEGIN;\n'+fs.readFileSync('supabase/migrations/'+prepared,'utf8')+'\nCOMMIT;');
  const indexed=fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_index_participant_fixture_context.sql'));
  if(indexed)await db.exec('BEGIN;\n'+fs.readFileSync('supabase/migrations/'+indexed,'utf8')+'\nCOMMIT;');
  const projection=fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_flatten_fixture_observation_projection.sql'));
  if(projection)await db.exec('BEGIN;'+fs.readFileSync('supabase/migrations/'+projection,'utf8')+'COMMIT;');
  const clocks=fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_reuse_participant_observation_clocks.sql'));
  if(clocks)await db.exec('BEGIN;'+fs.readFileSync('supabase/migrations/'+clocks,'utf8')+'COMMIT;');
  for(const suffix of ['_restore_participant_reader_before_clock_rework.sql','_map_participant_observation_clocks.sql','_retain_indexed_participant_reader_before_parts.sql','_partition_current_fixture_bundle.sql','_reuse_fixture_part_work.sql','_serialize_fixture_part_response.sql','_stabilize_fixture_part_plan.sql','_index_required_fixture_selection.sql','_defer_fixture_payload_projection.sql','_combine_fixture_index_integrity_checks.sql','_enforce_fixture_index_integrity_at_commit.sql','_index_fixture_calendar_selection.sql','_group_fixture_source_sport_keys.sql','_index_match_centre_linked_lookup.sql','_lookup_linked_match_context_by_key.sql','_balance_complete_fixture_transport.sql','_restore_complete_transport_after_rehearsal.sql','_use_parameter_aware_match_centre_plan.sql','_restore_match_centre_plan_after_rehearsal.sql','_replan_bound_match_centre_lookup.sql','_restore_bound_match_centre_after_rehearsal.sql']){
   const next=fs.readdirSync('supabase/migrations').find(n=>n.endsWith(suffix));
   if(next)await db.exec('BEGIN;'+fs.readFileSync('supabase/migrations/'+next,'utf8')+'COMMIT;');
  }
 }
 return db;
}
const emptyPrefs={version:26,onboardingComplete:true,showSpoilers:false,followedSports:[],selectedSelectorEntityIds:[],preferenceGraph:{entityFollows:[]}};
const state=ids=>({preferences:{...emptyPrefs,preferenceGraph:{entityFollows:ids.map(participantId=>({participantId,followLevel:'follow'}))}},event_user_state:{}});
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},send(body){this.body=JSON.parse(body);return this;},json(body){this.body=body;return this;}});
async function run(){
 const db=await database();let checks=0;
 const check=(description,fn)=>{fn();checks++;};
 try{
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const start=new Date(Date.now()+86400000).toISOString(),observed=new Date(Date.now()-60000).toISOString(),factAt=new Date(Date.now()-120000).toISOString();
 const fixture=(id,key,extra={})=>({id,key,date:today,status:'upcoming',startTimeUtc:start,homeParticipantId:'team:football:epl:1',awayParticipantId:'team:football:epl:2',participantIds:['team:football:epl:1','team:football:epl:2'],sourceCheckedAt:observed,sourceUrl:'https://example.test/fixtures',...extra});
 const seed={
  primary:[fixture('known','premier-league'),fixture('new-source-only','premier-league'),fixture('moved','premier-league',{date:'2099-01-01',startTimeUtc:'2099-01-01T12:00:00Z'}),fixture('cleared','premier-league'),fixture('cancelled','premier-league',{status:'cancelled'}),fixture('old','premier-league',{date:'2020-01-01',startTimeUtc:'2020-01-01T12:00:00Z',homeParticipantId:'team:football:epl:3',awayParticipantId:'team:football:epl:4',participantIds:['team:football:epl:3','team:football:epl:4'],status:'completed'}),fixture('live-old','premier-league',{date:'2020-01-01',status:'live'}),fixture('too-far','premier-league',{date:'2099-01-01',startTimeUtc:'2099-01-01T12:00:00Z',homeParticipantId:'team:football:epl:3',awayParticipantId:'team:football:epl:4',participantIds:['team:football:epl:3','team:football:epl:4']}),fixture('unknown-day','premier-league',{date:null}),fixture('alias-seed','premier-league',{sourceEventIds:['alias:bridge']})],
  fantasy:[fixture('known',undefined,{fantasyOnly:true})],
  identityDetail:[fixture('detail','nrl',{homeParticipantId:null,awayParticipantId:null,participantIds:[],sourceEventIds:['alias:bridge','alias:next'],venue:'Retained venue'})],
  identityFinal:[fixture('third','afl',{homeParticipantId:null,awayParticipantId:null,participantIds:[],sourceEventIds:['alias:next'],venue:'Retained transitive detail',date:'2099-01-01'})],
  semantic:[fixture('semantic-detail','nrl',{startTimeUtc:new Date(start).toUTCString(),venue:'RFC clock detail'})],
  unknown:[fixture('unregistered','new-football-key',{participantIds:[],homeParticipantId:null,awayParticipantId:null})],
  tennis:[fixture('tennis-only','tennis',{homeParticipantId:'competitor:tennis:atp:alex-de-minaur',awayParticipantId:'competitor:tennis:atp:karen-khachanov',participantIds:['competitor:tennis:atp:alex-de-minaur','competitor:tennis:atp:karen-khachanov']})],
  unrelated:[fixture('unrelated','cricket',{homeParticipantId:'team:cricket:1',awayParticipantId:'team:cricket:2',participantIds:['team:cricket:1','team:cricket:2']})]
 };
 for(const [source,fixtures] of Object.entries(seed)){
  await db.query('insert into public.nothingsports_fixture_sources(source_id) values($1)',[source]);
  for(const e of fixtures)await db.query('insert into public.nothingsports_fixture_current(source_id,fixture_id,fixture,identity_keys,content_hash) values($1,$2,$3::jsonb,$4,$5)',[source,e.id,JSON.stringify(e),[e.id,...(e.sourceEventIds||[])],e.id]);
 }
 await db.query("insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash,first_completed_at) values('fantasy','known',$1::jsonb,'zero-final',$2)",[JSON.stringify({id:'known',status:'completed',homeScore:0,awayScore:0,scoreCheckedAt:factAt,statusCheckedAt:factAt}),factAt]);
 await db.query("insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash) values('primary','cleared',$1::jsonb,'cleared')",[JSON.stringify({id:'cleared',date:null,startTimeUtc:null,homeParticipantId:null,status:'postponed'})]);
 await db.query("update public.nothingsports_fixture_sources set discovery_report=$1::jsonb where source_id='fantasy'",[JSON.stringify({_fixtureObservations:{known:{s:observed,t:observed}}})]);
 const plan=requirements({userState:state([]),participantId:'team:football:epl:1',events:[{id:'moved',participantIds:['team:football:epl:1']},{id:'alias-seed',participantIds:['team:football:epl:1']}]});
 check('whole Football family',()=>{assert(plan.sportKeys.includes('premier-league'));assert(plan.sportKeys.includes('football'));assert(plan.sportKeys.includes('fifa'));});
 const calls=[];let expectedReadBudget=3000;
 const store=createSnapshotStore({timer:()=>0,request:async(route,{body,timeoutMs})=>{
  assert.equal(timeoutMs,expectedReadBudget);calls.push({route,body});const name=route.split('/').at(-1);
  if(name==='nothingsports_read_fixture_source_health')return (await db.query('select * from public.nothingsports_read_fixture_source_health()')).rows;
  if(name==='nothingsports_read_participant_fixture_bundle')return (await db.query('select public.nothingsports_read_participant_fixture_bundle($1,$2,$3,$4) as value',[body.p_sport_keys,body.p_known_sport_keys,body.p_participant_ids,body.p_required_ids])).rows[0].value;
  if(['nothingsports_read_current_fixture_bundle','nothingsports_read_current_fixture_bundle_json'].includes(name))return (await db.query('select public.nothingsports_read_current_fixture_bundle(null) as value')).rows[0].value;
  if(name==='nothingsports_current_global_fixture_bundle?select=bundle')return [{bundle:(await db.query('select public.nothingsports_read_current_fixture_bundle(null) as value')).rows[0].value}];
  throw Error('Unexpected request '+name);
 }});
 const scoped=await store.read(plan),all=scoped.flatMap(s=>s.fixtures),ids=all.map(e=>e.id);
 check('two reads; new arrivals; whole groups',()=>{assert.equal(calls.length,2);for(const id of ['known','new-source-only','cancelled','unknown-day','live-old'])assert(ids.includes(id),id);});
 check('unknown and transitive/semantic context',()=>{for(const id of ['unregistered','detail','third','semantic-detail'])assert(ids.includes(id),id);assert(!ids.includes('unrelated'));assert(!ids.includes('tennis-only'));});
 check('retention and protected correction',()=>{assert(ids.includes('moved'));assert(!ids.includes('old'));assert(!ids.includes('too-far'));});
 check('raw null clears previous fact',()=>{const e=all.find(e=>e.id==='cleared');assert.equal(e.startTimeUtc,null);assert.equal(e.date,null);assert.equal(e.homeParticipantId,null);});
 check('zero scores and original facts',()=>{const e=scoped.find(s=>s.source_id==='fantasy').fixtures[0];assert.equal(e.homeScore,0);assert.equal(e.awayScore,0);assert.equal(Date.parse(e.scoreCheckedAt),Date.parse(observed));assert.equal(Date.parse(e.scoreFactObservedAt),Date.parse(factAt));assert.equal(Date.parse(e.firstConfirmedCompleteAt),Date.parse(factAt));});
 expectedReadBudget=6000;const global=await store.read(),globalRows=global.flatMap(s=>s.fixtures);expectedReadBudget=3000;
 check('full projected field equality',()=>{for(const e of scoped){const base=global.find(g=>g.source_id===e.source_id);for(const f of e.fixtures)if(!['moved','third'].includes(f.id))assert.deepEqual(f,base.fixtures.find(g=>g.id===f.id));}});
 // The media owner reads the whole Tennis family, rather than projecting the
 // world or limiting new arrivals to today's published roster/fixture IDs.
 const tennisPublished={...seed.tennis[0],id:'published-tennis-alias',sourceEventIds:['alias:tennis:required']};
 const tennisPlan=require('../lib/fixture-highlights').tennisScope([tennisPublished]);
 const tennisNew=fixture('tennis-new-roster','tennis',{homeParticipantId:'competitor:tennis:atp:carlos-alcaraz',awayParticipantId:'competitor:tennis:atp:jannik-sinner',participantIds:['competitor:tennis:atp:carlos-alcaraz','competitor:tennis:atp:jannik-sinner']});
 const tennisMoved={...tennisNew,id:'tennis-required-moved',key:'cricket',date:'2099-01-01',sourceEventIds:['alias:tennis:required']};
 for(const e of [tennisNew,tennisMoved])await db.query('insert into public.nothingsports_fixture_current(source_id,fixture_id,fixture,identity_keys,content_hash) values($1,$2,$3::jsonb,$4,$5)',['tennis',e.id,JSON.stringify(e),[e.id,...(e.sourceEventIds||[])],e.id]);
 const beforeTennisCalls=calls.length,tennisScoped=await store.read(tennisPlan),tennisIds=tennisScoped.flatMap(s=>s.fixtures).map(f=>f.id);
 check('media whole Tennis family, unknown rows and required alias',()=>{assert(tennisPlan.sportKeys.includes('tennis-women'));assert(tennisPlan.sportKeys.includes('wimbledon'));assert.deepEqual(tennisPlan.knownSportKeys,Object.keys(registry.byKey).sort());for(const id of ['tennis-only','tennis-new-roster','tennis-required-moved','unregistered'])assert(tennisIds.includes(id),id);assert(!tennisIds.includes('unrelated'));assert.equal(calls.length-beforeTennisCalls,2);assert(calls.slice(beforeTennisCalls).some(c=>c.route.endsWith('nothingsports_read_participant_fixture_bundle')));assert(!calls.slice(beforeTennisCalls).some(c=>c.route.includes('nothingsports_read_current_fixture_bundle')));});
 await db.query("delete from public.nothingsports_fixture_current where fixture_id in('tennis-new-roster','tennis-required-moved')");
 check('unknown and empty requirements use full read',()=>{assert.equal(requirements({userState:state([])}),null);assert.equal(requirements({userState:state(['competitor:unknown:somebody'])}),null);});
 const mixed=requirements({userState:state(['competitor:tennis:atp:alex-de-minaur']),participantId:'team:football:epl:1'});
 check('mixed Favourites include Tennis',()=>{assert(mixed.sportKeys.includes('tennis'));assert(mixed.sportKeys.includes('premier-league'));});
 check('player includes current team',()=>{const index=require('../data/canonical/football-follow-index.v1.json'),player=index.players.find(p=>p.currentTeamId);assert(player);const p=requirements({userState:state([]),participantId:player.id});assert(p.participantIds.includes(player.currentTeamId));});
 const rpc=async body=>(await db.query('select public.nothingsports_read_participant_fixture_bundle($1,$2,$3,$4) as value',[body.p_sport_keys,body.p_known_sport_keys,body.p_participant_ids,body.p_required_ids])).rows[0].value;
 const body=calls[1].body,bundle=await rpc(body);
 for(const change of [{scope:'global'},{complete:false},{sportKeys:['tennis']},{participantIds:['different']},{requiredIds:[]},{knownSportKeys:['only-one']},{rows:Array(5001).fill(bundle.rows[0])}]){
  await assert.rejects(createSnapshotStore({request:async route=>route.endsWith('nothingsports_read_fixture_source_health')?[]:{...bundle,...change}}).read(plan));checks++;
 }
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(rpc(body),/permission denied/);await db.exec('reset role');checks++;}
 await db.exec('set role service_role');assert.equal((await rpc(body)).complete,true);await db.exec('reset role');checks++;
 assert.equal((await rpc({...body,p_required_ids:Array(5001).fill('same')})).complete,false);checks++;
 assert.equal((await rpc({...body,p_sport_keys:[]})).complete,false);checks++;
 await db.query("insert into public.nothingsports_fixture_sources(source_id) values('capacity')");
 await db.query("insert into public.nothingsports_fixture_current(source_id,fixture_id,fixture,identity_keys,content_hash) select 'capacity','cap:'||n,jsonb_build_object('id','cap:'||n,'key','premier-league','date',$1::text),array['cap:'||n],'cap' from generate_series(1,5001) n",[today]);
 const full=await rpc(body);assert.equal(full.complete,false);assert.equal(full.rows.length,5001);checks++;
 await db.query("delete from public.nothingsports_fixture_current where source_id='capacity'");
 // Cache binding and failure preserve only their own last-good scope.
 let reads=0,fail=false;const cachedStore={read:async opts=>{reads++;if(fail)throw Error('Controlled unavailable');return [{source_id:opts.sportKeys.join(','),revision:reads,fixtures:[]}];}};
 const now=Date.now(),p1={...plan,store:cachedStore,now},p2={...mixed,store:cachedStore,now};
 const first=await readLiveSnapshots(p1);assert.equal(first.stale,false);assert.equal((await readLiveSnapshots(p1)).revision,first.revision);assert.equal(reads,1);checks++;
 assert.notEqual((await readLiveSnapshots(p2)).revision,first.revision);assert.equal(reads,2);checks++;
 fail=true;const old=await readLiveSnapshots({...p1,now:now+31000});assert.equal(old.stale,true);assert.equal(old.readAt,first.readAt);assert.equal(old.revision,first.revision);checks++;
 fail=false;assert.equal((await readLiveSnapshots({...p1,now:now+62000})).stale,false);checks++;
 for(let n=0;n<9;n++)await readLiveSnapshots({...p1,participantIds:['team:football:bounded-'+n]});
 const before=reads;await readLiveSnapshots(p1);assert.equal(reads,before+1,'An unbounded public profile key cannot retain unlimited snapshots');checks++;
 let missingCalls=0;await assert.rejects(createSnapshotStore({request:async()=>{missingCalls++;throw Object.assign(Error('Missing function'),{status:404});}}).read(plan));assert.equal(missingCalls,2,'No third legacy/full read after a failed participant bundle');checks++;
 // Actual API and pipeline, with real catalogue dependencies and selected SQL.
 const Module=require('node:module'),path=require('node:path'),filename=path.resolve('api/feed.js'),unit=new Module(filename,module);unit.filename=filename;unit.paths=Module._nodeModulePaths(path.dirname(filename));unit._compile(fs.readFileSync(filename,'utf8')+'\nmodule.exports.auditDependencies=feedDependencies;',filename);
 const dependencies=unit.exports.auditDependencies(),fixedNow=new Date(),clock=()=>new Date(fixedNow);
 for(const [participantId,prefs] of [['team:football:epl:1',state([]).preferences],['competitor:tennis:atp:alex-de-minaur',state([]).preferences],[null,state(['team:football:epl:1','competitor:tennis:atp:alex-de-minaur']).preferences]]){
  const results=[];
  for(const mode of ['global','scoped']){
   const handler=unit.exports.createFeedHandler({clock,load:()=>({...dependencies,readLiveSnapshots:async scope=>{expectedReadBudget=mode==='global'?6000:5000;if(mode!=='global')assert.equal(scope.interactive,true);return {sources:await store.read(mode==='global'?{}:scope),revision:'same-comparison',readAt:Date.now(),stale:false};}})});
   const res=response();await handler({url:'/api/feed?scope=athletes&limit=50'+(participantId?'&participantId='+participantId:''),method:'POST',headers:{},body:{preferences:prefs,eventUserState:{}}},res);assert.equal(res.statusCode,200);results.push(res.body);
  }
  // Build at a stable instant: the response's generation time is presentation metadata.
  for(const result of results)delete result.generatedAt;
  assert.deepEqual(results[1],results[0]);checks++;
 }
 for(const stale of [false,true,null]){
  const handler=unit.exports.createFeedHandler({clock,load:()=>({...dependencies,readLiveSnapshots:async()=>{if(stale===null)throw Error('Controlled unavailable');return {sources:[],revision:'same',stale};}})}),res=response();
  await handler({url:'/api/feed?scope=athletes&participantId=team:football:epl:1&limit=50',method:'POST',headers:{},body:{preferences:emptyPrefs,eventUserState:{}}},res);
  assert.equal(res.statusCode,200);assert.equal(res.body.fixtureSnapshotStale,stale!==false);assert(res.body.events.length>0);checks++;
 }
 let resolves=0,currentReads=0;const warm=unit.exports.createFeedHandler({clock,load:()=>({...dependencies,resolveUserFollowFixtures:args=>{resolves++;return dependencies.resolveUserFollowFixtures(args);},readLiveSnapshots:async()=>{currentReads++;return {sources:[],revision:'warm',stale:false};}})});
 const warmRequest={url:'/api/feed?scope=athletes&participantId=team:football:epl:1&limit=50',method:'POST',headers:{},body:{preferences:emptyPrefs,eventUserState:{}}};
 await warm(warmRequest,response());const warmResponse=response();await warm(warmRequest,warmResponse);assert.equal(warmResponse.headers['X-Feed-Cache'],'HIT');assert.equal(resolves,1,'Warm profile responses do not rebuild the published calendar');assert.equal(currentReads,2,'A response-cache hit still checks the existing snapshot seam');checks++;
 await warm({...warmRequest,url:warmRequest.url.replace('epl:1','epl:2')},response());assert.equal(resolves,2,'A different profile cannot borrow the earlier requirements');checks++;
 console.log(JSON.stringify({passed:true,checks,migration,limits:'Actual local schema/store/handler with controlled observations; production and real phone remain separate.'}));
 }finally{await db.close();}
}
if(require.main===module)run().then(()=>require('./validate-indexed-match-centre-read').run()).then(()=>require('./validate-fixture-index-commit').run()).then(()=>require('./validate-fixture-observation-projection').run()).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={database,run};
