'use strict';
const assert=require('node:assert/strict');
const {coverageSources}=require('../lib/source-coverage');
const recorded=require('./fixtures/source-coverage/asia-cup-2026-completed.json');
const sample={pages:recorded.pages.map(page=>page.map(g=>({...g,startDateTime:'2026-09-18T00:00:00Z',endDateTime:'2026-09-18T04:00:00Z'})))};
const now=new Date('2026-09-20T00:00:00Z');
const games=sample.pages.flat();
const prior=games.map(g=>({id:`fixture:cricket:CA:${g.id}`,status:'live',startTimeUtc:g.startDateTime,endTimeUtc:g.endDateTime}));
async function run({previous=prior,coverage={},pages=sample.pages,failPage=-1}={}){
 const calls=[];let index=0;
 const source=coverageSources(async url=>{calls.push(url);if(url.includes('www.cricket.com.au'))return{ok:true,text:async()=>"FIXTURES_DATA = JSON.parse('[]')"};if(index===failPage)throw Error('Results unavailable');return{ok:true,json:async()=>({fixtures:pages[index++]||[]})};},{discovery:false}).find(s=>s.id==='cricket-ca-current');
 return{events:await source.fetch({now,previous,coverage}),calls};
}
(async()=>{
 const result=await run();assert.equal(result.calls.length,3);assert.equal(result.events.length,15);assert(result.events.every(f=>f.status==='completed'&&f.scoreDisplay));assert.deepEqual(result.events.coverage.unresolvedRecentFixtureIds,[]);
 const overlap=await run({pages:[sample.pages[0],[sample.pages[0].at(-1),...sample.pages[1]]]});assert.equal(overlap.events.length,15);
 const normal=await run({previous:result.events,coverage:result.events.coverage});assert.equal(normal.calls.length,2);
 const bounded=await run({coverage:{completedCatchupAt:now.toISOString()}});assert.equal(bounded.calls.length,2);assert.equal(bounded.events.coverage.unresolvedRecentFixtureIds.length,2);
 await assert.rejects(()=>run({failPage:1}),/Results unavailable/);
 await assert.rejects(()=>run({pages:[sample.pages[0],sample.pages[0]]}),/duplicate/);
 for(const override of [{isCompleted:false},{resultText:''},{startDateTime:'invalid'},{homeTeam:{id:12,name:'TBC'}}])await assert.rejects(()=>run({pages:[[...sample.pages[0].slice(0,12),{...games[12],...override}]]}));
 const missing={id:'fixture:cricket:CA:999999',status:'live',startTimeUtc:'2026-09-19T00:00:00Z'};
 const many=Array.from({length:7},(_,page)=>Array.from({length:13},(_,i)=>({...games[0],id:100000+page*13+i,startDateTime:'2026-09-18T00:00:00Z',endDateTime:'2026-09-18T04:00:00Z'})));
 const cap=await run({previous:[missing],pages:many});assert.equal(cap.calls.length,7);assert.equal(cap.events.coverage.completedResultsPages,6);assert.deepEqual(cap.events.coverage.unresolvedRecentFixtureIds,[missing.id]);assert(!cap.events.some(f=>f.id===missing.id));
 const {mergeFixtureSnapshot}=require('../lib/fixture-snapshot');assert.equal(mergeFixtureSnapshot([missing],cap.events).events.find(f=>f.id===missing.id).status,'live');
 console.log('Cricket current results: disappeared fixtures recovered, exact identity, ordinary/catch-up budgets, partial-page rejection, malformed facts and unresolved preservation passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
