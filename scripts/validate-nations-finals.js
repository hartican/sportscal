'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const review=require('../data/canonical/nations-finals-reviewed-2026.v1.json');
const catalogue=require('../data/major-events.v1.json');
const parent=catalogue.events.find(e=>e.id===review.parentId);
const model=require('./lib/nations-finals-review'),{publish}=require('./apply-reviewed-nations-finals');
const server=require('../lib/nothingscore-server'),major=require('../config/major-events'),reminders=require('../config/fixture-reminder-policy');
const now=new Date('2026-10-12T00:00:00Z');
for(const row of review.fixtures){
  const child=parent.subEvents.find(e=>e.id===row.id);
  assert.equal(Date.parse(child.startTimeUtc),Date.parse(row.startTimeUtc),row.id+': publish the independently reconciled fixture time');
  assert.equal(child.sourceCheckedAt,review.observedAt);assert.equal(child.sourceUrl,review.sourceUrl);assert.equal(child.timingProvenance.publisherFixtureId,row.publisherFixtureId);
  assert.equal(child.participantsConfirmed,false);assert.deepEqual(child.participantIds,[]);assert.equal(child.participantSlots.length,2);assert(child.participantSlots.every(s=>s.participantId===null&&/placed (North|South)$/.test(s.label)));
  assert(!child.result&&!child.scoreDisplay&&!child.statusCheckedAt&&!child.actualStartTimeUtc,'A timetable establishes no play, score or status freshness');
  assert.equal(Date.parse(server.eventFor(row.id).startTimeUtc),Date.parse(row.startTimeUtc),'Actual server registry uses the same canonical fixture clock');
  const fixture=major.fixtureFromSubEvent(child,parent);assert.equal(fixture.id,row.id);assert.equal(fixture.date,row.sydneyDate);assert.equal(fixture.time,row.sydneyTime);assert.deepEqual(fixture.participantIds,[]);
  assert.equal(reminders.automatic(fixture,{followFirst:{notifications:{enabled:true}},preferenceGraph:{domainPreferences:[{sportDomainId:'sport:rugby',enabled:true,includeAllFixtures:true}],entityFollows:[{participantId:'rugby-australia',followLevel:'follow'}]}},{},now),false,'A rank slot cannot establish an Australian-team follow or automatic reminder');
}
const baseline=structuredClone(catalogue),legacy=baseline.events.find(e=>e.id===review.parentId);
for(const child of legacy.subEvents){for(const key of ['startTimeUtc','timePrecision','scheduleStatus','participantsConfirmed','participantIds','participantSlots','sourceName','sourceUrl','sourceType','sourceTrust','sourceCheckedAt','timingProvenance'])delete child[key];child.startTimeUtc=null;}
const before=JSON.stringify(baseline),projected=model.project(baseline,{now});assert.equal(projected.used,6);assert.equal(JSON.stringify(baseline),before,'Projection does not mutate its caller');
assert.deepEqual(projected.document.events.filter(e=>e.id!==review.parentId),baseline.events.filter(e=>e.id!==review.parentId),'All unrelated parents and children stay exact');
assert.deepEqual(projected.document.events.find(e=>e.id===review.parentId).subEvents.map(e=>e.id),legacy.subEvents.map(e=>e.id),'All existing fixture/activity identities retained');
assert.deepEqual(model.project(projected.document,{now}).document,projected.document,'Unchanged reruns preserve bytes and original source dates');
assert.deepEqual(model.project(baseline,{now:new Date('2026-10-11T19:30:00Z')}).document,baseline,'Historical check cannot use future evidence');
let rejected=0;
for(const change of [r=>r.fixtures.pop(),r=>r.fixtures[1]=r.fixtures[0],r=>r.fixtures[0].northRank=2,r=>r.fixtures[0].publishedEpochSeconds++,r=>r.fixtures[0].startTimeUtc='2026-11-27T16:40:00',r=>r.fixtures[0].sydneyDate='2026-11-27',r=>r.fixtures[0].rfuLocalTime='17:40',r=>r.fixtures[0].participantIds=['rugby-australia'],r=>r.observedAt='2026-10-13T00:00:00Z']){const value=structuredClone(review);change(value);assert.throws(()=>model.project(baseline,{review:value,now}));rejected++;}
const primary=structuredClone(baseline),newer=primary.events.find(e=>e.id===review.parentId).subEvents[0];
Object.assign(newer,{startTimeUtc:'2026-11-27T17:00:00Z',sourceUrl:'https://www.world.rugby/beta/en/match/e7d020c9-fe59-405e-ab5e-39696c8ce9b7',sourceCheckedAt:'2026-10-12T00:00:00Z',participantIds:['north-known','south-known']});
assert.deepEqual(model.project(primary,{now}).document.events.find(e=>e.id===review.parentId).subEvents[0],newer,'Later primary reschedule/teams survive the frozen review');
const pending=structuredClone(primary);pending.events.find(e=>e.id===review.parentId).subEvents[0].startTimeUtc=null;
assert.deepEqual(model.project(pending,{now}).document.events.find(e=>e.id===review.parentId).subEvents[0],pending.events.find(e=>e.id===review.parentId).subEvents[0],'A later primary unknown start cannot be replaced by the old timetable');
const code=require('../data/code-inspector/rugby-union.json'),schedule=require('../data/follow-schedule/rugby-union.json');
for(const document of [code,schedule])for(const row of review.fixtures){const fixture=document.fixtures.find(e=>e.id===row.id);assert.equal(Date.parse(fixture.startTimeUtc),Date.parse(row.startTimeUtc));assert.equal(fixture.date,row.sydneyDate);assert.equal(fixture.time,row.sydneyTime);assert.equal(fixture.sourceCheckedAt,review.observedAt);assert.equal(fixture.participantsConfirmed,false);assert.deepEqual(fixture.participantIds,[]);}
const terminal=structuredClone(baseline);terminal.events.find(e=>e.id===review.parentId).subEvents[0].status='cancelled';assert.equal(model.project(terminal,{now}).used,5,'Existing explicit terminal state survives');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ns-nations-finals-'));
try{
  fs.mkdirSync(path.join(root,'data'));const file=path.join(root,'data/major-events.v1.json');fs.writeFileSync(file,JSON.stringify(baseline,null,2)+'\n');
  assert.equal(publish({root,now}).used,6);const saved=fs.readFileSync(file);assert.equal(publish({root,now}).changed,false);assert(saved.equals(fs.readFileSync(file)),'Real writer unchanged replay retains bytes');
  const partial=structuredClone(baseline);partial.events.find(e=>e.id===review.parentId).subEvents.pop();fs.writeFileSync(file,JSON.stringify(partial));const lastGood=fs.readFileSync(file);assert.throws(()=>publish({root,now}));assert(lastGood.equals(fs.readFileSync(file)),'Incomplete collection rejects before any write');
  const invalid=structuredClone(baseline);invalid.events.find(e=>e.id===review.parentId).subEvents.at(-1).startTimeUtc='2026-02-30T13:00:00Z';fs.writeFileSync(file,JSON.stringify(invalid));const prior=fs.readFileSync(file);assert.throws(()=>publish({root,now}));assert(prior.equals(fs.readFileSync(file)),'Late malformed primary rejects before earlier records persist');
}finally{fs.rmSync(root,{recursive:true,force:true});}
const owner=require('./update-cards');assert(owner.buildSteps({localOnly:true}).some(step=>step[0]==='scripts/apply-reviewed-nations-finals.js'),'Full owner retains the reviewed clocks');
assert(fs.readFileSync(path.join(__dirname,'quick-results.js'),'utf8').includes("require('./apply-reviewed-nations-finals').publish()"),'Existing daily owner consumes the same review');
assert.throws(()=>owner.parseOptions(['--nations-finals','--quick']),/cannot be combined/,'Scoped entrypoint refuses an accidental provider route');
console.log(`Nations finals: six source-backed UTC/Sydney slots, original IDs and observations, unknown teams, no automatic team alerts, ${rejected} malformed source controls, last-good persistence, later primary recovery and unchanged replay passed.`);
