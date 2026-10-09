#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),m=require('../lib/mlb-postseason'),receipt=require('./fixtures/mlb-alds-20261006.json');
const options={checkedAt:receipt.checkedAt,now:new Date(receipt.checkedAt)},fixtures=m.parse(receipt.payload,options).fixtures;
const game=fixtures.find(f=>f.id==='fixture:mlb:849839');
assert.equal(game.time,'11:00');assert.equal(game.status,'completed');assert.equal(game.homeScore,5);assert.equal(game.awayScore,2);assert.deepEqual(game.participantIds,['team:mlb:139','team:mlb:147']);assert(!game.selectedSentence.includes('5–2'));
const copy=()=>structuredClone(receipt.payload),games=d=>d.dates.flatMap(d=>d.games);
for(const mutate of [d=>d.totalGames++,d=>games(d)[0].teams.home.score=null,d=>games(d)[0].status.statusCode='unknown',d=>games(d)[1].gamePk=games(d)[0].gamePk]){const d=copy();mutate(d);assert.throws(()=>m.parse(d,options));}
assert.throws(()=>m.parse(receipt.payload,{...options,now:new Date(+options.now+7*3600000)}));
const zeros=copy();games(zeros)[0].teams.home.score=0;assert.equal(m.parse(zeros,options).fixtures[0].homeScore,0);
const regular=copy();games(regular)[0].gameType='R';delete games(regular)[0].description;
const regularGame=m.parse(regular,{...options,universe:true}).fixtures[0];assert.equal(regularGame.competitionName,'MLB regular season');assert.equal(regularGame.roundLabel,'MLB regular season');assert(!require('../config/follow-first').reasonForEvent(regularGame,{selectedSelectorEntityIds:['sport:baseball'],followedSports:['baseball']}),'Everything regular-season coverage does not become broad-sport postseason Feed admission');assert(!m.parse(regular,options).fixtures.some(f=>f.id===regularGame.id),'existing postseason-only import stays scoped');
const conditional=copy();games(conditional)[2].ifNecessary='Y';const c=m.parse(conditional,options).fixtures[2];assert.equal(c.startTimeUtc,null);assert.equal(c.scheduleStatus,'conditional');
assert.deepEqual(m.merge(fixtures,fixtures.map(f=>({...f,sourceCheckedAt:new Date(+options.now+1000).toISOString()}))).filter(f=>f.status==='completed'),fixtures.filter(f=>f.status==='completed'),'unchanged finals retain observation dates');
assert.throws(()=>m.merge([game],[{...game,status:'upcoming'}]));
assert.throws(()=>m.merge([game],[{...game,participantIds:[...game.participantIds].reverse()}]));
const taxonomy=require('../config/selector-taxonomy');assert(taxonomy.nodes?.some(n=>n.id==='sport:baseball')||JSON.stringify(taxonomy).includes('sport:baseball'));
console.log('MLB postseason verified: official ALDS receipt, paired scores including zero, conditional clocks, identity, freshness, failure rejection and immutable final observations.');
