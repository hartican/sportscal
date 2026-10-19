'use strict';
const assert=require('node:assert/strict');
const {createLiveFixtureHandler}=require('../lib/live-fixture-handler');
const {createSnapshotStore}=require('../lib/live-fixtures');
const identity=require('../config/fixture-identity');
const capture=require('./fixtures/cricket-score-address-20261020.json');
const response=()=>({headers:{},setHeader(key,value){this.headers[key]=value;},status(code){this.code=code;return this;},json(body){this.body=body;return this;},end(){return this;}});
async function run(){
 const before=JSON.stringify(capture),official=capture.rows.find(row=>row.source_id==='cricket-ca-current').fixture;
 // The retained raw event predates the publisher's ordered-side projection.
 // Use its explicit home/away participant roles, as the real published library
 // does; do not infer a binding from display names or the provider's score.
 const published={...capture.published,homeParticipantId:capture.published.participants.find(p=>p.role==='home').id,awayParticipantId:capture.published.participants.find(p=>p.role==='away').id};
 const fetchBefore=globalThis.fetch;globalThis.fetch=()=>{throw Error('No outbound calls in the captured Feed regression');};
 try{
  for(const ids of [[capture.canonicalId],['evt_88'],['fixture-cricket-espn-1525660'],[capture.providerId],[capture.canonicalId,capture.providerId],[capture.canonicalId,'evt_88',...Array.from({length:58},(_,i)=>'fixture:cricket:boundary:'+i)]]){
   const calls=[],reads=[];
   const store=createSnapshotStore({request:async(path,options)=>{
    calls.push({path,options});
    if(path.endsWith('/nothingsports_read_fixture_source_health'))return capture.rows.map((row,i)=>({source_id:row.source_id,revision:i+1,checked_at:row.checked_at,next_due_at:row.checked_at}));
    assert(path.endsWith('/nothingsports_read_current_fixtures'),'Ordinary selected Feed keeps its existing RPC');
    return capture.rows.filter(row=>row.identity_keys.some(id=>options.body.p_fixture_ids.includes(id))).map(row=>({...row,fixture_id:row.fixture.id}));
   }});
   const handler=createLiveFixtureHandler({environment:{},clock:()=>new Date(capture.clock),publishedFixtures:()=>[published],highlightFixtures:()=>[],read:async options=>{
    reads.push(options);const sources=await store.read({...options,now:Date.parse(capture.clock)});return {sources,stale:false,revision:'captured-selected-test',readAt:Date.parse(capture.clock)};
   }});
   const res=response();await handler({method:'GET',url:'/api/fixtures?ids='+encodeURIComponent(ids.join(',')),headers:{}},res);
   assert.equal(res.code,200);assert.equal(res.body.schemaVersion,'live-fixtures.v1');assert.equal(res.body.stale,false);
   const rows=res.body.sources.flatMap(source=>source.fixtures);assert.equal(rows.length,1);const event=rows[0];
   assert.equal(event.id,ids.length===1&&ids[0]===capture.providerId?capture.providerId:capture.canonicalId);
   assert.equal(event.status,'stumps','The ordinary Feed reader retrieves the official phase: '+JSON.stringify({requested:ids,reads,returnedId:event.id,sourceIds:res.body.sources.map(source=>source.source_id)}));
   assert.equal(event.matchDay,2);assert.equal(event.innings[0].participantId,'team:cricket:south-africa');
   assert.equal(event.innings[0].runsScored??event.innings[0].runs,97);assert.equal(event.innings[0].numberOfWicketsFallen??event.innings[0].wickets,5);assert.equal(event.innings[0].oversBowled??event.innings[0].overs,'43.0');
   assert.equal(event.scoreCheckedAt,official.scoreCheckedAt);assert.equal(event.statusCheckedAt,official.statusCheckedAt);assert.equal(event.statusFactObservedAt,official.statusFactObservedAt);assert.equal(event.scoreFactObservedAt,official.scoreFactObservedAt);
   assert.equal(reads.length,1);assert.equal(calls.length,2,'Keep the one existing health RPC and one selected fixture RPC, including sixty IDs');
   assert(calls.every(call=>call.options.timeoutMs===3000));const addressed=calls.find(call=>call.path.endsWith('/nothingsports_read_current_fixtures')).options.body.p_fixture_ids;
   assert(addressed.includes(capture.providerId));assert(addressed.length<=60);if(ids.length===60){assert.equal(addressed.length,60);assert(addressed.includes('evt_88'));}
  }
  for(const id of ['fixture:cricket:CA:39990','fixture:cricket:unknown','constructor','toString','__proto__']){
   let selected;const handler=createLiveFixtureHandler({environment:{},clock:()=>new Date(capture.clock),publishedFixtures:()=>[published],highlightFixtures:()=>[],read:async options=>{selected=options.ids;return {sources:[],stale:false,revision:'unknown-selected-test',readAt:Date.parse(capture.clock)};}});
   const res=response();await handler({method:'GET',url:'/api/fixtures?ids='+id,headers:{}},res);assert.equal(res.code,200);assert.deepEqual(selected,[id]);assert.deepEqual(res.body.sources.flatMap(source=>source.fixtures),[],'Other matches and prototype names do not gain this score');
  }
  for(const changes of [{awayParticipantId:'team:cricket:new-zealand'},{startTimeUtc:'2026-10-19T08:00:00.000Z'}]){
   const handler=createLiveFixtureHandler({environment:{},clock:()=>new Date(capture.clock),publishedFixtures:()=>[published],highlightFixtures:()=>[],read:async()=>({sources:[{source_id:'cricket-ca-current',checked_at:official.sourceCheckedAt,fixtures:[{...official,...changes}]}],stale:false,revision:'wrong-contest-test',readAt:Date.parse(capture.clock)})}),res=response();
   await handler({method:'GET',url:'/api/fixtures?ids='+capture.canonicalId,headers:{}},res);assert.equal(res.code,200);assert.equal(res.body.sources[0].fixtures.length,1);assert(!res.body.sources[0].fixtures[0].innings?.length,'The reviewed address cannot bypass exact contest identity');
  }
  const handler=createLiveFixtureHandler({environment:{},clock:()=>new Date(capture.clock),publishedFixtures:()=>[published],highlightFixtures:()=>[],read:async()=>{throw Error('Constructed existing read failure');}}),res=response();
  await handler({method:'GET',url:'/api/fixtures?ids='+capture.canonicalId,headers:{}},res);assert.equal(res.code,200);assert.equal(res.body.stale,true);assert.equal(res.body.sources[0].fixtures[0].id,capture.canonicalId);assert(!res.body.sources[0].fixtures[0].innings?.length,'Failed reads retain published unknowns, never manufacture a score');
  assert.equal(identity.canonicalFixtureId(capture.providerId),capture.providerId);assert(!identity.fixtureAliases(capture.canonicalId).includes(capture.providerId),'No global/private identity cutover');assert.equal(JSON.stringify(capture),before);
  console.log('Feed score address: actual stored-key filtering through real selected store/API, canonical/legacy/direct/paired/60-ID requests, preserved phase/day/score/clocks, unknown IDs and stale failure passed.');
 }finally{globalThis.fetch=fetchBefore;}
}
if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
module.exports=run;
