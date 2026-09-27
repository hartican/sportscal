'use strict';
const assert=require('node:assert/strict');const {deriveStandings}=require('./lib/european-football-standings');
const published=require('../data/providers/openligadb/football-2026-27.json');
for(const league of published.leagues){
 const rows=deriveStandings(league);assert.equal(rows.length,36);assert.equal(new Set(rows.map(r=>r.participantId)).size,36);
 assert.deepEqual(published.standings.filter(r=>r.competitionId===league.competitionId),rows,'published table matches retained source facts');
 const completed=league.fixtures.filter(f=>f.status==='completed');
 assert.equal(rows.reduce((n,r)=>n+r.played,0),completed.length*2);
 assert.equal(rows.reduce((n,r)=>n+r.pointsFor,0),rows.reduce((n,r)=>n+r.pointsAgainst,0));
 assert(rows.every(r=>r.played===r.won+r.drawn+r.lost&&r.ladderPoints===r.won*3+r.drawn));
 assert.deepEqual(deriveStandings({...league,fixtures:[...league.fixtures].reverse(),teams:[...league.teams].reverse()}),rows,'provider order does not change ranking');
 const pending=structuredClone(league);pending.fixtures.forEach(f=>{f.status='unknown';f.result=null;});assert(deriveStandings(pending).every(r=>r.played===0&&r.rank===1&&r.sharedRank),'elapsed matches do not fabricate points');
 const finals=structuredClone(league);finals.fixtures.forEach(f=>{f.status='completed';f.result={homeScore:0,awayScore:0};});assert(deriveStandings(finals).every(r=>r.rankPending&&r.rank===null),'discipline/coefficient ties cannot invent final positions');
 const bad=structuredClone(league);bad.fixtures[0].status='completed';bad.fixtures[0].result=null;assert.throws(()=>deriveStandings(bad),/scores/);
}
const sample={competitionId:'test',competitionName:'Test',season:'2026/27',checkedAt:'2026-09-27T00:00:00Z',source:{url:'https://example.test'},teams:['A','B','C','D'].map(name=>({participantId:name,name})),fixtures:[{participants:[{participantId:'A'},{participantId:'C'}],status:'completed',result:{homeScore:2,awayScore:0}},{participants:[{participantId:'D'},{participantId:'B'}],status:'completed',result:{homeScore:0,awayScore:2}}]};
const rows=deriveStandings(sample);assert.equal(rows[0].participantId,'B','away goals separate otherwise equal winning totals');assert.equal(rows[1].participantId,'A');
console.log('European standings: 72 identities, points and goal balance, deterministic ordering, away-goal tie-break, unknown results and unresolved final ties passed.');
