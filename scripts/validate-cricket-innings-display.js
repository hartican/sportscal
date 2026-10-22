'use strict';
const assert=require('node:assert/strict');
const raw=require('./fixtures/cricket-gqeberha-innings-20261022.json');
const detail=require('../lib/cricket-scorecard'),model=require('../config/match-centre'),ui=require('../config/score-details'),summary=require('../config/cricket-innings'),parse=require('../lib/source-coverage').parseCricketFixtures,identity=require('../config/fixture-identity');
const checkedAt='2026-10-21T17:00:00.000Z',expected=['Nic Maddinson','Travis Head','Marnus Labuschagne','Matt Renshaw','Beau Webster','Scott Boland'],yet=['Steve Smith','Alex Carey','Pat Cummins','Mitchell Starc','Josh Hazlewood'];
function normalize(source=raw){return detail.normalize(source,{fixtureId:39991,checkedAt});}
function event(source=raw){const c=normalize(source);return {...parse([{...c.fixture,innings:c.innings}],{sourceUrl:detail.url(39991),checkedAt})[0],status:'stumps',cricketPhaseConfirmed:true,scoreCheckedAt:checkedAt,statusCheckedAt:checkedAt};}
const before=JSON.stringify(raw),card=normalize(),e=event(),i=card.innings[2];
assert.deepEqual(i.batting.slice(0,6).map(b=>b.name),expected,'Selected innings must use its own batting order, including the changed nightwatchman position');
assert.deepEqual(i.batting.slice(0,6).map(b=>b.runs),[8,87,39,11,8,2]);
assert.deepEqual(i.batting.filter(b=>b.notOut).map(b=>b.name),['Travis Head','Scott Boland'],'Not-out players stay in their actual positions');
assert.deepEqual(ui.battingGroups(i.batting).groups,[{label:'Yet to bat',rows:i.batting.filter(b=>b.didNotBat)}]);
assert.deepEqual(ui.battingGroups(i.batting).groups[0].rows.map(b=>b.name),yet);
for(const [index,inning] of card.innings.entries())for(const source of raw.fixture.innings[index].batsmen){
 const row=inning.batting.find(b=>b.playerId===source.playerId);for(const [output,input] of [['runs','runsScored'],['balls','ballsFaced'],['fours','foursScored'],['sixes','sixesScored'],['strikeRate','strikeRate']])assert.equal(row[output],source[input]??null);
 assert.equal(row.dismissal,source.dismissalText||source.dismissalTypeId||null);assert.equal(row.dismissalType,source.dismissalTypeId||null);
}
assert.equal(i.runsScored,156);assert.equal(i.numberOfWicketsFallen,4);assert.equal(i.oversBowled,'54');assert.equal(i.extras.total,1);assert(i.isFollowOn);
assert.equal(card.balance,raw.fixture.resultText);assert.equal(i.batting.find(b=>b.name==='Steve Smith').balls,null,'An unavailable source value stays missing');
const compact=model.compact(e),compactRows=compact.score.innings[2].batting;
for(const row of i.batting){const actual=compactRows.find(b=>b.playerId===row.playerId);for(const field of ['battingOrder','sourceOrder','isBatting','dismissalType','dismissal','notOut','didNotBat','runs','balls','fours','sixes','strikeRate'])assert.deepEqual(actual[field],row[field],field);}
assert.deepEqual([...ui.inningsTitles(e.innings).values()],['South Africa — 1st innings','Australia — 1st innings','Australia — 2nd innings · following on']);
assert.deepEqual([...ui.inningsTitles(compact.score.innings).values()],[...ui.inningsTitles(e.innings).values()],'Feed and Match Centre use identical labels');
assert.deepEqual(summary.cricketInnings(e).rows.map(r=>r.inningsLabel),['South Africa — 1st innings','Australia — 1st innings','Australia — 2nd innings']);
const normal=structuredClone(e);normal.innings[2].participantId=normal.innings[0].participantId;normal.innings[2].team='South Africa Men';normal.innings[2].isFollowOn=false;normal.innings.push({...normal.innings[1],inningNumber:4});
assert.deepEqual([...ui.inningsTitles(normal.innings).values()],['South Africa — 1st innings','Australia — 1st innings','South Africa — 2nd innings','Australia — 2nd innings']);
assert.equal(ui.inningsTitles([...e.innings].reverse()).get(e.innings[2]),'Australia — 2nd innings · following on','Labels use chronology, not array or odd/even order');
const women=structuredClone(e);for(const inning of women.innings)inning.team=inning.team.replace('Men','Women');assert.equal(ui.inningsTitles(women.innings).get(women.innings[2]),'Australia Women — 2nd innings · following on');
assert.equal(ui.inningsTitles([e.innings[2]]).get(e.innings[2]),'Australia — innings · following on','A missing earlier identity/timeline cannot establish a team ordinal');
for(const format of ['ODI','T20']){const limited=structuredClone(raw);limited.fixture.gameType=format;limited.fixture.innings=limited.fixture.innings.slice(0,2);assert.deepEqual(normalize(limited).innings.map(i=>i.runsScored),[425,99]);}
const shuffled=structuredClone(raw);shuffled.players.reverse();shuffled.fixture.innings[2].batsmen.reverse();const shuffledRows=normalize(shuffled).innings[2].batting;
assert.deepEqual(ui.battingGroups(shuffledRows).batting.map(b=>b.name),expected);assert.deepEqual(ui.battingGroups(shuffledRows).groups[0].rows.map(b=>b.name),[...yet].reverse(),'Yet-to-bat source sequence is not a predicted batting order');
const missing=structuredClone(raw);for(const b of missing.fixture.innings[2].batsmen)delete b.battingOrder;assert.deepEqual(normalize(missing).innings[2].batting.map(b=>b.playerId),missing.fixture.innings[2].batsmen.map(b=>b.playerId),'Missing metadata keeps this innings source sequence');
const mixed=structuredClone(raw);mixed.fixture.innings[2].batsmen[0].battingOrder=0;mixed.fixture.innings[2].batsmen[1].battingOrder=3;
const mixedRows=normalize(mixed).innings[2].batting;assert.equal(mixedRows.find(b=>b.name==='Nic Maddinson').battingOrder,null);assert.equal(mixedRows.find(b=>b.name==='Travis Head').battingOrder,null);assert.equal(mixedRows.find(b=>b.name==='Marnus Labuschagne').battingOrder,null);assert.deepEqual(ui.battingGroups(mixedRows).batting.map(b=>b.name),['Matt Renshaw','Beau Webster','Scott Boland','Nic Maddinson','Travis Head','Marnus Labuschagne']);
const omitted=structuredClone(raw);omitted.fixture.innings[2].batsmen=omitted.fixture.innings[2].batsmen.filter(b=>!b.playerId.endsWith('steve-smith'));const unknown=normalize(omitted).innings[2].batting.find(b=>b.name==='Steve Smith');assert.equal(unknown.didNotBat,false);assert.equal(unknown.dismissal,null);assert.equal(unknown.notOut,false);
for(const [status,group] of [['AbsentHurt','Absent hurt'],['absent hurt','Absent hurt'],['DidNotBat','Did not bat']]){
 const source=structuredClone(raw),b=source.fixture.innings[2].batsmen.find(b=>b.playerId.endsWith('steve-smith'));b.dismissalTypeId=b.dismissalText=status;const rows=normalize(source).innings[2].batting;assert.equal(rows.find(b=>b.name==='Steve Smith').notOut,false);assert.equal(ui.battingGroups(rows).groups.find(g=>g.label===group).rows[0].name,'Steve Smith');
}
for(const status of ['retired hurt','RetiredOut']){
 const source=structuredClone(raw),b=source.fixture.innings[2].batsmen[1];b.dismissalTypeId=b.dismissalText=status;b.isBatting=false;b.isOut=status==='RetiredOut';const groups=ui.battingGroups(normalize(source).innings[2].batting);assert.equal(groups.batting[1].name,'Travis Head');assert.equal(groups.batting[1].dismissal,status);
}
const zero=ui.battingGroups([{name:'At the crease',runs:0,balls:0,isBatting:true},{name:'No statistics',runs:null,balls:null},{name:'Explicit pending',runs:0,balls:0,dismissal:'yet to bat'}]);assert.deepEqual(zero.batting.map(b=>b.name),['At the crease','No statistics']);assert.equal(zero.groups[0].rows[0].name,'Explicit pending');
for(const corrupt of ['duplicate','unknown','wrong-team','missing-array','contradictory-total']){
 const source=structuredClone(raw),current=source.fixture.innings[2];if(corrupt==='duplicate')current.batsmen.push({...current.batsmen[0]});if(corrupt==='unknown')current.batsmen[0].playerId='unknown';if(corrupt==='wrong-team')current.batsmen[0].playerId=source.fixture.innings[0].batsmen[0].playerId;if(corrupt==='missing-array')delete current.batsmen;if(corrupt==='contradictory-total')current.runsScored++;assert.throws(()=>normalize(source),/official|innings/i,corrupt);
}
const older={...compact,scoreCheckedAt:'2026-10-21T16:00:00Z',statusCheckedAt:'2026-10-21T16:00:00Z',checkedAt:'2026-10-21T16:00:00Z',score:{innings:[compact.score.innings[1]]}};assert.deepEqual(model.observation(compact,older).score,compact.score,'An older response cannot replace or mix the innings');
const partial={...e,scoreCheckedAt:'2026-10-21T17:01:00Z',innings:e.innings.map(({batting,bowling,extras,detailCheckedAt,detailSourceUrl,...i})=>i)};const retained=identity.mergeOverlays([e],[partial])[0];assert.deepEqual(retained.innings.map(i=>i.batting),e.innings.map(i=>i.batting),'Partial refresh retains each matching innings as a complete detail unit');
const split=require('../lib/compact-fixture-observations').split([e],{now:new Date(checkedAt),observedFixtures:[e]});assert.deepEqual(split.scores[0].innings[2].batting,i.batting,'Existing JSON score storage preserves metadata without a schema change');
assert.equal(JSON.stringify(raw),before,'Normalisation and rendering projection never mutate source facts');
console.log('Cricket innings display: historical order/figures, normal/follow-on labels, explicit statuses, source/legacy fallbacks, compact/store metadata, identity guards and older/partial response retention passed.');
module.exports={raw,card,event,normalize,checkedAt,expected,yet};
