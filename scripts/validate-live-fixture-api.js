#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),{createLiveFixtureHandler}=require("../lib/live-fixture-handler");
const response=()=>({headers:{},setHeader(key,value){this.headers[key]=value;},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;},end(){this.ended=true;}});
async function main(){
  const secret="a-test-only-server-secret-at-least-32-characters";
  const handler=createLiveFixtureHandler({environment:{FIXTURE_REFRESH_SECRET:secret},sources:()=>[],refresh:async()=>({refreshed:[],failed:[],skipped:[]}),read:async()=>({revision:"revision-two",stale:false,sources:[{source_id:"test",fixtures:[{id:"fixture",status:"live"}]}]})});
  let res=response();await handler({url:"/api/fixture-refresh",method:"POST",headers:{}},res);assert.equal(res.statusCode,401);
  res=response();await handler({url:"/api/fixture-refresh",method:"GET",headers:{authorization:`Bearer ${secret}`}},res);assert.equal(res.statusCode,405);
  res=response();await handler({url:"/api/fixture-refresh",method:"POST",headers:{authorization:`Bearer ${secret}`}},res);assert.equal(res.statusCode,200);
  res=response();await handler({url:"/api/fixtures",method:"GET",headers:{}},res);assert.equal(res.body.sources.flatMap(source=>source.fixtures).find(event=>event.id==='fixture').status,"live");assert.equal(res.headers["Cache-Control"],"no-store");
  const revision=res.body.revision;
  const libraryHandler=createLiveFixtureHandler({publishedFixtures:()=>[{id:'known-before-server-refresh',date:new Date(Date.now()+86400000).toISOString().slice(0,10),key:'cricket',name:'Published fixture'}],read:async()=>({revision:'empty',sources:[],stale:false})});
  res=response();await libraryHandler({url:'/api/fixtures',headers:{}},res);assert(res.body.sources.flatMap(source=>source.fixtures).some(event=>event.id==='known-before-server-refresh'),'a first failed or partial server lookup cannot hide fixtures in the verified library');
  res=response();await handler({url:`/api/fixtures?revision=${revision}`,method:"GET",headers:{}},res);assert.equal(res.statusCode,304);
  res=response();await createLiveFixtureHandler({read:async()=>{throw new Error(secret);}})({url:"/api/fixtures",headers:{}},res);assert.equal(res.statusCode,503);assert(!JSON.stringify(res.body).includes(secret));
  const scopedHandler=createLiveFixtureHandler({publishedFixtures:()=>[],read:async()=>({revision:'scoped',stale:false,sources:[{source_id:'test',fixtures:[{id:'followed',status:'live'},{id:'unfollowed',status:'live'}]}]})});
  res=response();await scopedHandler({url:'/api/fixtures?ids=followed',headers:{}},res);assert.deepEqual(res.body.sources.flatMap(s=>s.fixtures).map(e=>e.id),['followed'],'bounded live request excludes unrelated fixtures');
  const selectedRevision=res.body.revision;
  const finalsHandler=createLiveFixtureHandler({read:async()=>({revision:'old-draw',stale:false,sources:[{source_id:'old',fixtures:[{id:'major-match:nrl-finals-2026:elimination-final-1',name:'5th v 8th',date:'',time:null,scheduleStatus:'provisional'}]}]})});
  res=response();await finalsHandler({url:'/api/fixtures?ids=major-match:nrl-finals-2026:elimination-final-1',headers:{}},res);
  const final=res.body.sources.flatMap(s=>s.fixtures)[0];assert.equal(final.name,'Sharks v Cowboys');assert.equal(final.date,'2026-09-12');assert.equal(final.time,'19:50');
  res=response();await scopedHandler({url:'/api/fixtures?ids=unfollowed&revision='+selectedRevision,headers:{}},res);assert.equal(res.statusCode,200,'different viewport selection invalidates revision');
  res=response();await scopedHandler({url:'/api/fixtures?ids='+Array.from({length:61},(_,i)=>'id'+i).join(','),headers:{}},res);assert.equal(res.statusCode,400,'server enforces 60-fixture bound');
  const athleteHandler=createLiveFixtureHandler({read:async()=>({revision:'athlete-revision',stale:false,sources:[{source_id:'discovery-ai-athletes',fixtures:[{id:'race',enrichmentOnly:true,fixtureFallback:{id:'race',name:'NLS Round 8',date:'2026-09-12',key:'motorsport'},participationEvidence:[{participantId:'competitor:f1:george-russell',displayName:'George Russell',participationStatus:'confirmed',participationKind:'race',sourceUrl:'https://www.nuerburgring-langstrecken-serie.de/',checkedAt:'2026-09-08'}]}]}]})});
  res=response();await athleteHandler({url:'/api/fixtures?athlete=competitor%3Af1%3Ageorge-russell',headers:{}},res);
  assert.equal(res.body.schemaVersion,'athlete-participation-live.v1');assert.equal(res.body.history[0].description,'Confirmed entry — NLS Round 8');
  assert(!res.body.sources,'profile lookup does not download every fixture');
  console.log("Live fixture API: public read, revision validator, protected POST and safe failure passed.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
