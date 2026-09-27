#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {normalizeFixture}=require('./build-code-inspector');
const {cardForFixture}=require('./refresh-premier-league-cards');
const base={id:1,kickoff:{millis:Date.UTC(2026,9,4,14)},gameweek:{gameweek:7},teams:[{team:{id:1,name:'Arsenal',club:{id:1}}},{team:{id:2,name:'Chelsea',club:{id:2}}}]};
const card=cardForFixture(base,'2026-09-27T00:00:00Z');
assert.equal(card.round,'all','stage classification stays valid while matchweek lives in its dedicated fields');
assert.equal(card.roundNumber,7);assert.equal(card.roundLabel,'Premier League Matchweek 7');
assert.equal(card.competitionName,'Premier League');assert.equal(card.season,'2026/27');
const unknown=normalizeFixture({id:'unknown',competitionId:'competition:premier-league-2026-27',round:'all'},'sport:football');
assert.equal(unknown.roundNumber,null,'unknown matchweek must not be inferred from dates');
for(const folder of ['code-inspector','follow-schedule']){
 const data=require(`../data/${folder}/football.json`);
 const fixtures=data.fixtures.filter(f=>f.competitionId==='competition:premier-league-2026-27');
 assert.equal(fixtures.length,380);assert.equal(new Set(fixtures.map(f=>f.id)).size,380);
 assert.equal(new Set(fixtures.map(f=>f.roundNumber)).size,38);
 assert(fixtures.every(f=>f.roundLabel===`Premier League Matchweek ${f.roundNumber}`&&f.competitionName==='Premier League'));
 if(folder!=='code-inspector')continue;
 const epl=data.standings.filter(row=>row.competitionId==='competition:premier-league-2026-27');
 assert.equal(epl.length,20);
 assert(epl.every(row=>row.asOf&&Number.isFinite(row.ladderPoints)), 'EPL table remains dated');
 assert.equal(data.standings.length,92,'only the three reviewed Football tables enter this projection');
}
console.log('Football: 380 stable fixtures, 38 sourced matchweeks, dated 20-club table and unknown-round fallback passed.');
