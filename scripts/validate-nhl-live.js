#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const facts=require('./lib/nhl-results'),sample=require('./fixtures/nhl-live-20261005.json'),season=require('./fixtures/nhl-results-20261005.json'),current=require('../data/canonical/ice-hockey-directory.v1.json');
const clone=v=>structuredClone(v),at=sample.capturedAt,now=new Date(at),teams=current.teams.filter(t=>t.leagueId==='competition:nhl'),id='fixture:nhl:'+sample.game.id;
const row=facts.fixture(sample.game,{checkedAt:at,now});
assert.equal(row.status,'live');assert.deepEqual(row.participantSlots.map(s=>s.score),[0,0],'the observed 0–0 is a valid paired live score');
assert.equal(row.scoreCheckedAt,at);assert.equal(row.statusCheckedAt,at);assert.equal(row.resultSourceCheckedAt,at);assert.equal(row.resultLabels,undefined,'a live score is not a final qualifier');
for(const observation of sample.clubObservations){const f=facts.fixture(observation.game,{checkedAt:observation.checkedAt,now:new Date(observation.checkedAt)});assert.equal(f.status,'live');assert.deepEqual(f.participantSlots.map(s=>s.score),[1,0]);assert.deepEqual(f.participantSlots.map(s=>s.participantId),row.participantSlots.map(s=>s.participantId));}
let rejected=0;
for(const change of [g=>g.awayTeam.score=null,g=>g.homeTeam.score='',g=>g.homeTeam.score='0',g=>g.homeTeam.score=-1,g=>g.homeTeam.score=1.1,g=>delete g.awayTeam.score,g=>g.gameState='CRIT',g=>g.gameScheduleState='PPD',g=>g.startTimeUTC='2026-10-04T18:00:00Z']){const game=clone(sample.game);change(game);assert.throws(()=>facts.fixture(game,{checkedAt:at,now}),/NHL:/);rejected++;}
assert.throws(()=>facts.fixture(sample.game),/observation/);rejected++;
const routes=facts.resources(now),weeks=clone(season.weeks);for(const day of weeks[0].gameWeek)day.games=day.games.map(g=>g.id===sample.game.id?clone(sample.game):g);
const baseline=clone(current);baseline.fixtures=baseline.fixtures.map(f=>f.id===id?{...facts.fixture(season.pregame.game,{checkedAt:season.pregame.checkedAt,now:new Date(season.pregame.checkedAt)}),ticketUrl:f.ticketUrl}:f);
module.exports=(async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ns-nhl-live-')),filePath=path.join(temp,'directory.json');
 try{
  fs.writeFileSync(filePath,JSON.stringify(baseline,null,2)+'\n');let calls=0;
  const fetchJson=async url=>{calls++;return clone(url===facts.TABLE_URL?season.standings:weeks[routes.findIndex(r=>r.url===url)]);};
  const result=await facts.refreshFile({filePath,fetchJson,clock:()=>now});assert(result.changed);assert.equal(calls,3);
  const after=JSON.parse(fs.readFileSync(filePath)),live=after.fixtures.find(f=>f.id===id),prior=baseline.fixtures.find(f=>f.id===id);
  assert.equal(live.status,'live');assert.deepEqual(live.participantSlots.map(s=>s.score),[0,0]);assert.equal(live.sourceCheckedAt,prior.sourceCheckedAt,'live status does not re-date unchanged scheduled facts');assert.equal(live.statusCheckedAt,at);assert.equal(live.scoreCheckedAt,at);assert.equal(live.ticketUrl,prior.ticketUrl);
  assert.deepEqual(after.fixtures.map(f=>f.id),baseline.fixtures.map(f=>f.id));assert.deepEqual(after.fixtures.filter(f=>f.id!==id),baseline.fixtures.filter(f=>f.id!==id),'only the genuinely checked live fixture advances');
  for(const key of ['generatedAt','teams','players','competitions','sources'])assert.deepEqual(after[key],baseline[key]);assert.deepEqual(after.standings,baseline.standings);
  const later=new Date(+now+60000);calls=0;assert((await facts.refreshFile({filePath,fetchJson,clock:()=>later})).changed);assert.equal(calls,3);
  const rerun=JSON.parse(fs.readFileSync(filePath)),checked=rerun.fixtures.find(f=>f.id===id);assert.equal(checked.statusCheckedAt,later.toISOString());assert.equal(checked.scoreCheckedAt,later.toISOString());assert.equal(checked.sourceCheckedAt,prior.sourceCheckedAt);assert.deepEqual(rerun.fixtures.filter(f=>f.id!==id),after.fixtures.filter(f=>f.id!==id));
  const bytes=fs.readFileSync(filePath,'utf8');assert(!(await facts.refreshFile({filePath,fetchJson,clock:()=>later})).changed);assert.equal(fs.readFileSync(filePath,'utf8'),bytes,'replaying an identical observation cannot create freshness');
  const controls=require('../config/feed-controls'),timing=require('../config/card-timing');assert.equal(controls.timingState(checked,later).key,'live-now');assert.equal(timing.presentation(checked,later).status,'LIVE');const stale=new Date(+later+30*60000+1);assert.equal(controls.timingState(checked,stale).key,'awaiting-update');assert.equal(timing.presentation(checked,stale).status,'Awaiting match update');
  const changed=clone(weeks);changed[0].gameWeek.find(d=>d.games.some(g=>g.id===sample.game.id)).games.find(g=>g.id===sample.game.id).awayTeam.score=1;
  await assert.rejects(facts.refreshFile({filePath,fetchJson:async url=>url===routes[0].url?changed[0]:fetchJson(url),clock:()=>now}),/stale or conflicting/);assert.equal(fs.readFileSync(filePath,'utf8'),bytes);
  const regression=facts.fixture(season.pregame.game,{checkedAt:new Date(+later+60000).toISOString(),now:new Date(+later+60000)});assert.throws(()=>facts.mergeFixtures(rerun,[regression]),/regress/);
  const finalGame=clone(sample.game);finalGame.gameState='OFF';finalGame.awayTeam.score=1;finalGame.homeTeam.score=0;finalGame.gameOutcome={lastPeriodType:'REG'};const finalAt=new Date(+later+120000),final=facts.fixture(finalGame,{checkedAt:finalAt.toISOString(),now:finalAt}),done={...rerun,fixtures:facts.mergeFixtures(rerun,[final])};assert.equal(done.fixtures.find(f=>f.id===id).status,'completed');assert.equal(done.fixtures.find(f=>f.id===id).sourceCheckedAt,prior.sourceCheckedAt);assert.equal(done.fixtures.find(f=>f.id===id).scoreCheckedAt,finalAt.toISOString());
  assert.throws(()=>facts.mergeFixtures(done,[{...row,sourceCheckedAt:new Date(+finalAt+60000).toISOString()}]),/regress/);
  const repeatFinal=facts.fixture(finalGame,{checkedAt:new Date(+finalAt+60000).toISOString(),now:new Date(+finalAt+60000)});assert.deepEqual(facts.mergeFixtures(done,[repeatFinal]),done.fixtures,'unchanged settled final dates stay original');
  for(const bad of [async()=>{throw Error('source outage');},async url=>{const p=await fetchJson(url);if(url===routes[0].url)p.gameWeek.find(d=>d.games.length).games.pop();return p;}]){await assert.rejects(facts.refreshFile({filePath,fetchJson:bad,clock:()=>new Date(+later+60000)}));assert.equal(fs.readFileSync(filePath,'utf8'),bytes,'failed response cannot partially persist live observations');}
  console.log(`NHL live: actual weekly zero and two club 1–0 observations, ${rejected} rejected controls, three-request persistence, fresh/stale/replay/continuity/final/outage safeguards pass.`);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
})();
