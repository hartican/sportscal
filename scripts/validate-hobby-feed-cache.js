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
  const handler=createFeedHandler({load:()=>data,clock:()=>now});
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
  // Frozen input proves copy-on-write composition does not mutate shared event data.
  const event=Object.freeze({id:'frozen',key:'afl',date:'2026-09-15',startTimeUtc:'2026-09-15T04:00:00Z',participantIds:Object.freeze([]),storyline:Object.freeze({stakes:3})});
  pipeline.buildServerFeed({events:[event],userId:'a',userState:{},now:new Date('2026-09-15T03:00:00Z'),copyEvents:false});
  assert.equal(event.status,undefined);
  console.log('Feed cache: private auth/state/revision isolation, TTL, midnight/start expiry, LRU/bytes, lazy routing and immutable inputs passed');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
