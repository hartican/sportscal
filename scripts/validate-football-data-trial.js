#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {setTimeout:pause}=require('node:timers/promises');
const {normalizeMatches,normalizeStandings,compareFixtures,createClient,trialRecovery}=require('./lib/football-data-trial');
const registry=require('../config/football-data-identities.json');
const checkedAt='2026-10-01T01:00:00.000Z';
function season(){
  const teams=Object.entries(registry.teams).filter(([,t])=>t.participantId.startsWith('team:football:epl:')).map(([id,t])=>({id:Number(id),name:t.sourceName}));
  let cycle=[...teams],matches=[],id=1;
  for(let round=1;round<=19;round++){
    for(let j=0;j<10;j++){
      const [homeTeam,awayTeam]=j%2?[cycle[19-j],cycle[j]]:[cycle[j],cycle[19-j]];
      for(const [matchday,home,away] of [[round,homeTeam,awayTeam],[round+19,awayTeam,homeTeam]])matches.push({id:id++,competition:{id:2021},season:{startDate:'2026-08-21'},stage:'REGULAR_SEASON',matchday,
        utcDate:'2026-08-21T19:00:00Z',lastUpdated:checkedAt,status:'FINISHED',homeTeam:home,awayTeam:away,score:{fullTime:{home:0,away:2}}});
    }
    cycle=[cycle[0],cycle[19],...cycle.slice(1,19)];
  }
  return {competition:{id:2021,code:'PL'},filters:{season:2026},resultSet:{count:380},matches};
}
const options={code:'PL',checkedAt};
test('full season and an actual zero goal score reconcile without changing canonical club IDs',()=>{
  const normalized=normalizeMatches(season(),options);
  assert.equal(normalized.fixtures.length,380);assert.equal(normalized.fixtures[0].result.homeScore,0);
  const comparison=compareFixtures(normalized.fixtures,normalized.fixtures);
  assert.equal(comparison.matched,380);assert.equal(comparison.results.matching,380);assert.equal(comparison.differences.length,0);
});
test('wrong season, incomplete fixtures, reused IDs, changed club name and missing final score fail closed',()=>{
  for(const mutation of [p=>p.filters.season=2025,p=>p.matches.pop(),p=>p.matches[1].id=p.matches[0].id,p=>p.matches[0].homeTeam={...p.matches[0].homeTeam,name:'Unknown Club'},p=>p.matches[0].score.fullTime.home=null,
    p=>p.matches[0].utcDate='2026-02-30T19:00:00Z',p=>p.matches[0].stage='QUALIFICATION']){
    const payload=season();mutation(payload);assert.throws(()=>normalizeMatches(payload,options),/trial rejected/);
  }
});
test('delayed in-play statuses and elapsed kickoffs never manufacture live or final results',()=>{
  const payload=season();payload.matches[0].status='IN_PLAY';
  const normalized=normalizeMatches(payload,options);assert.equal(normalized.fixtures[0].status,'unknown');assert.equal(normalized.fixtures[0].result,null);
  payload.matches[0].status='TIMED';assert.equal(normalizeMatches(payload,options).fixtures[0].status,'unknown');
  payload.matches[0].status='SCHEDULED';assert.equal(normalizeMatches(payload,options).fixtures[0].timePrecision,'date-only');
});
test('fixture comparison exposes kickoff disagreements, missing final results and duplicate pairing',()=>{
  const facts=normalizeMatches(season(),options).fixtures;
  const candidate=structuredClone(facts);candidate[0].startTimeUtc='2026-08-21T20:00:00Z';candidate[1].result=null;
  const report=compareFixtures(facts,candidate);assert.equal(report.differences[0].kind,'kickoff');assert.equal(report.results.referenceOnly,1);
  candidate[1]=candidate[0];assert.throws(()=>compareFixtures(facts,candidate),/ambiguous/);
});
test('credentials go only to the fixed HTTPS origin, redirects are refused and calls are serialized below the free limit',async()=>{
  const calls=[],waits=[];let time=0;
  const token='0'.repeat(32);
  const client=createClient({token,now:()=>time,wait:async ms=>{waits.push(ms);time+=ms;},fetchImpl:async(url,options)=>{
    calls.push({url,options});return {ok:true,status:200,text:async()=>JSON.stringify({ok:true})};
  }});
  await Promise.all([client('PL','matches'),client('CL','standings')]);
  assert.deepEqual(waits,[6500]);assert.equal(calls.length,2);
  assert.equal(new URL(calls[0].url).origin,'https://api.football-data.org');
  assert.equal(calls[0].options.headers['X-Auth-Token'],token);assert.equal(calls[0].options.redirect,'error');
  assert(!JSON.stringify(await client('PL','standings')).includes(token));
  await assert.rejects(client('EL','matches'),/Unreviewed/);assert.equal(calls.length,3);
});
test('429, malformed responses, echoed credentials and deadline failures are bounded and sanitized without retries',async()=>{
  const token='0'.repeat(32);let calls=0;
  const limited=createClient({token,fetchImpl:async()=>{calls++;return {ok:false,status:429};}});
  await assert.rejects(limited('PL','matches'),/HTTP 429/);assert.equal(calls,1);
  for(const fetchImpl of [async()=>({ok:true,status:200,text:async()=>token}),async()=>{throw Error(token);}]){
    const client=createClient({token,fetchImpl});
    await assert.rejects(client('PL','matches'),error=>!error.message.includes(token));
  }
  const timed=createClient({token,timeoutMs:5,fetchImpl:async(_url,{signal})=>{await pause(15);assert.equal(signal.aborted,true);throw Error(token);}});
  await assert.rejects(timed('PL','matches'),/credential withheld/);
});
test('backup recovery retains NS fixture IDs; disagreement, stale evidence and a second outage retain the untouched last-good snapshot',async()=>{
  const backup=normalizeMatches(season(),options);
  const lastGood=structuredClone(backup);lastGood.checkedAt='2026-09-30T00:00:00.000Z';
  lastGood.fixtures.forEach((f,i)=>f.providerFixtureId=`fixture:ns:${i}`);
  const loadPrimary=async()=>{throw Error('Primary unavailable');};
  const now=Date.parse(checkedAt);
  const good=await trialRecovery({loadPrimary,loadBackup:async()=>backup,lastGood,now});
  assert.equal(good.mode,'backup');assert.equal(good.snapshot.fixtures[0].providerFixtureId,'fixture:ns:0');assert.equal(good.snapshot.fixtures[0].backupProviderFixtureId,'1');
  for(const bad of [null,{...backup,checkedAt:'2026-09-29T00:00:00.000Z'},{...backup,competitionId:'wrong'},structuredClone(backup)]){
    if(bad?.fixtures&&bad!==backup&&bad.checkedAt===checkedAt&&bad.competitionId===backup.competitionId)bad.fixtures[0].result.homeScore=9;
    const result=await trialRecovery({loadPrimary,loadBackup:async()=>{if(!bad)throw Error('Backup unavailable');return bad;},lastGood,now});
    assert.equal(result.mode,'last-good');assert.strictEqual(result.snapshot,lastGood);assert.equal(result.snapshot.checkedAt,'2026-09-30T00:00:00.000Z');
  }
  let queried=false;
  const primary=await trialRecovery({loadPrimary:async()=>lastGood,loadBackup:async()=>{queried=true;return backup;},lastGood,now});
  assert.equal(primary.mode,'primary');assert.equal(queried,false);
});
test('table parser requires unique reviewed clubs, integer statistics and internally consistent totals',()=>{
  const teams=Object.entries(registry.teams).filter(([,t])=>t.participantId.startsWith('team:football:epl:'));
  const payload={competition:{id:2021},season:{startDate:'2026-08-21'},standings:[{type:'TOTAL',stage:'REGULAR_SEASON',table:teams.map(([id,t],i)=>({position:i+1,team:{id:Number(id),name:t.sourceName},playedGames:1,won:0,draw:1,lost:0,points:1,goalsFor:0,goalsAgainst:0,goalDifference:0}))}]};
  assert.equal(normalizeStandings(payload,{code:'PL'}).length,20);
  const invalid=structuredClone(payload);invalid.standings[0].table[0].playedGames=2;assert.throws(()=>normalizeStandings(invalid,{code:'PL'}),/statistics/);
  const duplicated=structuredClone(payload);duplicated.standings[0].table[1].team=duplicated.standings[0].table[0].team;assert.throws(()=>normalizeStandings(duplicated,{code:'PL'}),/duplicated/);
});
