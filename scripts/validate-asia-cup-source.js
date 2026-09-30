'use strict';
const assert=require('node:assert/strict');
const {completedAsiaCup,coverageSources}=require('../lib/source-coverage');
const sample=require('./fixtures/source-coverage/asia-cup-2026-completed.json');
(async()=>{
 const now=new Date(sample.checkedAt),calls=[];
 const request=async url=>{calls.push(url);return{ok:true,json:async()=>({fixtures:sample.pages[new URL(url).searchParams.has('lastId')?1:0]})};};
 const events=await completedAsiaCup(request,now);
 const {mergeFixtureRecords}=require('./build-code-inspector');
 const finalFact=events[0],stale={...finalFact,id:'older-provider-id',eventId:'older-provider-id',canonicalEventId:'older-provider-id',sourceCheckedAt:'2026-09-01T00:00:00Z',status:'scheduled',scoreDisplay:null,innings:[],viewingOptions:[{providerId:'kayo'}],broadcaster:'Kayo'};
 for(const order of [[stale,finalFact],[finalFact,stale]]){const [merged]=mergeFixtureRecords([],order,'sport:cricket');assert.equal(merged.status,'completed');assert.equal(merged.scoreDisplay,finalFact.scoreDisplay);assert.equal(merged.viewingOptions[0].providerId,'kayo');assert(merged.sourceEventIds.includes(finalFact.id));}
 assert.equal(events.length,15);assert.equal(calls.length,2);assert.equal(new URL(calls[1]).searchParams.get('lastId'),String(sample.pages[0].at(-1).id));
 assert(events.every(f=>f.status==='completed'&&f.participantIds.length===2));
 const final=events.find(f=>f.id==='fixture:cricket:CA:40960');assert.equal(final.name,'India Women v Sri Lanka Women');assert.match(final.scoreDisplay,/72 runs/);assert.equal(final.date,'2026-09-14');assert.equal(final.time,'00:30');
 for(const payload of [{fixtures:[]},{fixtures:sample.pages[0].slice(0,2)},{responseError:'unavailable',fixtures:sample.pages[0]},{fixtures:sample.pages[0].map((f,i)=>i?f:{...f,isCompleted:false})},{fixtures:sample.pages[0].map((f,i)=>i?f:{...f,competition:{id:999}})}])await assert.rejects(()=>completedAsiaCup(async()=>({ok:true,json:async()=>payload}),now));
 await assert.rejects(()=>completedAsiaCup(async()=>({ok:true,json:async()=>({fixtures:sample.pages[0]})}),now),/duplicate/);
 await assert.rejects(()=>completedAsiaCup(async url=>{if(new URL(url).searchParams.has('lastId'))throw Error('Page 2 unavailable');return{ok:true,json:async()=>({fixtures:sample.pages[0]})};},now),/Page 2/);
 assert.equal(coverageSources().find(s=>s.id==='cricket-ca-4710').minimumIntervalMs,21600000);
 if(process.argv.includes('--published'))for(const file of ['../data/follow-sources/coverage.v1.json','../data/code-inspector/cricket.json','../data/follow-schedule/cricket.json']){
  const data=require(file),all=data.events||data.fixtures;
  for(const expected of events){
   const actual=all.filter(f=>f.id===expected.id||f.sourceEventIds?.includes(expected.id));assert.equal(actual.length,1,file+': one stable or aliased fixture '+expected.id);
   assert.equal(actual[0].status,'completed');assert.deepEqual(new Set(actual[0].participantIds),new Set(expected.participantIds));
  }
 }
 console.log('Asia Cup: 15 confirmed results, pagination, retained identities, Sydney times, incomplete/wrong-source failures and six-hour cadence passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
