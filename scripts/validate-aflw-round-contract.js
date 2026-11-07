'use strict';
// Historical round9 is a real capture. All round11/12 results below are owned
// stand-ins, not observations or repairs for the ten still missing results.
const assert=require('node:assert/strict');
const captured=require('./fixtures/aflw-round9-captured-20261011.json');
const {scope,roundRows,finalFacts}=require('./lib/aflw-round-contract');
const now=new Date('2026-10-31T01:00:00.000Z'),observedAt=now.toISOString();
const {round}=require('./fixtures/aflw-owned-round');
const cases=[];
function check(name,operation){operation();cases.push(name);}
check('historical round9 cannot stand in for the missing current rounds',()=>assert.throws(()=>roundRows(captured,11),/identity contract/));
check('two complete retained rounds bind18identities and only ten result targets',()=>{const rows=[...roundRows(round(11),11),...roundRows(round(12),12)];assert.equal(rows.length,18);const values=rows.map(({match,binding})=>finalFacts(match,binding,{observedAt,now}));assert.equal(values.filter(row=>!row.deferred).length,10);assert.equal(values.filter(row=>row.deferred).length,8);assert(values.filter(row=>!row.deferred).every(row=>row.homeScore===0&&row.awayScore===0),'genuine zero-score draws cannot disappear');});
for(const [name,edit]of[
 ['missing row',payload=>payload.matches.pop()],['duplicate row',payload=>payload.matches[8]=payload.matches[0]],['unknown fixture',payload=>payload.matches[0].providerId='CD_M20262641199'],['wrong internal match ID',payload=>payload.matches[0].id++],['wrong season',payload=>payload.matches[0].compSeason.id=95],['wrong season provider',payload=>payload.matches[0].compSeason.providerId='CD_S2026265'],['wrong round',payload=>payload.matches[0].round.roundNumber=12],['swapped ordered sides',payload=>{const row=payload.matches[0];[row.home,row.away]=[row.away,row.home];}],['wrong team type',payload=>payload.matches[0].home.team.teamType='MEN'],['second page',payload=>payload.meta.pagination.numPages=2],['partial count',payload=>payload.meta.pagination.numEntries=8],['wrong page size',payload=>payload.meta.pagination.pageSize=9]
])check(name+' rejects the complete round before result admission',()=>{const payload=round(11);edit(payload);assert.throws(()=>roundRows(payload,11),/identity contract/);});
for(const [name,edit]of[
 ['missing total',row=>row.home.score.totalScore=null],['coerced total',row=>row.home.score.totalScore='0'],['negative score',row=>row.home.score.totalScore=-1],['fractional goals',row=>row.home.score.goals=0.5],['inconsistent goal/behind total',row=>row.home.score.totalScore=1],['unexplained super goal',row=>row.home.score.superGoals=1],['no explicit final',row=>row.status='LIVE'],['unreviewed final label',row=>row.status='FINAL']
])check(name+' defers only that known result',()=>{const rows=roundRows(round(11),11);edit(rows[0].match);assert(finalFacts(rows[0].match,rows[0].binding,{observedAt,now}).deferred);assert.equal(rows.slice(1).filter(row=>!finalFacts(row.match,row.binding,{observedAt,now}).deferred).length,8);});
check('future official final cannot hide behind missing score fields',()=>{const row=roundRows(round(11),11)[0];row.match.utcStartTime='2026-11-01T00:00:00.000Z';row.match.home.score.totalScore=null;assert.throws(()=>finalFacts(row.match,row.binding,{observedAt,now}),/sporting start/);});
check('unreviewed selected start correction is not guessed',()=>{const row=roundRows(round(11),11)[0];row.match.utcStartTime='2026-10-23T08:16:00.000Z';assert.throws(()=>finalFacts(row.match,row.binding,{observedAt,now}),/start differs/);});
check('invalid or future receipt cannot date a result',()=>{const row=roundRows(round(11),11)[0];for(const stamp of ['2026-02-31T00:00:00.000Z','2026-11-01T00:00:00.000Z'])assert.throws(()=>finalFacts(row.match,row.binding,{observedAt:stamp,now}),/source receipt/);});
check('future known final aliases cannot conceal a sporting contradiction',()=>{for(const status of ['FINAL','COMPLETED']){const row=roundRows(round(11),11)[0];row.match.status=status;row.match.utcStartTime='2026-11-01T00:00:00.000Z';row.match.home.score=null;assert.throws(()=>finalFacts(row.match,row.binding,{observedAt,now}),/sporting start/);}});
console.log(JSON.stringify({status:'PASS',controls:cases.length,externalRequests:0,currentResultsObserved:0,sourceReady:false,cases},null,2));
