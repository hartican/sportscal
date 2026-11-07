'use strict';
const assert=require('node:assert/strict'),data=require('./lib/milestone-fixtures'),detail=require('../lib/cricket-scorecard'),source=require('../lib/source-coverage');
const {currentCricket}=require('../lib/cricket-current-results'),now=new Date();
(async()=>{
 const ids=[39990,40001,40002],sources=ids.map(id=>data.source({id}));let called=[];
 const fetchImpl=async(url,{signal}={})=>{assert(signal);if(url.includes('/views/scorecard')){const id=Number(new URL(url).searchParams.get('fixtureId'));called.push(id);return{ok:true,json:async()=>sources.find(r=>r.fixture.id===id)};}if(url.includes('/yearfilter'))return{ok:true,json:async()=>({fixtures:[]})};return{ok:true,text:async()=>"FIXTURES_DATA = JSON.parse('"+JSON.stringify(sources.map(r=>({...r.fixture,innings:[]})))+"')"};};
 const run=(previous=[],clock=now,fetch=fetchImpl)=>currentCricket({fetchImpl:fetch,now:clock,previous,parseCricketPage:source.parseCricketPage,parseCricketFixtures:source.parseCricketFixtures});
 const first=await run();assert.equal(called.length,2);assert.deepEqual(called,[39990,40001]);called=[];
 const second=await run(first,new Date(+now+120000));assert.equal(called.length,2);assert.equal(called[0],40002,'The oldest never-checked fixture cannot be starved by a milestone window');
 called=[];await run(second,new Date(+now+120001));assert.equal(called.length,1,'Just-checked fixtures cannot bypass the two-minute minimum');
 const previous=ids.map((id,index)=>data.fixture(+now-(index===0?600000:180000),{id,runs:index===2?95:12}));called=[];await run(previous);assert.deepEqual(called,[39990,40002],'One oldest-check slot and one proximity slot share the two-detail budget');
 called=[];const failed=await run(previous,now,async(url,options)=>{if(url.includes('/views/scorecard')){called.push(Number(new URL(url).searchParams.get('fixtureId')));throw Error('provider offline');}return fetchImpl(url,options);});assert.equal(called.length,2);assert(failed.find(f=>f.id===previous[0].id).innings.at(-1).detailStale);
 const contradictory=data.source();contradictory.fixture.innings.at(-1).runsScored++;assert.throws(()=>detail.normalize(contradictory,{fixtureId:39990,checkedAt:now.toISOString()}),/Contradictory/);
 const chase={...sources[0].fixture,gameType:'ODI',resultText:'Australia need 18 runs to win',oversRemaining:'4.2'},innings=[{inningNumber:2,battingTeamId:chase.homeTeam.id,numberOfWicketsFallen:7}];assert.equal(detail.chase(chase,innings),null,'A winning statement for the other team cannot qualify the batting side');
 assert.equal(detail.chase({...chase,resultText:'USA need 18 runs to win'},innings),null,'A substring of a different team name is not winning-target evidence');
 assert(detail.chase({...chase,resultText:'South Africa Men need 18 runs to win'},innings),'The full source-provided name also binds the winning statement');
 console.log('Milestone source budget: two-detail bound, oldest fairness, proximity slot, minimum cadence, failure retention and contradictory-source suppression passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
