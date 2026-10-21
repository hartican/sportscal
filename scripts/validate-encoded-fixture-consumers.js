'use strict';
const assert=require('node:assert/strict');
const {createSnapshotStore,readLiveSnapshots,contentHash}=require('../lib/live-fixtures');
const {createMatchCentreHandler}=require('../lib/match-centre-handler');

async function validate({db,publish,compare,check}){
 const now=Date.now(),factAt=new Date(now-120000).toISOString(),checkedAt=new Date(now-60000).toISOString();
 const id='qa-consumer-match',fixture={id,key:'tennis',status:'live',date:new Date(now).toLocaleDateString('en-CA',{timeZone:'Australia/Sydney'}),startTimeUtc:new Date(now-600000).toISOString(),homeParticipantId:'player:qa:one',awayParticipantId:'player:qa:two',homeTeam:'QA One',awayTeam:'QA Two',participants:[{id:'player:qa:one',name:'QA One'},{id:'player:qa:two',name:'QA Two'}],fixtureIdAliases:['qa-consumer-alias'],fullSpiel:'Full selected context',sourceUrl:'https://example.test/fixture',statusCheckedAt:factAt};
 await db.exec("insert into public.nothingsports_fixture_sources(source_id) values('qa-consumers')");
 await publish('qa-consumers',[fixture],'qa-consumer-initial');
 await db.query("insert into public.nothingsports_live_scores(source_id,fixture_id,score,content_hash) values('qa-consumers',$1,$2::jsonb,'consumer-score')",[id,JSON.stringify({id,status:'live',sets:[{home:0,away:1}],scoreCheckedAt:factAt,statusCheckedAt:factAt})]);
 await db.query("update public.nothingsports_fixture_sources set discovery_report=$1::jsonb where source_id='qa-consumers'",[JSON.stringify({_fixtureObservations:{[id]:{s:checkedAt,t:checkedAt}}})]);
 await compare();
 const calls=[];
 const request=async(route,options={})=>{
  const {body={}}=options;calls.push({route,options});
  if(route==='/rest/v1/nothingsports_current_global_fixture_bundle?select=bundle')return (await db.query('select bundle from public.nothingsports_current_global_fixture_bundle')).rows;
  const name=route.split('/').at(-1);
  if(name==='nothingsports_read_fixture_source_health')return (await db.query('select * from public.nothingsports_read_fixture_source_health()')).rows;
  if(name==='nothingsports_read_participant_fixture_bundle')return (await db.query('select public.nothingsports_read_participant_fixture_bundle($1,$2,$3,$4) value',[body.p_sport_keys,body.p_known_sport_keys,body.p_participant_ids,body.p_required_ids])).rows[0].value;
  const arg=body.p_membership_ids??body.p_fixture_ids??body.p_event_ids??body.p_ids;
  assert(['nothingsports_read_current_fixtures','nothingsports_read_match_centre_fixture_bundle','nothingsports_read_match_scores'].includes(name),'Unexpected route '+route);
  const rows=(await db.query('select * from public.'+name+'($1)',[arg])).rows;
  return name.endsWith('_fixture_bundle')?rows[0][name]:rows;
 };
 const store=createSnapshotStore({request,timer:()=>0});
 const global=await store.read();
 assert.equal(calls.length,2);assert(calls.every(c=>c.options.timeoutMs===3000));
 assert(calls.some(c=>c.route.includes('current_global_fixture_bundle?select=bundle')));
 const referenceStore=createSnapshotStore({timer:()=>0,request:async(route,options)=>route.includes('current_global_fixture_bundle?select=bundle')?(await db.query('select bundle from public.qa_encoded_reference')).rows:request(route,options)});
 const reference=await referenceStore.read();assert.deepEqual(global,reference);assert.equal(contentHash(global),contentHash(reference));
 const match=global.flatMap(s=>s.fixtures).find(f=>f.id===id);assert(match);assert.equal(match.fullSpiel,undefined);
 assert.equal(Date.parse(match.scoreCheckedAt),Date.parse(checkedAt));assert.equal(Date.parse(match.scoreFactObservedAt),Date.parse(factAt));
 check('actual global store uses two unchanged reads and preserves normalized payload hashes and original clocks');
 calls.length=0;
 const selected=(await store.read({ids:[id]})).flatMap(s=>s.fixtures).find(f=>f.id===id);
 assert.equal(selected.fullSpiel,fixture.fullSpiel);assert.equal(calls.length,2);assert(calls.every(c=>c.options.timeoutMs===3000));
 check('selected store retains full context through original three-second path');
 for(const scope of ['match-centre','participants']){
  calls.length=0;
  const options={scope,interactive:true,preserveIds:[id]};
  if(scope==='participants')Object.assign(options,{sportKeys:['tennis'],knownSportKeys:['tennis'],participantIds:['player:qa:one']});
  const rows=(await store.read(options)).flatMap(s=>s.fixtures);
  assert(rows.some(f=>f.id===id));assert.equal(calls.length,2);assert(calls.every(c=>c.options.timeoutMs===5000));
  assert(!calls.some(c=>c.route.includes('current_global_fixture_bundle')));
 }
 check('near and participant consumers keep their existing scoped readers and five-second budgets');
 const response=()=>({setHeader(){},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}});
 const handler=createMatchCentreHandler({enabled:()=>true,clock:()=>now,published:()=>[fixture],request,snapshotRead:async options=>({sources:await store.read(options),readAt:now,stale:false})});
 const listing=response();await handler({url:'/api/match-centre?membership=everything'},listing);
 const listed=listing.body.fixtures.find(f=>f.id===id);assert(listed);assert.equal(listed.stale,false);assert.deepEqual(listed.score.sets,[{home:0,away:1}]);
 calls.length=0;const polled=response();await handler({url:'/api/match-centre?ids='+id},polled);
 assert.equal(calls.length,1);assert(calls[0].route.endsWith('nothingsports_read_match_scores'));assert.deepEqual(polled.body.fixtures.find(f=>f.id===id),listed);
 check('actual Match Centre listing and selected polling agree on live zero scores, identity and freshness');
 const healthy=await readLiveSnapshots({store,now,maxAgeMs:0});
 const failedStore=createSnapshotStore({timer:()=>0,request:async(route,options)=>{
  if(route.includes('current_global_fixture_bundle'))throw Object.assign(new Error('fixture snapshot deadline'),{payload:{code:'supabase_timeout'},status:504});
  return request(route,options);
 }});
 const degraded=await readLiveSnapshots({store:failedStore,now:now+1,maxAgeMs:0});
 assert.equal(degraded.stale,true);assert.equal(degraded.revision,healthy.revision);
 assert.equal(degraded.readFailure.code,'supabase_timeout');assert.equal(degraded.readFailure.status,504);
 assert.deepEqual(degraded.sources,healthy.sources);
 const failedHandler=createMatchCentreHandler({enabled:()=>true,clock:()=>now,published:()=>[fixture],request,snapshotRead:async()=>degraded});
 const failedResponse=response();await failedHandler({url:'/api/match-centre?membership=everything'},failedResponse);
 assert.equal(failedResponse.body.membershipStale,true);
 check('snapshot timeout retains last-good facts and honestly marks the response degraded');
}
module.exports={validate};
