#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),follow=require('../config/follow-first');
for(const folder of ['code-inspector','follow-schedule']){
 const fixtures=require(`../data/${folder}/football.json`).fixtures;
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
console.log('Football viewing: sourced 25 September free option retained, 29 September exclusive unchanged, destination and provenance preserved.');
