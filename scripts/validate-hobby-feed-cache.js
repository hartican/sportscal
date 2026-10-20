#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {FeedResponseCache}=require('../lib/feed-response-cache');
const {createFeedHandler,expiry}=require('../api/feed');
const pipeline=require('../lib/server-feed-pipeline');
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;},end(){this.ended=true;return this;}};}
async function main(){
  await validateGlobalStaleScoreFallback();
  let builds=0,auth=0,stateVersion=1,user='alice',revision='r1',allowed=true,now=new Date('2026-09-15T03:00:00Z');
  const data={...pipeline,contextualEvents:[],canonicalSportContext:{participants:[]},eventFeed:{events:[],version:'v1',publishedAt:'2026-09-15T00:00:00Z'},bearerToken:()=>'',authenticatedUser:async()=>{auth++;if(!allowed)throw new Error('unauthorised');return{id:user};},loadUserState:async()=>({version:stateVersion}),readLiveSnapshots:async()=>({revision,sources:[]}),resolveUserFollowFixtures:()=>({events:[],participants:[],sourceVersion:'s1'}),overlaySnapshots:x=>x,buildServerFeed:({now})=>{builds++;return{events:[],generatedAt:now.toISOString(),owner:user,stateVersion};},publicError:()=>({status:401,body:{error:'unauthorised'}})};
  const handler=createFeedHandler({load:()=>data,authenticate:()=>data,clock:()=>now});
  const request=(etag)=>({method:'GET',url:'/api/feed?limit=20',headers:etag?{'if-none-match':etag}:{}});
  let a=response();await handler(request(),a);assert.equal(builds,1);assert.equal(a.statusCode,200);
  let b=response();await handler(request(a.headers.ETag),b);assert.equal(b.statusCode,304);assert.equal(builds,1);assert.equal(auth,2,'Cache must still authenticate');
  user='bob';b=response();await handler(request(a.headers.ETag),b);assert.equal(b.statusCode,200);assert.equal(b.body.owner,'bob');
  stateVersion++;b=response();await handler(request(),b);assert.equal(b.body.stateVersion,2);
  const before=builds;revision='r2';await handler(request(),response());assert.equal(builds,before+1);
  now=new Date(+now+30000);await handler(request(),response());assert.equal(builds,before+2,'TTL expiry recomputes');
  allowed=false;b=response();await handler(request(),b);assert.equal(b.statusCode,401);assert.equal(builds,before+2);
  // Same account/state/snapshot requests arriving during a cache miss must
  // share the composition work, while retaining a separate response per caller.
  let concurrentBuilds=0,releaseBuild;
  const buildGate=new Promise(resolve=>{releaseBuild=resolve;});
  const concurrentData={...data,buildServerFeed:async({now})=>{
    concurrentBuilds++;
    await buildGate;
    return {events:[],generatedAt:now.toISOString(),owner:'concurrent'};
  }};
  const concurrentHandler=createFeedHandler({load:()=>concurrentData,authenticate:()=>concurrentData,clock:()=>new Date('2026-09-15T03:00:00Z')});
  allowed=true;user='concurrent';
  const first=response(),firstRequest=concurrentHandler(request(),first);
  for(let turn=0;turn<20&&concurrentBuilds===0;turn++)await Promise.resolve();
  assert.equal(concurrentBuilds,1,'The first request must enter composition before the follower arrives');
  const second=response(),secondRequest=concurrentHandler(request(),second);
  for(let turn=0;turn<20;turn++)await Promise.resolve();
  releaseBuild();
  await Promise.all([firstRequest,secondRequest]);
  assert.equal(concurrentBuilds,1,'Identical concurrent cache misses share one composition');
  assert.equal(first.body.owner,'concurrent');assert.equal(second.body.owner,'concurrent');
  assert.equal(first.headers.ETag,second.headers.ETag);
  // A distinct authenticated account must never join another account's work.
  let privateBuilds=0,releasePrivate;
  const privateGate=new Promise(resolve=>{releasePrivate=resolve;});
  const privateData={...data,buildServerFeed:async({now,userId})=>{
    privateBuilds++;await privateGate;
    return {events:[],generatedAt:now.toISOString(),owner:userId};
  }};
  const privateHandler=createFeedHandler({load:()=>privateData,authenticate:()=>privateData,clock:()=>new Date('2026-09-15T03:00:00Z')});
  user='alice-private';const alice=response(),aliceRequest=privateHandler(request(),alice);
  for(let turn=0;turn<20&&privateBuilds===0;turn++)await Promise.resolve();
  user='bob-private';const bob=response(),bobRequest=privateHandler(request(),bob);
  for(let turn=0;turn<20&&privateBuilds<2;turn++)await Promise.resolve();
  assert.equal(privateBuilds,2,'Different accounts keep independent in-flight work');
  releasePrivate();await Promise.all([aliceRequest,bobRequest]);
  assert.equal(alice.body.owner,'alice-private');assert.equal(bob.body.owner,'bob-private');
  // A rejected shared build must not poison the next retry.
  let failingBuilds=0,fail=true;
  const failingData={...data,buildServerFeed:async({now})=>{
    failingBuilds++;if(fail)throw new Error('controlled build failure');
    return {events:[],generatedAt:now.toISOString(),owner:'retry'};
  }};
  const failingHandler=createFeedHandler({load:()=>failingData,authenticate:()=>failingData,clock:()=>new Date('2026-09-15T03:00:00Z')});
  user='retry';const failedA=response(),failedB=response();
  await Promise.all([failingHandler(request(),failedA),failingHandler(request(),failedB)]);
  assert.equal(failingBuilds,1);assert.equal(failedA.statusCode,401);assert.equal(failedB.statusCode,401);
  fail=false;const retried=response();await failingHandler(request(),retried);
  assert.equal(failingBuilds,2);assert.equal(retried.statusCode,200);assert.equal(retried.body.owner,'retry');
  // A follower whose own clock has crossed the first entry's event boundary
  // must rebuild rather than reuse that stale in-flight result.
  let boundaryBuilds=0,releaseBoundary,clockNow=new Date('2026-09-15T03:00:00Z');
  const boundaryGate=new Promise(resolve=>{releaseBoundary=resolve;});
  const boundaryEvent={id:'boundary',key:'afl',date:'2026-09-15',startTimeUtc:'2026-09-15T03:00:05Z',participantIds:[]};
  const boundaryData={...data,resolveUserFollowFixtures:()=>({events:[boundaryEvent],participants:[],sourceVersion:'boundary'}),buildServerFeed:async({now})=>{
    boundaryBuilds++;await boundaryGate;
    return {events:[],generatedAt:now.toISOString(),owner:'boundary'};
  }};
  const boundaryHandler=createFeedHandler({load:()=>boundaryData,authenticate:()=>boundaryData,clock:()=>clockNow});
  user='boundary';const beforeBoundary=response(),beforeRequest=boundaryHandler(request(),beforeBoundary);
  for(let turn=0;turn<20&&boundaryBuilds===0;turn++)await Promise.resolve();
  clockNow=new Date('2026-09-15T03:00:06Z');
  const afterBoundary=response(),afterRequest=boundaryHandler(request(),afterBoundary);
  for(let turn=0;turn<20;turn++)await Promise.resolve();
  releaseBoundary();await Promise.all([beforeRequest,afterRequest]);
  assert.equal(boundaryBuilds,2,'A follower after its event boundary rebuilds with its own clock');
  assert.equal(afterBoundary.body.generatedAt,'2026-09-15T03:00:06.000Z');
  // Three callers can span two boundaries. The last caller must recheck the
  // second shared result and use its own clock rather than inherit it.
  const multiBase=Date.parse('2026-10-18T01:00:00Z'),multiStart=multiBase+1000,multiEnd=multiBase+2000;
  let multiNow=new Date(multiBase),multiBuilds=0,releaseMulti;
  const multiGate=new Promise(resolve=>{releaseMulti=resolve;});
  const multiEvent={id:'multi-boundary',key:'afl',date:'2026-10-18',startTimeUtc:new Date(multiStart).toISOString(),endTimeUtc:new Date(multiEnd).toISOString(),participantIds:[]};
  const multiData={...data,resolveUserFollowFixtures:()=>({events:[multiEvent],participants:[],sourceVersion:'multi-boundary'}),buildServerFeed:async({now})=>{
    multiBuilds++;await multiGate;
    return {events:[{id:multiEvent.id,phase:+now<multiStart?'before-start':+now<multiEnd?'during':'after-end'}],generatedAt:now.toISOString()};
  }};
  const multiHandler=createFeedHandler({load:()=>multiData,authenticate:()=>multiData,clock:()=>multiNow});
  user='multi-boundary';const earliest=response(),earliestRequest=multiHandler(request(),earliest);
  for(let turn=0;turn<60&&multiBuilds===0;turn++)await Promise.resolve();
  multiNow=new Date(multiBase+1500);const middle=response(),middleRequest=multiHandler(request(),middle);
  for(let turn=0;turn<60;turn++)await Promise.resolve();
  multiNow=new Date(multiBase+2500);const latest=response(),latestRequest=multiHandler(request(),latest);
  for(let turn=0;turn<60;turn++)await Promise.resolve();
  releaseMulti();await Promise.all([earliestRequest,middleRequest,latestRequest]);
  assert.equal(multiBuilds,3,'A third waiter crossing a second boundary gets a bounded caller-owned build');
  assert.equal(earliest.body.events[0].phase,'before-start');assert.equal(middle.body.events[0].phase,'during');
  assert.equal(latest.body.events[0].phase,'after-end');assert.equal(latest.body.generatedAt,'2026-10-18T01:00:02.500Z');
  // Exercise the production diagnostic branch for cold, warm, concurrent and
  // error paths, and always restore the caller's environment and console.
  const savedVercel=process.env.VERCEL,savedConsoleLog=console.log,productionLogs=[];
  try{
    process.env.VERCEL='1';console.log=value=>productionLogs.push(JSON.parse(value));
    allowed=true;user='production-diagnostics';
    const productionHandler=createFeedHandler({load:()=>data,authenticate:()=>data,clock:()=>new Date('2026-09-15T03:00:00Z')});
    const productionCold=response();await productionHandler(request(),productionCold);
    assert.equal(productionCold.statusCode,200,'Vercel diagnostics preserve a cold miss');assert.equal(productionCold.headers['X-Feed-Cache'],'MISS');
    const productionWarm=response();await productionHandler(request(),productionWarm);
    assert.equal(productionWarm.statusCode,200,'Vercel diagnostics preserve a warm hit');assert.equal(productionWarm.headers['X-Feed-Cache'],'HIT');
    let productionConcurrentBuilds=0;
    const productionConcurrentData={...data,buildServerFeed:async({now})=>{
      productionConcurrentBuilds++;await Promise.resolve();return {events:[],generatedAt:now.toISOString(),owner:'production-concurrent'};
    }};
    const productionConcurrentHandler=createFeedHandler({load:()=>productionConcurrentData,authenticate:()=>productionConcurrentData,clock:()=>new Date('2026-09-15T03:00:00Z')});
    const productionConcurrentA=response(),productionConcurrentB=response();
    await Promise.all([productionConcurrentHandler(request(),productionConcurrentA),productionConcurrentHandler(request(),productionConcurrentB)]);
    assert.equal(productionConcurrentBuilds,1,'Vercel diagnostics preserve shared concurrent composition');
    const productionErrorData={...data,buildServerFeed:async()=>{throw Error('controlled production diagnostic failure');}};
    const productionError=response();await createFeedHandler({load:()=>productionErrorData,authenticate:()=>productionErrorData,clock:()=>new Date('2026-09-15T03:00:00Z')})(request(),productionError);
    assert.equal(productionError.statusCode,401,'Vercel diagnostics preserve the error response path');
    assert.equal(productionLogs.length,2,'Only completed cold and concurrent misses emit production timing diagnostics');
    assert(productionLogs.every(record=>record.event==='feed_timing'&&Array.isArray(record.phases)&&Number.isFinite(record.bytes)),'Production timing diagnostics retain their structured payload');
  }finally{
    console.log=savedConsoleLog;
    if(savedVercel===undefined)delete process.env.VERCEL;else process.env.VERCEL=savedVercel;
  }
  let loaded=false;const fixtures=createFeedHandler({load:()=>{loaded=true;throw Error('must not load');},live:()=>async(_,res)=>res.status(200).json({ok:true})});await fixtures({url:'/api/fixtures'},response());assert.equal(loaded,false,'Fixture routing bypasses feed imports');
  const cache=new FeedResponseCache({maxEntries:2,maxBytes:200});
  cache.set('a',{body:'a',etag:'1',expiresAt:50});cache.set('b',{body:'b',etag:'2',expiresAt:50});cache.get('a',0);cache.set('c',{body:'c',etag:'3',expiresAt:50});assert.equal(cache.get('b',0),null);assert.equal(cache.get('c',50),null);assert(cache.bytes<=200);
  cache.set('huge',{body:'x'.repeat(300),etag:'4',expiresAt:100});assert.equal(cache.get('huge',0),null);
  let releasePending;
  const pendingGate=new Promise(resolve=>{releasePending=resolve;});
  const boundedPending=new FeedResponseCache({maxEntries:1,maxBytes:200});
  const firstPending=boundedPending.pendingEntry('first',async()=>{await pendingGate;return {body:'first'};});
  for(let turn=0;turn<20&&boundedPending.pending.size===0;turn++)await Promise.resolve();
  const secondPending=boundedPending.pendingEntry('second',async()=>({body:'second'}));
  await Promise.resolve();
  assert.equal(boundedPending.pending.size,1,'In-flight coalescing remains bounded when keys are unique');
  releasePending();await Promise.all([firstPending,secondPending]);
  assert.equal(expiry([{startTimeUtc:'2026-09-15T03:00:05Z'}],new Date('2026-09-15T03:00:00Z'),pipeline),Date.parse('2026-09-15T03:00:05Z'));
  assert.equal(expiry([],new Date('2026-09-15T13:59:59Z'),pipeline),Date.parse('2026-09-15T14:00:00Z'),'Sydney midnight expires cache');
  // The actual lifecycle calendar conversion must run once per fixture. Its
  // archive boundary is exactly one millisecond before the expiry boundary.
  const lifecycle=require('../config/card-lifecycle');
  const datedExpiryEvent={id:'single-expiry',date:'2026-11-01',key:'afl',status:'scheduled'};
  const originalParts=Intl.DateTimeFormat.prototype.formatToParts;
  let calendarPasses=0,emptyPasses,singleLifecyclePasses,feedExpiryPasses;
  try{
    Intl.DateTimeFormat.prototype.formatToParts=function(...args){calendarPasses++;return originalParts.apply(this,args);};
    expiry([],now,pipeline);emptyPasses=calendarPasses;
    calendarPasses=0;lifecycle.expiresAtForEvent(datedExpiryEvent);singleLifecyclePasses=calendarPasses;
    calendarPasses=0;expiry([datedExpiryEvent],now,pipeline);feedExpiryPasses=calendarPasses;
  }finally{Intl.DateTimeFormat.prototype.formatToParts=originalParts;}
  assert(singleLifecyclePasses>0,'The regression must exercise real Sydney calendar conversion');
  assert.equal(feedExpiryPasses,emptyPasses+singleLifecyclePasses,'Feed expiry performs one lifecycle calculation per fixture');
  // The optimisation relies on the actual lifecycle contract, including null
  // deadlines. Pin both archive and expiry instants rather than a longer TTL.
  for(const event of [datedExpiryEvent,{...datedExpiryEvent,status:'suspended'},{...datedExpiryEvent,status:'postponed'},
    {...datedExpiryEvent,date:'unknown'},
    {...datedExpiryEvent,status:'completed',firstConfirmedCompleteAt:'2026-10-18T03:00:00Z',date:'2026-10-18'},
    {...datedExpiryEvent,status:'live',statusCheckedAt:new Date().toISOString(),statusSourceUrl:'https://example.test/fixture'}]){
    const actualExpiry=lifecycle.expiresAtForEvent(event),actualArchive=lifecycle.archivesAtForEvent(event);
    assert.equal(actualArchive?.getTime()??null,actualExpiry?+actualExpiry-1:null,'Keep the shared lifecycle archive/expiry relation');
  }
  for(const iso of ['2026-04-04T15:59:59Z','2026-04-04T16:00:01Z','2026-10-03T15:59:59Z','2026-10-03T16:00:01Z']){
    const reference=new Date(iso);
    assert.equal(expiry([{startTimeUtc:new Date(+reference+999).toISOString()}],reference,pipeline),+reference+999,'DST boundaries retain exact fixture deadline');
    assert.equal(expiry([{startTimeUtc:iso}],reference,pipeline),+reference+1,'An exact boundary still permits only the next millisecond');
  }
  for(const snapshot of [null,{revision:'r',sources:[],stale:true},{revision:'r',sources:[],stale:false}]){
    const followed=createFeedHandler({load:()=>({...data,readLiveSnapshots:async()=>snapshot}),clock:()=>now});
    const result=response();await followed({method:'POST',url:'/api/feed?scope=match-centre',body:{preferences:{}},headers:{}},result);
    assert.equal(result.statusCode,200);assert.equal(result.body.membershipStale,!snapshot||snapshot.stale,'Followed membership exposes shared-store degradation to the retention path');
  }
  // Replay the historical live fallback against its captured pre-race card.
  // A later official final must not become the base of an earlier live replay.
  const raceNow=new Date('2026-10-11T05:10:00Z');
  const historicalBathurst=require('./fixtures/bathurst-prematch-editorial-20261011.json');
  const bathurst=structuredClone(historicalBathurst.event);
  assert.equal(bathurst.status,'scheduled');
  assert(/^[a-f0-9]{40}$/.test(historicalBathurst.sourceSnapshot));
  const liveBathurst={...bathurst,status:'live',statusCheckedAt:raceNow.toISOString(),scoreCheckedAt:raceNow.toISOString(),fixtureObservationSchema:'fixture-observations.v1'};
  const near={...bathurst,id:'race-near',eventId:'race-near',canonicalEventId:'race-near',status:'upcoming',startTimeUtc:new Date(+raceNow+600000).toISOString(),sourceEventIds:['race-near-alias']};
  const raceReads=[];
  const raceData={...pipeline,eventFeed:{version:'race-replay',publishedAt:raceNow.toISOString()},contextualEvents:[bathurst,near],canonicalSportContext:{participants:[]},resolveUserFollowFixtures:({events})=>({events,participants:[]}),overlaySnapshots:require('../lib/live-fixtures').overlaySnapshots,
    readLiveSnapshots:async options=>{raceReads.push(options);if(options?.scope!=='match-centre')throw Error('Full-season read exceeded its unchanged three-second deadline');return {revision:'race-current',stale:false,sources:[{source_id:'live-supercars-bathurst',checked_at:raceNow.toISOString(),fixtures:[liveBathurst,{...near,startTimeUtc:new Date(+raceNow+3600000).toISOString()}]}]};}};
  for(const sport of ['supercars','motorsport']){
    for(const signedIn of [false,true]){
      const preferences={version:26,followedSports:[sport]},state={preferences,event_user_state:{}};
      const raceHandler=createFeedHandler({load:()=>raceData,clock:()=>raceNow,authenticate:()=>({bearerToken:()=>'',authenticatedUser:async()=>({id:'race-follower'}),loadUserState:async()=>state})});
      const result=response();await raceHandler({method:signedIn?'GET':'POST',url:'/api/feed?scope=match-centre',body:{preferences},headers:{}},result);
      assert.equal(result.statusCode,200);
      assert(result.body.events.some(e=>e.id===bathurst.id),'Bathurst must survive the Followed caller when the global read is unavailable');
      assert.equal(result.body.membershipStale,false);
      assert(!result.body.events.some(e=>e.id===near.id),'A source-corrected start outside the current window must leave membership');
      assert.equal(raceReads.at(-1).scope,'match-centre');
      assert(raceReads.at(-1).preserveIds.includes(near.id)&&raceReads.at(-1).preserveIds.includes('race-near-alias'),'Preserve known near-window identities and aliases for source corrections');
    }
  }
  // Actual browser parent selection includes enabled descendant domain rows.
  // Normalization must not convert approved Bathurst inheritance to a mute.
  const inherited={version:27,selectedSelectorEntityIds:['sport:motorsport'],followedSports:['motorsport','supercars'],preferenceGraph:{domainPreferences:[{sportDomainId:'sport:motorsport',enabled:true},{sportDomainId:'sport:supercars',enabled:true},{sportDomainId:'sport:dakar',enabled:true}],entityFollows:[],competitionPreferences:[]}};
  const originalInherited=JSON.stringify(inherited);
  for(const signedIn of [false,true]){
    const parentHandler=createFeedHandler({load:()=>raceData,clock:()=>raceNow,authenticate:()=>({bearerToken:()=>'',authenticatedUser:async()=>({id:'parent-follower'}),loadUserState:async()=>({preferences:inherited})})});
    const result=response();await parentHandler({method:signedIn?'GET':'POST',url:'/api/feed?scope=match-centre',body:{preferences:inherited},headers:{}},result);
    assert(result.body.events.some(e=>e.id===bathurst.id),'An enabled Supercars domain under an explicit Motorsport parent must retain approved Bathurst admission');
  }
  const parentNormalized=pipeline.normalizeUserFollowState({preferences:inherited}).preferences;
  assert.deepEqual(parentNormalized.selectedSelectorEntityIds,['sport:motorsport'],'Inherited Bathurst must not create a separate child follow');
  assert.equal(parentNormalized.preferenceGraph.domainPreferences.find(d=>d.sportDomainId==='sport:dakar').enabled,false,'The Bathurst exception cannot enable new Dakar coverage');
  for(const change of ['domain','competition']){
    const preferences=structuredClone(inherited);
    if(change==='domain')preferences.preferenceGraph.domainPreferences.find(d=>d.sportDomainId==='sport:supercars').enabled=false;
    else preferences.preferenceGraph.competitionPreferences=[{competitionId:'competition:supercars',enabled:false}];
    const result=response();await createFeedHandler({load:()=>raceData,clock:()=>raceNow})({method:'POST',url:'/api/feed?scope=match-centre',body:{preferences},headers:{}},result);
    assert(!result.body.events.some(e=>e.id===bathurst.id),'An explicit '+change+' exclusion must still suppress inherited Bathurst');
  }
  assert.equal(JSON.stringify(inherited),originalInherited,'Normalizing the parent selection must preserve its original settings');
  const excluded=response();await createFeedHandler({load:()=>raceData,clock:()=>raceNow})({method:'POST',url:'/api/feed?scope=match-centre',body:{preferences:{version:26,followedSports:['supercars']},eventUserState:{[bathurst.id]:{dismissed:true}}},headers:{}},excluded);
  assert(!excluded.body.events.some(e=>e.id===bathurst.id),'The bounded read cannot override a dismissal');
  // Independently test the actual published final: an older live observation
  // cannot reopen it or renew its one-hour Recently finished membership.
  const currentBathurst=require('../data/events.json').events.find(e=>e.id===bathurst.id);
  assert(currentBathurst);
  if(['completed','finished','final'].includes(currentBathurst.status)){
    const original=JSON.stringify(currentBathurst),completed=Date.parse(currentBathurst.firstConfirmedCompleteAt);
    assert(Number.isFinite(completed),'Current final retains its original confirmed completion');
    const preferences={version:26,followedSports:['supercars']};
    for(const [offset,present] of [[600000,true],[3600001,false]])for(const signedIn of [false,true]){
      const finalNow=new Date(completed+offset);
      const finalData={...raceData,contextualEvents:[currentBathurst],readLiveSnapshots:async options=>{
        assert.equal(options.scope,'match-centre');
        return {revision:'older-race-live',stale:false,sources:[{source_id:'live-supercars-bathurst',checked_at:raceNow.toISOString(),fixtures:[liveBathurst]}]};
      }};
      const finalHandler=createFeedHandler({load:()=>finalData,clock:()=>finalNow,authenticate:()=>({bearerToken:()=>'',authenticatedUser:async()=>({id:'final-follower'}),loadUserState:async()=>({preferences})})});
      const result=response();await finalHandler({method:signedIn?'GET':'POST',url:'/api/feed?scope=match-centre',body:{preferences},headers:{}},result);
      assert.equal(result.statusCode,200);
      const retained=result.body.events.find(e=>e.id===bathurst.id);
      assert.equal(Boolean(retained),present,'Only the original one-hour completed window remains in Match Centre');
      if(retained){assert.equal(retained.status,currentBathurst.status,'Old live data cannot reopen a final');assert.equal(retained.firstConfirmedCompleteAt,currentBathurst.firstConfirmedCompleteAt,'A read cannot renew completion');}
    }
    assert.equal(JSON.stringify(currentBathurst),original,'Final fallback checks preserve published facts');
  }
  // Frozen input proves copy-on-write composition does not mutate shared event data.
  const event=Object.freeze({id:'frozen',key:'afl',date:'2026-09-15',startTimeUtc:'2026-09-15T04:00:00Z',participantIds:Object.freeze([]),storyline:Object.freeze({stakes:3})});
  pipeline.buildServerFeed({events:[event],userId:'a',userState:{},now:new Date('2026-09-15T03:00:00Z'),copyEvents:false});
  assert.equal(event.status,undefined);
  require('./validate-feed-initialization-boundary');
  console.log('Feed cache: private auth/state/revision isolation, TTL, midnight/start expiry, LRU/bytes, lazy routing and immutable inputs passed');
}
main().catch(e=>{console.error(e);process.exitCode=1;});

async function validateGlobalStaleScoreFallback(){
 const live=require('../lib/live-fixtures'),{SupabaseRequestError}=require('../lib/supabase-server');
const id='fixture:nrl:controlled-stale-score';
const initial=Date.parse('2026-10-18T10:50:00Z');let now=initial,mode='timeout';
const base={id,eventId:id,canonicalEventId:id,name:'Controlled Home v Controlled Away',key:'nrl',sport:'rugby-league',competitionId:'competition:nrl',date:'2026-10-18',startTimeUtc:'2026-10-18T10:00:00Z',status:'live',homeParticipantId:'team:nrl:controlled-home',awayParticipantId:'team:nrl:controlled-away',participantIds:['team:nrl:controlled-home','team:nrl:controlled-away'],homeScore:6,awayScore:4,score:{home:6,away:4},fixtureObservationSchema:'fixture-observations.v1',scoreCheckedAt:'2026-10-18T10:20:00Z',scoreFactObservedAt:'2026-10-18T10:20:00Z',statusCheckedAt:'2026-10-18T10:20:00Z',statusFactObservedAt:'2026-10-18T10:20:00Z',sourceCheckedAt:'2026-10-18T10:20:00Z',sourceUrl:'https://constructed.invalid/fixture',isKnockout:true};
const current={...base,homeScore:10,awayScore:8,score:{home:10,away:8},scoreCheckedAt:'2026-10-18T10:40:00Z',scoreFactObservedAt:'2026-10-18T10:40:00Z',sourceCheckedAt:'2026-10-18T10:40:00Z'};
const recovered={...current,homeScore:12,score:{home:12,away:8},scoreCheckedAt:'2026-10-18T10:52:00Z',scoreFactObservedAt:'2026-10-18T10:52:00Z',sourceCheckedAt:'2026-10-18T10:52:00Z'};
const original=JSON.stringify([base,current,recovered]);
const requestCalls=[],reads=[],warnings=[];let builds=0;
const store=live.createSnapshotStore({request:async(p,o)=>{
 assert.equal(o.timeoutMs,3000);assert.equal(o.method,p.endsWith('source_health')?'POST':'GET');requestCalls.push({phase:p.endsWith('source_health')?'health':'bundle',mode});
 if(p.endsWith('source_health')){assert.deepEqual(o.body,{});return [{source_id:'controlled-source',revision:mode==='recovered'?2:1,checked_at:mode==='recovered'?recovered.sourceCheckedAt:current.sourceCheckedAt}];}
 assert(p.endsWith('nothingsports_current_global_fixture_bundle?select=bundle'));assert.equal(o.body,undefined);
 if(mode==='timeout')throw new SupabaseRequestError('Constructed timeout',{status:504,payload:{code:'supabase_timeout'}});
 return [{bundle:{schemaVersion:'current-fixture-bundle.v1',complete:true,rows:[{source_id:'controlled-source',fixture_id:id,fixture:mode==='recovered'?recovered:current}]}}];
}});
const data={...pipeline,eventFeed:{events:[base],version:'constructed-stale-v1',publishedAt:'2026-10-18T10:20:00Z'},contextualEvents:[base],canonicalSportContext:{participants:[]},resolveUserFollowFixtures:async({events})=>({events,participants:[]}),overlaySnapshots:live.overlaySnapshots,
 readLiveSnapshots:async options=>{assert.equal(options,undefined,'Ordinary Feed retains global/default scope');const snapshot=await live.readLiveSnapshots({store,scope:'global',interactive:false,now,maxAgeMs:0});reads.push({stale:snapshot.stale,readAt:snapshot.readAt,revision:snapshot.revision});return snapshot;},
 buildServerFeed:async args=>{builds++;return pipeline.buildServerFeed(args);}};
const state={preferences:{version:27,selectedSelectorEntityIds:['sport:nrl'],followedSports:['nrl'],preferenceGraph:{domainPreferences:[{sportDomainId:'sport:nrl',enabled:true}],entityFollows:[]}},event_user_state:{},updated_at:'2026-10-18T10:00:00Z'},stateBefore=JSON.stringify(state);
const auth={bearerToken:()=>'',authenticatedUser:async()=>({id:'controlled-user'}),loadUserState:async()=>state,publicError:()=>({status:500,body:{error:'Controlled failure'}})};
const handler=createFeedHandler({load:()=>data,authenticate:()=>auth,clock:()=>new Date(now)});
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(body){this.body=body;return this;},end(){this.ended=true;}});
async function run(label){const res=response();await handler({method:'GET',url:'/api/feed?limit=20',headers:{}},res);assert.equal(res.code,200,label);const event=res.body.events.find(e=>e.id===id);assert(event,'Constructed fixture missing; returned IDs: '+JSON.stringify(res.body.events.map(e=>[e.id,e.eventId])));return {res,event,summary:{label,status:res.code,cache:res.headers['X-Feed-Cache'],snapshotStale:res.body.fixtureSnapshotStale,generatedAt:res.body.generatedAt,score:event.score,homeScore:event.homeScore,awayScore:event.awayScore,scoreCheckedAt:event.scoreCheckedAt,scoreFactObservedAt:event.scoreFactObservedAt,statusCheckedAt:event.statusCheckedAt,sourceCheckedAt:event.sourceCheckedAt}};}
await (async()=>{
 const originalWarn=console.warn;console.warn=(...args)=>warnings.push(args);
 try{
  const cold=await run('cold published fallback');assert.equal(cold.res.body.fixtureSnapshotStale,true);assert.equal(cold.event.homeScore,6);assert.equal(cold.event.scoreCheckedAt,base.scoreCheckedAt);
  mode='fresh';now+=1000;const fresh=await run('healthy current overlay');assert.equal(fresh.res.body.fixtureSnapshotStale,false);assert.equal(fresh.event.homeScore,10);assert.equal(fresh.event.scoreCheckedAt,current.scoreCheckedAt);const seed=reads.at(-1);
  mode='timeout';now+=31001;const stale=await run('failed refresh retains last-good snapshot');assert.equal(stale.res.body.fixtureSnapshotStale,true);assert.equal(stale.event.homeScore,10);assert.equal(stale.event.scoreCheckedAt,current.scoreCheckedAt);assert.equal(reads.at(-1).readAt,seed.readAt);
  now+=1000;const cached=await run('same stale response cache hit');assert.equal(cached.res.headers['X-Feed-Cache'],'HIT');assert.equal(cached.res.body.fixtureSnapshotStale,true);assert.equal(cached.event.homeScore,10);assert.equal(cached.event.scoreCheckedAt,current.scoreCheckedAt);assert.equal(cached.res.body.generatedAt,stale.res.body.generatedAt);
  mode='recovered';now=Date.parse('2026-10-18T10:53:00Z');const recovery=await run('genuine later constructed observation');assert.equal(recovery.res.body.fixtureSnapshotStale,false);assert.equal(recovery.event.homeScore,12);assert.equal(recovery.event.scoreCheckedAt,recovered.scoreCheckedAt);
  for(const [result,expected]of [[cold,base],[fresh,current],[stale,current],[cached,current],[recovery,recovered]]){for(const key of ['homeScore','awayScore','scoreCheckedAt','scoreFactObservedAt','statusCheckedAt','statusFactObservedAt','sourceCheckedAt'])assert.equal(result.event[key],expected[key],'Original score/observation field '+key);}
  assert.equal(JSON.stringify([base,current,recovered]),original);assert.equal(JSON.stringify(state),stateBefore);assert.equal(requestCalls.length,10,'Exactly original two mocked reads per handler request; no extra or retry');assert.equal(builds,4,'Stale response cache hit reuses composition but still attempts current snapshot pair');
  const diagnostics=warnings.map(w=>JSON.parse(w[1]));assert.equal(diagnostics.length,3);assert(diagnostics.every(d=>d.scope==='global'&&d.phase==='fixture-bundle'&&d.status===504&&d.code==='supabase_timeout'&&d.deadlineMs===3000));
  console.warn=originalWarn;console.log('Actual global Feed fallback: published/last-good/cached stale/recovery score and original receipt truth passed;10mocked calls,4builds.');
 }finally{console.warn=originalWarn;}
})();

}
