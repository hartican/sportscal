#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),follow=require('../config/follow-first');
for(const folder of ['code-inspector','follow-schedule']){
 const fixtures=require(`../data/${folder}/football.json`).fixtures;
 for (const [competitionId, count, slug] of [
  ['competition:premier-league-2026-27',380,'premier-league'],
  ['competition:uefa-champions-league',144,'uefa-champions-league'],
  ['competition:uefa-europa-league',144,'uefa-europa-league'],
 ]) {
  const competition=fixtures.filter(f=>f.competitionId===competitionId);
  assert.equal(competition.length,count);
  assert(competition.some(f=>f.status==='completed'));
  for(const fixture of competition){
   const options=follow.viewingOptions(fixture);
   assert.equal(options.length,1,`${fixture.id}: do not invent another Australian provider`);
   const option=options[0];
   assert.equal(option.providerId,'stan');
   assert.equal(option.webUrl,`https://www.stan.com.au/watch/sport/football/${slug}`);
   assert.equal(option.territory,'AU');assert.equal(option.paid,true);
   assert.equal(option.accessType,'subscription');
   assert.equal(option.linkScope,'sport');
   assert.equal(option.permalinkVerifiedAt,null);
   assert.equal(option.replayVerified,false,'public live listings do not prove replay playback');
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
console.log('Football viewing: all 668 EPL/UCL/Europa provider destinations avoid unsupported replay guarantees; sourced Socceroos fixture exceptions and provenance preserved.');
