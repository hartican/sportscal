#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {FeedResponseCache}=require('../lib/feed-response-cache');
const {createFeedHandler,expiry}=require('../api/feed');
const pipeline=require('../lib/server-feed-pipeline');
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;},end(){this.ended=true;return this;}};}
async function main(){
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
  let loaded=false;const fixtures=createFeedHandler({load:()=>{loaded=true;throw Error('must not load');},live:()=>async(_,res)=>res.status(200).json({ok:true})});await fixtures({url:'/api/fixtures'},response());assert.equal(loaded,false,'Fixture routing bypasses feed imports');
  const cache=new FeedResponseCache({maxEntries:2,maxBytes:200});
  cache.set('a',{body:'a',etag:'1',expiresAt:50});cache.set('b',{body:'b',etag:'2',expiresAt:50});cache.get('a',0);cache.set('c',{body:'c',etag:'3',expiresAt:50});assert.equal(cache.get('b',0),null);assert.equal(cache.get('c',50),null);assert(cache.bytes<=200);
  cache.set('huge',{body:'x'.repeat(300),etag:'4',expiresAt:100});assert.equal(cache.get('huge',0),null);
  assert.equal(expiry([{startTimeUtc:'2026-09-15T03:00:05Z'}],new Date('2026-09-15T03:00:00Z'),pipeline),Date.parse('2026-09-15T03:00:05Z'));
  assert.equal(expiry([],new Date('2026-09-15T13:59:59Z'),pipeline),Date.parse('2026-09-15T14:00:00Z'),'Sydney midnight expires cache');
  for(const snapshot of [null,{revision:'r',sources:[],stale:true},{revision:'r',sources:[],stale:false}]){
    const followed=createFeedHandler({load:()=>({...data,readLiveSnapshots:async()=>snapshot}),clock:()=>now});
    const result=response();await followed({method:'POST',url:'/api/feed?scope=match-centre',body:{preferences:{}},headers:{}},result);
    assert.equal(result.statusCode,200);assert.equal(result.body.membershipStale,!snapshot||snapshot.stale,'Followed membership exposes shared-store degradation to the retention path');
  }
  // Replay the actual failure: the full-season read times out while the
  // existing bounded Match Centre bundle has the live Bathurst observation.
  const raceNow=new Date('2026-10-11T05:10:00Z');
  const bathurst=require('../data/events.json').events.find(e=>e.id==='supercars-bathurst-1000-2026');
  assert(bathurst);
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
  // Frozen input proves copy-on-write composition does not mutate shared event data.
  const event=Object.freeze({id:'frozen',key:'afl',date:'2026-09-15',startTimeUtc:'2026-09-15T04:00:00Z',participantIds:Object.freeze([]),storyline:Object.freeze({stakes:3})});
  pipeline.buildServerFeed({events:[event],userId:'a',userState:{},now:new Date('2026-09-15T03:00:00Z'),copyEvents:false});
  assert.equal(event.status,undefined);
  require('./validate-feed-initialization-boundary');
  console.log('Feed cache: private auth/state/revision isolation, TTL, midnight/start expiry, LRU/bytes, lazy routing and immutable inputs passed');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
