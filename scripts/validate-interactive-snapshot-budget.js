'use strict';
const assert=require('node:assert/strict');
const {createSnapshotStore,readLiveSnapshots}=require('../lib/live-fixtures');
const fixture=require('./fixtures/live-fixture-epl-review.json');
const health=[{source_id:'live-premier-league',revision:42,checked_at:fixture.sourceCheckedAt}];
const row={source_id:'live-premier-league',fixture};
const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;},send(body){this.body=JSON.parse(body);}});
function bundle(scope,body){return {schemaVersion:'current-fixture-bundle.v1',scope,complete:true,rows:[row],...(scope==='participants'?{sportKeys:body.p_sport_keys,knownSportKeys:body.p_known_sport_keys,participantIds:body.p_participant_ids,requiredIds:body.p_required_ids}:{})};}
async function run(){
 const warnings=[],warn=console.warn;console.warn=(...args)=>warnings.push(args);let checks=0;
 try{
  for(const [scope,ids,interactive,expected]of [
   ['match-centre',[],false,3000],['match-centre',[],true,5000],
   ['participants',[],true,5000],['global',[],true,3000],['match-centre',[fixture.id],true,3000]
  ]){
   const calls=[],store=createSnapshotStore({timer:()=>0,request:async(path,options)=>{
    calls.push(options);assert.equal(options.timeoutMs,expected);
    if(path.endsWith('nothingsports_read_fixture_source_health'))return health;
    return ids.length?[row]:bundle(scope==='participants'?'participants':scope==='match-centre'?'match-centre':undefined,options.body);
   }});
   const facts=await store.read({scope,ids,interactive,sportKeys:['premier-league'],knownSportKeys:['premier-league'],participantIds:['team:football:sydney-fc']});
   assert.equal(calls.length,2);assert.deepEqual(facts[0].fixtures,[fixture]);
   if(expected===5000){assert.equal(calls[0].signal,calls[1].signal);assert(calls[0].signal.aborted,'completion cancels any remaining peer');}
   else assert.equal(calls[0].signal,undefined,'background and compact reads retain their original path');
   checks++;
  }
  let clock=0;const budgets=[];
  const shared=createSnapshotStore({timer:()=>clock,request:async(path,options)=>{
   budgets.push(options.timeoutMs);
   if(path.endsWith('nothingsports_read_fixture_source_health')){clock=1700;return health;}
   clock=4999;return bundle('match-centre',options.body);
  }});
  assert.equal((await shared.read({scope:'match-centre',interactive:true}))[0].fixtures[0].id,fixture.id);
  assert.deepEqual(budgets,[5000,3300],'the second resource receives only the remaining shared allowance');checks++;
  clock=0;const legacyBudgets=[];
  const legacy=createSnapshotStore({timer:()=>clock,request:async(path,options)=>{
   legacyBudgets.push(options.timeoutMs);
   if(path.includes('/rpc/')){clock=3500;throw Object.assign(Error('missing'),{status:404});}
   clock=4999;return health.map(x=>({...x,fixtures:[fixture]}));
  }});
  await legacy.read({scope:'match-centre',interactive:true});assert.deepEqual(legacyBudgets,[5000,1500,1500]);checks++;
  warnings.length=0;clock=0;let calls=0;
  const expired=createSnapshotStore({timer:()=>clock,request:async(path,options)=>{
   calls++;if(path.endsWith('nothingsports_read_fixture_source_health'))return health;
   clock=5001;return bundle('match-centre',options.body);
  }});
  await assert.rejects(expired.read({scope:'match-centre',interactive:true}),e=>e.status===504&&e.payload.code==='supabase_timeout');
  assert.equal(calls,2);assert.equal(warnings.length,1);assert.equal(JSON.parse(warnings[0][1]).deadlineMs,5000);checks++;
  // Policy partitions in-flight work: a background reader cannot inherit5s.
  const releases=[],options=[],store={read:async opts=>{options.push(opts);return new Promise(resolve=>releases.push(resolve));}};
  const base={store,scope:'match-centre',preserveIds:['unit:interactive-budget'],maxAgeMs:0,now:100};
  const ui=readLiveSnapshots({...base,interactive:true}),sameUi=readLiveSnapshots({...base,interactive:true}),background=readLiveSnapshots(base);
  assert.equal(options.length,2);assert.equal(options[0].interactive,true);assert.equal(options[1].interactive,false);
  releases.forEach(resolve=>resolve(health.map(x=>({...x,fixtures:[fixture]}))));const [fresh]=await Promise.all([ui,sameUi,background]);
  const stale=await readLiveSnapshots({...base,interactive:true,now:40000,store:{read:async()=>{throw Error('controlled failure');}}});
  assert.equal(stale.stale,true);assert.equal(stale.readAt,fresh.readAt);assert.deepEqual(stale.sources,fresh.sources);checks++;
  const mcOptions=[],mc=require('../lib/match-centre-handler').createMatchCentreHandler({enabled:()=>true,published:()=>[],snapshotRead:async o=>{mcOptions.push(o);return {sources:[],stale:false,readAt:Date.now()};},request:async()=>[]});
  await mc({method:'GET',url:'/api/match-centre?membership=everything'},response());assert.equal(mcOptions[0].interactive,true);checks++;
  const scopes=[],now=new Date('2026-10-17T00:00:00Z');
  const d={...require('../lib/server-feed-pipeline'),...require('../lib/follow-fixture-resolver'),
   eventFeed:{version:'unit',publishedAt:now.toISOString(),events:[]},canonicalSportContext:{participants:[]},contextualEvents:[],
   normalizeUserFollowState:s=>s,resolveUserFollowFixtures:()=>({events:[],participants:[]}),overlaySnapshots:e=>e,
   readLiveSnapshots:async o=>{scopes.push(o);return {sources:[],revision:'unit',stale:false};},
   buildServerFeed:()=>({events:[],generatedAt:now.toISOString(),pagination:{nextCursor:null}})
  };
  const handler=require('../api/feed').createFeedHandler({clock:()=>now,load:()=>d,authenticate:()=>({bearerToken:()=>'',authenticatedUser:async()=>({id:'unit'}),loadUserState:async()=>({preferences:{interactive:true},event_user_state:{}})})});
  for(const url of ['/api/feed?scope=athletes&participantId=team:football:sydney-fc','/api/feed?scope=match-centre','/api/feed']){
   const res=response();await handler({url,method:url==='/api/feed'?'GET':'POST',body:{preferences:{onboardingComplete:true,interactive:true}}},res);assert.equal(res.code,200);
  }
  assert.equal(scopes[0].interactive,true);assert.equal(scopes[1].interactive,true);assert.equal(scopes[2],undefined,'ordinary Feed/account data cannot opt into a larger budget');checks++;
  // Exercise the actual transport: headers arrive, but a local body stalls.
  const http=require('node:http'),transport=require('../lib/supabase-server');let connections=0,closed=0,finishClose;
  const closedResponses=new Promise(resolve=>{finishClose=resolve;});
  const server=http.createServer((req,res)=>{
   connections++;res.on('close',()=>{if(++closed===2)finishClose();});res.setHeader('Content-Type','application/json');
   if(req.url.endsWith('source_health'))res.end(JSON.stringify(health));
   else {res.writeHead(200);res.write('{');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
   const signals=[],environment={SUPABASE_URL:'http://127.0.0.1:'+server.address().port,SUPABASE_PUBLISHABLE_KEY:'local-only'};
   const actual=createSnapshotStore({request:(path,options)=>{signals.push(options.signal);return transport.supabaseRequest(path,{...options,environment});}});
   warnings.length=0;const started=performance.now();
   await assert.rejects(actual.read({scope:'match-centre',interactive:true}),e=>e.status===504&&e.payload.code==='supabase_timeout');
   const elapsed=performance.now()-started;assert(elapsed>=4900&&elapsed<5800,'The actual complete-body read has one five-second bound');
   assert.equal(connections,2,'No transport retry');assert.equal(signals[0],signals[1]);assert(signals[0].aborted);
   assert.equal(require('node:events').getEventListeners(signals[0],'abort').length,0,'Transport listeners are removed');
   assert.equal(JSON.parse(warnings[0][1]).deadlineMs,5000);checks++;
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  let closeTimer;try{await Promise.race([closedResponses,new Promise((_,reject)=>{closeTimer=setTimeout(()=>reject(Error('Response cleanup did not complete')),500);})]);}finally{clearTimeout(closeTimer);}
  assert.equal(closed,2,'Both response connections close after the bound');
  console.log(JSON.stringify({passed:true,checks,interactiveDeadlineMs:5000,backgroundAndSelectedDeadlineMs:3000,sharedRemainingBudget:true,actualBodyDeadline:true,inFlightPolicyIsolation:true,lastGoodFactsAndDatesPreserved:true,noProductionRequests:true}));
 }finally{console.warn=warn;}
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run};
