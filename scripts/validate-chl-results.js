#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const facts=require('./lib/chl-results'),sample=require('./fixtures/chl-results-20261004.json'),owner=require('./refresh-nfl-ice-hockey');
const current=require('../data/canonical/ice-hockey-directory.v1.json'),teams=current.teams.filter(t=>t.leagueId==='competition:chl'),clone=v=>structuredClone(v);
const checkedAt='2026-10-04T11:40:00.000Z',now=new Date(checkedAt);
const page=`"currentSeason":{"_entityId":"${facts.SEASON_ID}","name":"2026/27"} https://www.chl.hockey/api/s3?q=schedule-21ec9dad81abe2e0240460d0-${facts.SEASON_ID}.json`;
const resources=facts.discover(page),options={teams,checkedAt,now,previousFixtures:[]},parsed=facts.parseSchedule(sample.schedule,options);
options.previousFixtures=parsed;
const finals=parsed.filter(f=>f.status==='completed'),calendars=parsed.filter(f=>f.participantSlots.length===0);
assert.equal(parsed.length,84);assert.equal(finals.length,48);assert.equal(calendars.length,12);
const named=finals.find(f=>f.id==='fixture:chl:0636729f7d82ee17686c2f79');
assert.equal(named.participantSlots.find(s=>s.homeAway==='home').score,4);assert.equal(named.participantSlots.find(s=>s.homeAway==='away').score,0);
assert.equal(finals.filter(f=>f.resultLabels?.includes('After overtime')).length,5);assert.equal(finals.filter(f=>f.resultLabels?.includes('After shootout')).length,1);
for(const f of calendars){assert.equal(f.startTimeUtc,null);assert.equal(f.time,null);assert.equal(f.date,null);assert.deepEqual(f.participantSlots,[]);assert.equal(f.participantsConfirmed,false);assert.equal(f.scheduleStatus,'tbc');assert(!f.score&&!f.scoreCheckedAt);assert(f.displayDateLabel.endsWith('(CHL programme date)'));}
for(const f of parsed.filter(f=>f.status==='upcoming'))assert(f.participantSlots.every(s=>s.score===undefined),'future placeholder 0–0 is not a result');
const projected=require('./build-code-inspector').codeFixtures({id:'sport:ice-hockey',slug:'ice-hockey'});
for(const fixture of current.fixtures.filter(f=>f.status==='completed'&&f.participantSlots?.length===2&&f.participantSlots.every(s=>s.score!=null))){
 const row=projected.find(f=>f.id===fixture.id),expected=`${fixture.participantSlots[0].label} ${fixture.participantSlots[0].score}-${fixture.participantSlots[1].score} ${fixture.participantSlots[1].label}`;
 assert(row?.scoreDisplay?.startsWith(expected),`${fixture.id}: hockey score order must match the displayed participant order`);
}
const rows=facts.parseRecords(sample.records,{...options,fixtures:parsed,sourceUrl:resources.recordsUrl});assert.equal(rows.length,24);assert(rows.every(r=>r.rank===null&&r.rankPending&&r.recordKind==='club-record'&&!r.stale));
const published={inspector:require('../data/code-inspector/ice-hockey.json'),schedule:require('../data/follow-schedule/ice-hockey.json')};
assert(facts.projectionCurrent(current,published),'actual source facts must persist on both published surfaces');
for(const mutate of [p=>p.inspector.fixtures.find(f=>f.id===named.id).sourceCheckedAt='2026-10-01T00:00:00.000Z',p=>p.schedule.fixtures.find(f=>f.id===named.id).participantSlots[0].score='99',p=>p.inspector.standings.find(r=>r.competitionId==='competition:chl').rank=1,p=>p.inspector.fixtures.find(f=>f.id===named.id).scoreDisplay='4-0',p=>p.schedule.fixtures=p.schedule.fixtures.filter(f=>f.id!==named.id)]){const surfaces=clone(published);mutate(surfaces);assert(!facts.projectionCurrent(current,surfaces),'interrupted/stale projection must be repaired on an unchanged source check');}
let rejected=0;
for(const mutate of [p=>p.data.pop(),p=>p.data.push(clone(p.data[0])),p=>p.errors.push('partial'),p=>p.data[0].results.scores.home=null,p=>p.data[0].results.scores.home='',p=>p.data[0].results.scores.home=-1,p=>p.data[0].results.scores.home=1.2,p=>p.data[0].results.scores.away=4,p=>p.data[0].status='unknown',p=>p.data[0].state.name='unknown',p=>p.data[0].teams.home._entityId='unrecognised',p=>p.data[0].teams.away=clone(p.data[0].teams.home),p=>p.data[0].startDate='2026-02-30T15:30:00.000Z',p=>p.data[0].startDate='2028-09-03T15:30:00.000Z',p=>p.data.at(-1).status='finished']){
 const p=clone(sample.schedule);mutate(p);assert.throws(()=>facts.parseSchedule(p,options),/CHL:/);rejected++;
}
for(const mutate of [p=>p.data.pop(),p=>p.data.push(clone(p.data[0])),p=>p.data[0].stats.matches.played.total=null,p=>p.data[0].stats.matches.won.total=-1,p=>p.data[0].stats.goals.scored.total='13',p=>p.errors.push('partial')]){const p=clone(sample.records);mutate(p);assert.throws(()=>facts.parseRecords(p,{...options,fixtures:parsed,sourceUrl:resources.recordsUrl}),/CHL:/);rejected++;}
assert.throws(()=>facts.parseSchedule(sample.schedule,{...options,checkedAt:'2026-10-04T11:41:00.000Z'}),/future observation/);rejected++;
assert.throws(()=>facts.discover(page.replace('2026/27','2025/26')),/season/);rejected++;
const later='2026-10-04T11:41:00.000Z';assert.strictEqual(facts.retainDates(rows[0],{...rows[0],asOf:later}),rows[0]);assert.throws(()=>facts.retainDates(rows[0],{...rows[0],wins:2}),/stale or conflicting/);rejected++;
const finalGame=require('./fixtures/nhl-zero-final-20261004.json'),nhl=owner.nhlFixture(finalGame);assert(nhl.participantSlots.some(s=>s.score===0),'actual NHL zero is retained');
const zeroSide=finalGame.homeTeam.score===0?'homeTeam':'awayTeam';for(const value of [null,'',undefined,-1,1.2]){const game=clone(finalGame);game[zeroSide].score=value;assert.throws(()=>owner.nhlFixture(game),/invalid paired observed scores/);rejected++;}
assert(owner.nhlFixture({...finalGame,gameState:'FUT'}).participantSlots.every(s=>s.score===null),'future scores cannot imply a result');
module.exports=(async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ns-chl-results-'));
 try{
  // Controlled legacy state from actual fixtures: remove result provenance and
  // restore the original score-loss pattern. All other sports remain real.
  // The archived 4 October response must start from its complete historical
  // facts. Current fixtures can already contain later finals or reschedules;
  // replaying the old response over those correctly fails continuity.
  const baseline=clone(current);baseline.fixtures=[...baseline.fixtures.filter(f=>f.competitionId!=='competition:chl'),...parsed.map(f=>{
   const match=sample.schedule.data.find(m=>'fixture:chl:'+m._entityId===f.id),legacy={...f,participantSlots:['away','home'].map(side=>({participantId:'team:chl:'+match.teams[side]._entityId,label:match.teams[side].name,homeAway:side,logoUrl:`https://res.cloudinary.com/chl-production/image/upload/c_fit,g_center,h_300,w_300/chl-prod/assets/teams/${match.teams[side].externalId}`}))};
   for(const key of ['sourceName','sourceType','sourceCheckedAt','resultSourceUrl','resultSourceCheckedAt','scoreCheckedAt','resultLabels'])delete legacy[key];return legacy;
  })];
  baseline.standings=baseline.standings.map((r,index)=>{if(!String(r.participantId).startsWith('team:chl:'))return r;const legacy={participantId:r.participantId,rank:index+1,gamesPlayed:r.gamesPlayed,wins:r.wins,losses:r.losses,goalsFor:r.goalsFor,goalsAgainst:r.goalsAgainst};return legacy;});
  const filePath=path.join(temp,'directory.json');fs.writeFileSync(filePath,JSON.stringify(baseline,null,2)+'\n');let calls=[];
  const fetchJson=async url=>{calls.push(url);if(url===resources.scheduleUrl)return clone(sample.schedule);if(url===resources.recordsUrl)return clone(sample.records);throw Error('unexpected request');},fetchText=async url=>{calls.push(url);assert.equal(url,facts.PAGE_URL);return page;};
  const result=await facts.refreshFile({filePath,fetchJson,fetchText,clock:()=>now});assert(result.changed);assert.equal(calls.length,3);
  const after=JSON.parse(fs.readFileSync(filePath)),bytes=fs.readFileSync(filePath,'utf8');assert.deepEqual(after.fixtures.filter(f=>f.competitionId!=='competition:chl'),baseline.fixtures.filter(f=>f.competitionId!=='competition:chl'));assert.deepEqual(after.teams,baseline.teams);assert.deepEqual(after.players,baseline.players);assert.equal(after.generatedAt,baseline.generatedAt);assert.deepEqual(new Set(after.fixtures.map(f=>f.id)),new Set(baseline.fixtures.map(f=>f.id)));
  const rerun=await facts.refreshFile({filePath,fetchJson,fetchText,clock:()=>new Date(later)});assert(!rerun.changed);assert.equal(fs.readFileSync(filePath,'utf8'),bytes,'unchanged check preserves every source/fact date and exact bytes');
  for(const failed of [async()=>{throw Error('source unavailable');},async url=>{if(url===resources.scheduleUrl){const p=clone(sample.schedule);p.data.pop();return p;}return clone(sample.records);},async url=>{if(url===resources.recordsUrl){const p=clone(sample.records);p.data.pop();return p;}return clone(sample.schedule);}]){await assert.rejects(facts.refreshFile({filePath,fetchJson:failed,fetchText,clock:()=>new Date(later)}));assert.equal(fs.readFileSync(filePath,'utf8'),bytes,'failed/partial source preserves last-good file');}
  const corrected=clone(sample.schedule);corrected.data[0].results.scores.home=5;
  const fresh=()=>new Date('2026-10-04T11:42:00.000Z');const correction=await facts.refreshFile({filePath,fetchJson:async url=>url===resources.scheduleUrl?corrected:clone(sample.records),fetchText,clock:fresh});assert(correction.changed);const updated=JSON.parse(fs.readFileSync(filePath));assert(updated.standings.filter(r=>r.competitionId==='competition:chl').some(r=>r.stale),'lagging records stay visibly stale');assert.equal(updated.fixtures.find(f=>f.id===named.id).participantSlots.find(s=>s.homeAway==='home').score,5);
  // A newly published final is a separate controlled evolution of a real
  // upcoming record, with an observation after its actual supplied kickoff.
  const newFinal=clone(sample.schedule),nextMatch=newFinal.data.find(m=>m.status==='not-started'&&m.stage.group.name==='Regular Season');
  nextMatch.status='finished';nextMatch.results.scores.home=0;nextMatch.results.scores.away=1;nextMatch.state.name='Fulltime';
  assert.throws(()=>facts.parseSchedule(newFinal,options),/future final observation/);
  const observed=new Date(Date.parse(nextMatch.startDate)+3600000).toISOString();const freshFinals=facts.parseSchedule(newFinal,{...options,checkedAt:observed,now:new Date(observed)});
  assert.equal(freshFinals.filter(f=>f.status==='completed').length,49);assert.equal(freshFinals.find(f=>f.id==='fixture:chl:'+nextMatch._entityId).participantSlots.find(s=>s.homeAway==='home').score,0);
  assert.throws(()=>facts.merge({...baseline,fixtures:freshFinals},{fixtures:parsed,standings:rows}),/cannot regress a completed match/,'Historical test isolation cannot weaken real final continuity');
  const correctedBytes=fs.readFileSync(filePath,'utf8');await assert.rejects(facts.refreshFile({filePath,fetchJson,fetchText,clock:()=>now}),/stale or conflicting/);assert.equal(fs.readFileSync(filePath,'utf8'),correctedBytes);
  // The real full owner uses the same validation and retention seam. Rosters
  // are empty controlled responses; this test makes no roster-readiness claim.
  const full=await owner.buildChl({previous:baseline,clock:()=>now,fetchPage:fetchText,fetchSource:async url=>url===resources.scheduleUrl?clone(sample.schedule):url===resources.recordsUrl?clone(sample.records):url===resources.teamsUrl?clone(sample.records):{data:{athletes:[]}}});
  assert.deepEqual(full.fixtures.find(f=>f.id===named.id),after.fixtures.find(f=>f.id===named.id));assert.deepEqual(full.standings,after.standings.filter(r=>r.competitionId==='competition:chl'));
  const previousFetch=global.fetch,previousReport=process.env.QUICK_RESULTS_REPORT,reportPath=path.join(temp,'failed-attempt.json'),liveFile=path.join(__dirname,'../data/canonical/ice-hockey-directory.v1.json'),beforeFailure=fs.readFileSync(liveFile,'utf8');
  try{global.fetch=async()=>{throw Error('controlled source outage');};process.env.QUICK_RESULTS_REPORT=reportPath;await assert.rejects(require('./quick-results').refresh({source:'chl',now}),/controlled source outage/);assert.equal(fs.readFileSync(liveFile,'utf8'),beforeFailure);assert(JSON.parse(fs.readFileSync(reportPath)).failures[0].includes('controlled source outage'));}finally{global.fetch=previousFetch;if(previousReport===undefined)delete process.env.QUICK_RESULTS_REPORT;else process.env.QUICK_RESULTS_REPORT=previousReport;}
  const steps=require('./quick-results').projectionSteps(['CHL results and club records 48']);assert(steps.some(s=>s[0]==='scripts/build-code-inspector.js'&&s.includes('--codes=ice-hockey')));assert(!steps.some(s=>s[0]==='scripts/publish-feed.js'),'CHL source refresh does not republish unrelated Feed facts');
  if(process.argv.includes('--published')){const code=require('../data/code-inspector/ice-hockey.json'),schedule=require('../data/follow-schedule/ice-hockey.json');for(const f of current.fixtures.filter(f=>f.competitionId==='competition:chl'&&f.status==='completed')){for(const surface of [code,schedule]){const row=surface.fixtures.find(r=>r.id===f.id);assert(row?.scoreDisplay);assert.equal(row.resultSourceCheckedAt,f.resultSourceCheckedAt);}}assert.equal(code.coverageStatus,'partial');assert.equal(code.fixtures.filter(f=>f.competitionId==='competition:chl'&&!f.participantSlots.length).length,12);}
  console.log(`CHL: 48 paired finals, twelve honest programme dates, 24 unranked club records, ${rejected} rejected source/clock/score controls; actual full/quick persistence, unchanged dates, corrections and last-good recovery pass.`);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
})();
