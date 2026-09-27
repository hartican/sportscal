'use strict';
const assert=require('node:assert/strict');
const {normalizeLeague,resolveLeagueIdentities,COMPETITIONS}=require('./lib/openligadb-football');
const options={league:'ucl',checkedAt:'2026-09-27T12:00:00Z'};
function fixtureSet(league='ucl'){
  return Array.from({length:8},(_,round)=>Array.from({length:18},(_,i)=>{
    const a={teamId:i+1,teamName:`Club ${i+1}`,teamIconUrl:'https://unlicensed.invalid/logo.svg'};
    const b={teamId:19+(i+round)%18,teamName:`Club ${19+(i+round)%18}`};
    return {matchID:round*18+i+1,leagueId:COMPETITIONS[league].leagueId,leagueShortcut:league,leagueSeason:2026,group:{groupOrderID:round+1},
      matchDateTimeUTC:new Date(Date.UTC(2026,9,1+round*7,19)).toISOString(),team1:round%2?a:b,team2:round%2?b:a,matchIsFinished:false,matchResults:[]};
  })).flat();
}
function rejects(mutate,pattern){const input=fixtureSet();mutate(input);assert.throws(()=>normalizeLeague(input,options),pattern);}
for(const league of Object.keys(COMPETITIONS)){
 const input=fixtureSet(league);const normal=normalizeLeague(input,{...options,league});assert.equal(normal.fixtures.length,144);assert.equal(normal.teams.length,36);
 assert.deepEqual(normal,normalizeLeague(input.reverse(),{...options,league}),'provider order does not change normalized facts');
 assert.equal(normal.source.type,'community');assert(!JSON.stringify(normal).includes('teamIconUrl'),'no unlicensed logos propagated');
 assert(normal.fixtures.every(f=>f.result===null&&f.status==='upcoming'));
}
rejects(x=>x.pop(),/144/);rejects(x=>x[1].matchID=x[0].matchID,/duplicate fixture/);
rejects(x=>x[0].leagueSeason=2025,/season/);rejects(x=>x[0].leagueId=6000,/competition/);
rejects(x=>x[0].matchDateTimeUTC='2026-10-01T19:00:00',/UTC kickoff/);
rejects(x=>x[0].matchDateTimeUTC='2026-09-31T19:00:00Z',/UTC kickoff/);
rejects(x=>x[0].team2=x[0].team1,/twice|itself/);
rejects(x=>x[0].matchIsFinished=true,/full-time result/);
rejects(x=>x[0].matchResults=[{resultTypeID:2}],/unfinished fixture/);
rejects(x=>{x[0].matchIsFinished=true;x[0].matchResults=[{resultTypeID:2,resultTypeKind:'After90Minutes',pointsTeam1:1,pointsTeam2:0}];},/future fixture/);
const completed=fixtureSet();Object.assign(completed[0],{matchDateTimeUTC:'2026-09-08T16:45:00Z',matchIsFinished:true,matchResults:[{resultTypeID:1,pointsTeam1:0,pointsTeam2:0},{resultTypeID:2,resultTypeKind:'After90Minutes',pointsTeam1:2,pointsTeam2:3}]});
assert.deepEqual(normalizeLeague(completed,options).fixtures[0].result,{homeScore:2,awayScore:3},'half-time scores never replace full time');
completed[0].matchIsFinished=false;completed[0].matchResults=[];assert.equal(normalizeLeague(completed,options).fixtures[0].status,'unknown','clock alone cannot invent a result or live status');
assert.throws(()=>normalizeLeague(fixtureSet(),{...options,season:2027}),/unreviewed/);
console.log('OpenLigaDB: complete league-phase structure, stable ordering, scope, UTC, club consistency, explicit results, stale-status honesty and image exclusion passed.');

const facts=normalizeLeague(fixtureSet(),options);
const mapping={teams:facts.teams.map(t=>({providerId:t.providerId,participantId:`team:football:test:${t.providerId}`,displayName:t.sourceName,sourceNames:[t.sourceName]}))};
assert.equal(resolveLeagueIdentities(facts,mapping).fixtures[0].participants[0].participantId,'team:football:test:19');
const missing=structuredClone(mapping);missing.teams.pop();assert.throws(()=>resolveLeagueIdentities(facts,missing),/unreviewed club/);
const changed=structuredClone(facts);changed.teams[0].sourceName='Different club';assert.throws(()=>resolveLeagueIdentities(changed,mapping),/unreviewed club/);
const registry=require('../config/football-openligadb-identities.json');
assert.equal(registry.teams.length,72);assert.equal(new Set(registry.teams.map(t=>t.participantId)).size,72);
for(const [provider,id] of [['370','team:football:epl:10'],['2617','team:football:epl:1'],['5707','team:football:club:bod-glimt']])assert.equal(registry.teams.find(t=>t.providerId===provider).participantId,id,'existing follow identities are preserved');
const known=[...require('../data/canonical/football-directory.v1.json').teams,...require('../data/canonical/uefa-champions-league-2026-27.json').participants];
for(const team of registry.teams.filter(t=>t.preservesExistingId))assert(known.some(t=>t.id===team.participantId&&t.displayName===team.displayName));
console.log('Identity map: 72 reviewed clubs, 46 existing identities retained, ambiguous or unreviewed changes rejected.');
