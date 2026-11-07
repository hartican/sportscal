#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),follow=require('../config/follow-first');
const programmes=require('../lib/stan-football-recaps'),catalogue=require('../data/coverage/stan-football-programmes.v1.json');
const provider=require('../data/providers/openligadb/football-2026-27.json');
const {assertResultAdmission}=require('./lib/openligadb-football');
let checked=0,omitted=0;
for(const folder of ['code-inspector','follow-schedule']){
 const document=require(`../data/${folder}/football.json`),fixtures=document.fixtures;
 for (const [competitionId, count, slug] of [
  ['competition:premier-league-2026-27',380,'premier-league'],
  ['competition:uefa-champions-league',144,'uefa-champions-league'],
  ['competition:uefa-europa-league',144,'uefa-europa-league'],
 ]) {
  const competition=fixtures.filter(f=>f.competitionId===competitionId);
  const league=provider.leagues.find(row=>row.competitionId===competitionId);
  if(league){
   assertResultAdmission(league); // Every raw fixture needs an accepted or evidenced isolated disposition.
   const missing=(league.resultIsolation?.repairs||[]).filter(row=>row.disposition==='omitted');
   assert.equal(competition.length+missing.length,count,'All 144 raw fixtures remain accounted for');
   assert.deepEqual(competition.map(row=>row.id).sort(),league.fixtures.map(row=>`fixture:football:openligadb:${competitionId.replace('competition:','')}:${row.providerFixtureId}`).sort(),'Every accepted fixture keeps its viewing destination');
   if(missing.length&&folder==='code-inspector'){
    const rows=document.standings.filter(row=>row.competitionId===competitionId);
    assert(rows.length>0&&rows.every(row=>row.partial===true&&row.provisional===true&&row.omittedFixtureCount===missing.length&&/Partial/.test(row.tableNote)&&/explicitly omitted/.test(row.tableNote)),'Quarantined results must remain visibly disclosed');
   }
   if(folder==='code-inspector')omitted+=missing.length;
  }else assert.equal(competition.length,count);
  assert(competition.some(f=>f.status==='completed'));
  if(folder==='code-inspector')checked+=competition.length;
  for(const fixture of competition){
   const options=follow.viewingOptions(fixture);
   assert.equal(options.length,1,`${fixture.id}: do not invent another Australian provider`);
   const option=options[0];
   assert.equal(option.providerId,'stan');
   const programme=programmes.select(fixture,catalogue);
   assert.equal(option.webUrl,programme?programme.programUrl:`https://www.stan.com.au/watch/sport/football/${slug}`);
   assert.equal(option.territory,'AU');assert.equal(option.paid,true);
   assert.equal(option.accessType,'subscription');
   if(programme){
    assert.equal(option.linkScope,'fixture');
    assert.equal(option.sourceUrl,programme.feedUrl);
    assert.equal(option.permalinkVerifiedAt,programme.observedAt);
    assert.equal(option.verifiedAt,programme.observedAt);
    assert.equal(option.replayVerified,true,'only the reviewed, currently bound programme establishes replay');
    assert.equal(option.liveOrReplay,'replay');
   }else{
    assert.equal(option.linkScope,'sport');
    assert.equal(option.permalinkVerifiedAt,null);
    assert.equal(option.replayVerified,false,'public live listings do not prove replay playback');
   }
  }
 }

 const first=fixtures.find(f=>f.id==='football-australia-brazil-2026-09-25');
 const second=fixtures.find(f=>f.id==='football-australia-brazil-2026-09-29');
 const options=follow.viewingOptions(first);
 assert.deepEqual(options.map(o=>o.providerId),['ten','paramount'],`${folder}: preserve fixture-specific free TV`);
 const free=options.find(o=>o.providerId==='ten');
 assert.equal(free.linkScope,'sport','fixture rights are not a verified match permalink');
 assert.equal(free.permalinkVerifiedAt,null);assert.equal(free.replayVerified,false,'past live rights do not prove replay availability');
 assert.equal(free.paid,false);assert.equal(free.territory,'AU');assert.equal(free.webUrl,'https://10.com.au/');
 assert.equal(free.sourceUrl,'https://socceroos.com.au/news/how-watch-australia-vs-brazil-international-friendlies-2026');
 assert.deepEqual(follow.viewingOptions(second).map(o=>o.providerId),['paramount'],'do not grant free coverage to the second fixture');
 assert.deepEqual(follow.viewingOptions({...second,viewingOptions:[],broadcaster:''}).map(o=>o.providerId),['paramount'],'national-team fallback must not inherit a fixture exception');
}
console.log(`Football viewing: all ${checked} accepted EPL/UCL/Europa destinations checked; ${omitted} evidenced source omissions remain explicitly disclosed. Socceroos exceptions and source dates preserved.`);
