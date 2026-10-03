'use strict';
const assert=require('node:assert/strict');
const COMPETITION='competition:nrlw-premiership-2026';
// Reviewed provider identities are deliberately separate from men's teams.
const TEAMS=Object.freeze({500470:'broncos',500904:'bulldogs',500787:'cowboys',500471:'dragons',500692:'eels',500691:'knights',500785:'raiders',500469:'roosters',500786:'sharks',500690:'titans',500472:'warriors',500788:'wests-tigers'});
const observation=value=>typeof value==='string'&&/^2026-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value&&Date.parse(value)<=Date.now();
function validateSeasonReview(review){
 assert.equal(review.schemaVersion,'nrlw-season-review.v1');assert.equal(review.competitionId,COMPETITION);assert.equal(review.providerCompetitionId,161);assert.equal(review.season,2026);assert.equal(review.reviewKind,'dated-official-draw-backfill');assert(observation(review.checkedAt));
 assert.equal(review.participants.length,12);assert.equal(new Set(review.participants.map(p=>p.providerTeamId)).size,12);
 for(const p of review.participants)assert(TEAMS[p.providerTeamId]&&p.id===`team:nrlw:${TEAMS[p.providerTeamId]}`&&p.displayName&&p.providerName,'unreviewed provider identity');
 assert.deepEqual(Object.keys(review.sources).map(Number).sort((a,b)=>a-b),Array.from({length:14},(_,i)=>i+1));
 for(let round=1;round<=14;round++){const source=review.sources[round];assert.equal(source.round,round);assert.equal(source.status,200);assert.equal(source.url,`https://www.nrl.com/draw/?competition=161&season=2026&round=${round}`);assert(observation(source.checkedAt)&&/^[a-f0-9]{64}$/.test(source.sha256),'invalid official draw receipt');}
 assert.equal(review.checkedAt,Object.values(review.sources).map(s=>s.checkedAt).sort().at(-1));
 assert.equal(review.fixtures.length,71);assert.equal(new Set(review.fixtures.map(f=>f.id)).size,71);assert.equal(new Set(review.fixtures.map(f=>f.sourceUrl)).size,71);
 const pairs=new Set(),appearances=new Map(),regularTeams=new Map();
 for(const f of review.fixtures){
  assert(Number.isInteger(f.roundNumber)&&f.roundNumber>=1&&f.roundNumber<=14);const round=f.roundNumber,source=review.sources[round];assert.equal(f.sourceCheckedAt,source.checkedAt);
  assert(Array.isArray(f.providerTeamIds)&&f.providerTeamIds.length===2&&f.providerTeamIds[0]!==f.providerTeamIds[1]);assert.deepEqual(f.participantIds,f.providerTeamIds.map(id=>{assert(TEAMS[id],'unknown provider team');return `team:nrlw:${TEAMS[id]}`;}));
  const expectedRound=round<=11?`Round ${round}`:round===14?'Grand Final':`Finals Week ${round-11}`;assert.equal(f.roundLabel,expectedRound);
  const segment=round<=11?`round-${round}`:round===14?'grand-final':`finals-week-${round-11}`;
  const pair=f.providerTeamIds.map(id=>TEAMS[id]).join('-v-');assert.equal(f.sourceUrl,`https://www.nrl.com/draw/womens-premiership/2026/${segment}/${round===14?'game-1':pair}/`);
  assert(/^2026-\d\d-\d\dT\d\d:\d\d:\d\d\.000Z$/.test(f.startTimeUtc)&&Number.isFinite(Date.parse(f.startTimeUtc))&&new Date(f.startTimeUtc).toISOString()===f.startTimeUtc,'invalid exact kickoff');
  const instant=new Date(f.startTimeUtc);assert.equal(f.date,new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(instant));assert.equal(f.time,new Intl.DateTimeFormat('en-GB',{timeZone:'Australia/Sydney',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(instant));assert(typeof f.venue==='string'&&f.venue&&typeof f.venueCity==='string'&&f.venueCity);
  const complete=f.providerStatus==='FullTime';assert(complete?f.providerMode==='Post':f.providerStatus==='Upcoming'&&f.providerMode==='Pre','unsupported match state');
  if(complete){assert([f.homeScore,f.awayScore].every(n=>Number.isInteger(n)&&n>=0),'invalid full-time score');assert(Date.parse(f.startTimeUtc)<Date.parse(f.sourceCheckedAt));}else{assert(!Object.hasOwn(f,'homeScore')&&!Object.hasOwn(f,'awayScore'),'upcoming fixture cannot invent a score');assert(Date.parse(f.startTimeUtc)>Date.parse(f.sourceCheckedAt));}
  assert.equal(complete,round!==14,'dated season collection has an unexpected result boundary');
  if(round<=11){assert.equal(f.id,`event:nrlw:2026:round-${round}-${f.providerTeamIds.map(id=>TEAMS[id]).join('-')}`);const key=[...f.participantIds].sort().join('|');assert(!pairs.has(key),'duplicated regular-season pairing');pairs.add(key);for(const id of f.participantIds){appearances.set(id,(appearances.get(id)||0)+1);const roundKey=`${round}|${id}`;assert(!regularTeams.has(roundKey),'club appears twice in a round');regularTeams.set(roundKey,true);}}
 }
 for(let round=1;round<=14;round++)assert.equal(review.fixtures.filter(f=>f.roundNumber===round).length,round<=11?6:round===14?1:2);
 assert.equal(pairs.size,66);assert.equal(appearances.size,12);assert([...appearances.values()].every(n=>n===11),'club season is incomplete');
 assert.equal(review.addedFixtureIds.length,60);assert.equal(review.preservedFixtureIds.length,11);
 assert.deepEqual([...review.addedFixtureIds].sort(),review.fixtures.filter(f=>f.roundNumber<=10).map(f=>f.id).sort());assert.deepEqual([...review.preservedFixtureIds].sort(),review.fixtures.filter(f=>f.roundNumber>=11).map(f=>f.id).sort());
 return review;
}
function validateSeasonBackfill(review,schedule){
 validateSeasonReview(review);const all=schedule.events.filter(e=>e.sportKey==='nrlw'),added=new Set(review.addedFixtureIds),marked=all.filter(e=>e.nrlwSeasonBackfill);
 assert.equal(all.length,71);assert.equal(marked.length,60);assert.deepEqual(all.map(e=>e.id).sort(),review.fixtures.map(f=>f.id).sort());
 const names=new Map(review.participants.map(p=>[p.id,p.displayName]));
 for(const f of review.fixtures){const e=all.find(e=>e.id===f.id);assert.equal(e.competitionId,COMPETITION);for(const k of ['startTimeUtc','date','time','venue'])assert.equal(e[k],f[k]);assert.deepEqual(e.participantIds,f.participantIds);
  if(!added.has(e.id))continue;
  assert(e.nrlwSeasonBackfill===true&&e.status==='completed'&&e.providerStatus==='FullTime'&&e.timePrecision==='exact'&&e.timeTbc===false);assert.equal(e.roundNumber,f.roundNumber);assert.equal(e.roundLabel,f.roundLabel);assert.equal(e.sourceCheckedAt,f.sourceCheckedAt);
  const source=schedule.sources[e.sourceId];assert.equal(source.type,'official');assert.equal(source.url,f.sourceUrl);assert.equal(source.sourceDocumentUrl,review.sources[f.roundNumber].url);assert.equal(source.checkedAt,f.sourceCheckedAt);
  assert.equal(e.homeScore,f.homeScore);assert.equal(e.awayScore,f.awayScore);assert.equal(e.result.status,'official');assert.equal(e.result.sourceId,e.sourceId);assert.equal(e.result.checkedAt,f.sourceCheckedAt);assert.equal(e.result.score,`${names.get(f.participantIds[0])} ${f.homeScore}-${f.awayScore} ${names.get(f.participantIds[1])}`);
  assert.equal(e.result.winnerParticipantId,f.homeScore===f.awayScore?null:f.participantIds[f.homeScore>f.awayScore?0:1]);
 }
}
module.exports={validateSeasonReview,validateSeasonBackfill};
