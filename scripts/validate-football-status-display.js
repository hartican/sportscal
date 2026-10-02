#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const controls=require('../config/feed-controls'),timing=require('../config/card-timing');
const competitions=['competition:premier-league-2026-27','competition:uefa-champions-league','competition:uefa-europa-league'];
const fixtures=require('../data/code-inspector/football.json').fixtures;
let count=0;
for(const competitionId of competitions){
 const fixture=fixtures.find(f=>f.competitionId===competitionId&&f.status==='upcoming')||fixtures.find(f=>f.competitionId===competitionId);assert(fixture,'Published pilot fixture');
 const now=new Date(Date.parse(fixture.startTimeUtc)+30*60000);
 for(const status of ['upcoming','scheduled','unknown','live','in_progress','in-progress','ongoing'])for(const observed of [null,'invalid',new Date(+now-31*60000).toISOString(),new Date(+now+60000).toISOString()]){
  const event={...fixture,status,scheduleStatus:status,statusCheckedAt:observed,statusSource:null,timingSource:null};
  const before=JSON.stringify(event),label=`${competitionId}/${status}/${observed}`;
  assert.equal(controls.timingState(event,now)?.key,'awaiting-update',label+': clock/old/invalid/future observation cannot claim live play');
  assert.equal(timing.presentation(event,now).status,'Awaiting match update',label+': actual card presentation agrees');
  assert.equal(JSON.stringify(event),before,label+': rendering preserves original facts and dates');count++;
 }
 for(const status of ['live','in_progress','in-progress','ongoing'])for(const age of [0,30*60000]){
  const event={...fixture,status,scheduleStatus:status,statusCheckedAt:new Date(+now-age).toISOString()};
  assert.equal(controls.timingState(event,now).key,'live-now','fresh explicit status remains live');
  assert(['LIVE','ONGOING'].includes(timing.presentation(event,now).status));count++;
 }
 for(const status of ['completed','finished','final']){
  const event={...fixture,status,scheduleStatus:status,statusCheckedAt:'invalid'};
  assert.notEqual(controls.timingState(event,now)?.key,'awaiting-update','terminal result does not require a new status poll');
  assert.equal(timing.presentation(event,now).status,'FINISHED');count++;
 }
 for(const status of ['cancelled','canceled','postponed','suspended','abandoned']){
  const event={...fixture,status,scheduleStatus:status};assert.equal(controls.timingState(event,now),null,'non-playing status never claims live');count++;
 }
 const longAfter=new Date(Date.parse(fixture.startTimeUtc)+48*3600000);
 assert.equal(timing.presentation({...fixture,status:'live',statusCheckedAt:fixture.sourceCheckedAt},longAfter).status,'Awaiting match update','a retained live observation cannot remain live days later');count++;
 assert.equal(controls.timingState({...fixture,status:'upcoming'},new Date(Date.parse(fixture.startTimeUtc)-30*60000)).key,'starts-soon','confirmed future kickoff retains Starts Soon');count++;
}
async function sourceToDisplay(){
 const {createLiveFixtureHandler}=require('../lib/live-fixture-handler'),{contentHash}=require('../lib/live-fixtures');
 const published=fixtures.find(f=>f.competitionId===competitions[0]);
 const start=Date.now()-30*60000,date=new Date(start).toISOString().slice(0,10);
 const fixture={...published,startTimeUtc:new Date(start).toISOString(),date,endDate:date,endTimeUtc:new Date(start+3*3600000).toISOString()};
 const old=new Date(start-3600000).toISOString();
 const base={...fixture,status:'live',scheduleStatus:'live',statusCheckedAt:old,sourceCheckedAt:old};
 // Primary schedule adapters emit sourceCheckedAt rather than statusCheckedAt;
 // the real API stitches the shared source's later checked_at into the overlay.
 const raw={...base};delete raw.statusCheckedAt;
 let priorHash=null;
 for(const offset of [30,40]){
  const now=new Date(start+offset*60000);
  const handler=createLiveFixtureHandler({publishedFixtures:()=>[base],read:async()=>({revision:'same-facts',stale:false,sources:[{source_id:'live-premier-league',checked_at:now.toISOString(),fixtures:[raw]}]})});
  const response={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
  await handler({url:'/api/fixtures?ids='+encodeURIComponent(fixture.id),method:'GET',headers:{}},response);
  assert.equal(response.statusCode,200);const observed=response.body.sources[0].fixtures[0];assert(observed,'actual API returns selected fixture');
  assert.equal(observed.statusCheckedAt,now.toISOString(),'successful unchanged source check reaches status freshness');
  assert.equal(timing.presentation(observed,now).status,'LIVE','fresh repeated source checks do not accidentally suppress live display');
  const hash=contentHash([observed]);if(priorHash)assert.equal(hash,priorHash,'freshness alone does not change the fact hash');priorHash=hash;count++;
 }
 const now=new Date(start+40*60000);
 const handler=createLiveFixtureHandler({publishedFixtures:()=>[{...base,status:'completed',scheduleStatus:'completed'}],read:async()=>({revision:'late-live',stale:false,sources:[{source_id:'live-premier-league',checked_at:now.toISOString(),fixtures:[raw]}]})});
 const response={setHeader(){},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
 await handler({url:'/api/fixtures?ids='+encodeURIComponent(fixture.id),headers:{}},response);
 assert.equal(timing.presentation(response.body.sources[0].fixtures[0],now).status,'FINISHED','actual API terminal continuity survives a new live observation');count++;
 console.log(`Football status: ${count} cases across three published competitions, actual API observation stitching, unchanged fact hashes, fresh explicit live status and honest unresolved state.`);
}
sourceToDisplay().catch(error=>{console.error(error);process.exitCode=1;});
