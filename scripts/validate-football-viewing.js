#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),follow=require('../config/follow-first');
for(const folder of ['code-inspector','follow-schedule']){
 const fixtures=require(`../data/${folder}/football.json`).fixtures;
 const epl=fixtures.filter(f=>f.competitionId==='competition:premier-league-2026-27');
 assert.equal(epl.length,380);
 assert(epl.some(f=>f.status==='completed'));
 for(const fixture of epl){
  const stan=follow.viewingOptions(fixture).find(o=>o.providerId==='stan');
  assert(stan,`${folder}: EPL retains its Australian provider`);
  assert.equal(stan.linkScope,'sport');
  assert.equal(stan.replayVerified,false,`${fixture.id}: competition rights cannot verify a fixture replay`);
  assert.equal(stan.permalinkVerifiedAt,null);
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
console.log('Football viewing: all 380 EPL provider destinations avoid unsupported replay guarantees; sourced Socceroos fixture exceptions and provenance preserved.');
