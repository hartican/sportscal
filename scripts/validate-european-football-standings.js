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
// Controlled 36-club, 144-match seasons exercise each supported Article 18
// criterion independently. Every club has eight distinct opponents, four home
// and four away matches. These fixtures are synthetic and never persisted.
function finalSeason(reference){
 const teams=Array.from({length:36},(_,i)=>({participantId:`synthetic:${i}`,name:i===0?'Zulu target':i===18?'Alpha target':`Club ${String(i).padStart(2,'0')}`}));
 const fixtures=[];
 for(let home=0;home<36;home++)for(let step=1;step<=4;step++)fixtures.push({
  participants:[{participantId:teams[home].participantId},{participantId:teams[(home+step)%36].participantId}],
  status:'completed',result:{homeScore:0,awayScore:0},
 });
 return {...reference,teams,fixtures};
}
function targetScores(league,id,homeScores,awayScores){
 const home=league.fixtures.filter(f=>f.participants[0].participantId===id);
 const away=league.fixtures.filter(f=>f.participants[1].participantId===id);
 assert.equal(home.length,4);assert.equal(away.length,4);
 homeScores.forEach(([scored,conceded],i)=>{home[i].result={homeScore:scored,awayScore:conceded};});
 awayScores.forEach(([scored,conceded],i)=>{away[i].result={homeScore:conceded,awayScore:scored};});
}
function otherResult(league,home,away,homeScore,awayScore){
 const match=league.fixtures.find(f=>f.participants[0].participantId===`synthetic:${home}`&&f.participants[1].participantId===`synthetic:${away}`);
 assert(match,'the controlled match must exist');match.result={homeScore,awayScore};
}
const cases=[
 ['ladderPoints',l=>targetScores(l,'synthetic:0',[[1,0]],[])],
 ['pointsDifference',l=>{targetScores(l,'synthetic:0',[[2,0]],[]);targetScores(l,'synthetic:18',[[1,0]],[]);}],
 ['pointsFor',l=>{targetScores(l,'synthetic:0',[[2,1]],[]);targetScores(l,'synthetic:18',[[1,0]],[]);}],
 ['awayGoals',l=>{targetScores(l,'synthetic:0',[],[[1,0]]);targetScores(l,'synthetic:18',[[1,0]],[]);}],
 ['won',l=>{
  targetScores(l,'synthetic:0',[[1,0],[1,0],[0,1],[0,1]],Array.from({length:4},()=>[0,1]));
  targetScores(l,'synthetic:18',[[2,0],[0,0],[0,0],[0,0]],[[0,3],[0,1],[0,1],[0,1]]);
 }],
 ['awayWins',l=>{targetScores(l,'synthetic:0',[[1,1]],[[1,0]]);targetScores(l,'synthetic:18',[[1,0]],[[1,1]]);}],
 ['opponentPoints',l=>otherResult(l,1,5,1,0)],
 ['opponentGoalDifference',l=>{otherResult(l,1,5,2,0);otherResult(l,19,23,1,0);}],
 ['opponentGoals',l=>{otherResult(l,1,5,2,1);otherResult(l,19,23,1,0);}],
];
let acceptanceCases=0;
for(const reference of published.leagues){
 for(let index=0;index<cases.length;index++){
  const [criterion,prepare]=cases[index],league=finalSeason(reference);prepare(league);
  const ranked=deriveStandings(league),a=ranked.find(r=>r.participantId==='synthetic:0'),b=ranked.find(r=>r.participantId==='synthetic:18');
  for(const [prior] of cases.slice(0,index))assert.equal(a[prior],b[prior],`${reference.competitionName}: ${criterion} is reached only after ${prior} ties`);
  assert(a[criterion]>b[criterion],`${criterion}: the hand-constructed advantage must exist`);
  assert(a.sortOrder<b.sortOrder,`${reference.competitionName}: ${criterion} overrides opposite alphabetical order; other clubs can still share an unresolved tuple`);
  assert.deepEqual(deriveStandings({...league,fixtures:[...league.fixtures].reverse(),teams:[...league.teams].reverse()}),ranked,'every final criterion ignores source array order');
  if(index>=6){
   // Collective-opponent fields must wait for all 144 finals. The missing match
   // does not involve either target, leaving their six interim criteria tied.
   const partial=structuredClone(league);partial.fixtures.at(-1).status='unknown';partial.fixtures.at(-1).result=null;
   const rows=deriveStandings(partial),x=rows.find(r=>r.participantId==='synthetic:0'),y=rows.find(r=>r.participantId==='synthetic:18');
   assert.equal(x.rank,y.rank);assert(x.sharedRank&&y.sharedRank,'143 finals cannot activate final-round tie-breaks');
  }
  acceptanceCases++;
 }
 const tied=deriveStandings(finalSeason(reference));
 assert(tied.every(r=>r.rankPending&&r.rank===null&&!r.sharedRank&&r.provisional),'unavailable discipline/coefficient cannot manufacture a final order');
 assert(tied.every(r=>r.played===8&&r.drawn===8&&r.opponentPoints===64&&r.opponentGoalDifference===0&&r.opponentGoals===0),'eight opponent contributions are complete and counted once');
}
console.log(`European standings: 72 published identities and ${acceptanceCases} controlled final-order cases passed; 143-final boundary, all-eight-opponent totals and unresolved discipline/coefficient ties stay honest.`);
