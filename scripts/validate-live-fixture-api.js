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
  res=response();await handler({url:"/api/fixtures",method:"GET",headers:{}},res);assert.equal(res.body.sources[0].fixtures[0].status,"live");assert.equal(res.headers["Cache-Control"],"no-store");
  res=response();await handler({url:"/api/fixtures?revision=revision-two",method:"GET",headers:{}},res);assert.equal(res.statusCode,304);
  res=response();await createLiveFixtureHandler({read:async()=>{throw new Error(secret);}})({url:"/api/fixtures",headers:{}},res);assert.equal(res.statusCode,503);assert(!JSON.stringify(res.body).includes(secret));
  const athleteHandler=createLiveFixtureHandler({read:async()=>({revision:'athlete-revision',stale:false,sources:[{source_id:'discovery-ai-athletes',fixtures:[{id:'race',enrichmentOnly:true,fixtureFallback:{id:'race',name:'NLS Round 8',date:'2026-09-12',key:'motorsport'},participationEvidence:[{participantId:'competitor:f1:george-russell',displayName:'George Russell',participationStatus:'confirmed',participationKind:'race',sourceUrl:'https://www.nuerburgring-langstrecken-serie.de/',checkedAt:'2026-09-08'}]}]}]})});
  res=response();await athleteHandler({url:'/api/fixtures?athlete=competitor%3Af1%3Ageorge-russell',headers:{}},res);
  assert.equal(res.body.schemaVersion,'athlete-participation-live.v1');assert.equal(res.body.history[0].description,'Confirmed entry — NLS Round 8');
  assert(!res.body.sources,'profile lookup does not download every fixture');
  console.log("Live fixture API: public read, revision validator, protected POST and safe failure passed.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
