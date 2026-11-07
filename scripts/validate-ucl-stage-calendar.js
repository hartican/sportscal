#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const source=require('../data/canonical/uefa-champions-league-2026-27.json');
const build=require('./build-code-inspector');
const identity=require('../config/fixture-identity'),codes=require('../data/code-inspector/manifest.json').codes;
assert.equal(identity.scheduleCode({id:'sport:champions-league',parentId:'sport:football'},codes)?.id,'competition:uefa-champions-league','the actual selector opens its own competition Code');
assert.equal(identity.scheduleCode({id:'sport:champions-league',parentId:'sport:football'},codes.filter(c=>c.id!=='competition:uefa-champions-league')),null,'a missing child Code cannot advertise the broader Football schedule');
const stages=source.phases.find(p=>p.phaseId==='knockout').fixtures;
const projected=build.codeFixtures({id:'competition:uefa-champions-league',slug:'champions-league'});
const windows=[['2027-02-16','2027-02-24'],['2027-03-09','2027-03-17'],['2027-04-06','2027-04-14'],['2027-04-27','2027-05-05'],['2027-06-05','2027-06-05']];
assert.equal(stages.length,5);
for(const [i,stage]of stages.entries()){
 const fixture=projected.find(f=>f.id===stage.id);
 assert(fixture,'every existing programme ID remains');
 assert.equal(fixture.displayDateLabel,`${stage.dateLabel} (Madrid dates)`,`${stage.id}: verified calendar label must survive the actual projection`);
 assert.equal(fixture.startTimeUtc,null,'a calendar window cannot invent a kickoff');
 assert.equal(fixture.date,null,'unknown Sydney match date remains unknown');
 assert.deepEqual(fixture.participantIds,[],'programme windows cannot invent teams');
 assert.deepEqual(fixture.schedulingWindow,{startsOn:windows[i][0],endsOn:windows[i][1],timeZone:'Europe/Madrid'},'each source stage has its own calendar window');
 assert.equal(fixture.timingProvenance.sourceDateLabel,stage.dateLabel);
 assert.equal(fixture.timingProvenance.sourceUrl,stage.sourceUrl);
 assert(Number.isFinite(Date.parse(fixture.timingProvenance.observedAt)));
}
assert.deepEqual(projected.filter(f=>stages.some(s=>s.id===f.id)).map(f=>f.id),stages.map(f=>f.id),'real builder orders the five stages by calendar date');
const final=stages.at(-1),exact={...final,startTimeUtc:'2027-06-05T19:00:00Z',timePrecision:'exact',scheduleStatus:'confirmed',timeTbc:false};
const confirmed=build.normalizeFixture(exact,'competition:uefa-champions-league');
assert.equal(confirmed.date,'2027-06-06','controlled exact UTC maps to the following Sydney date');
assert.equal(confirmed.displayDateLabel,undefined,'a confirmed fixture cannot keep a venue-calendar label over its Sydney date');
for(const change of [{startTimeUtc:null},{startTimeUtc:'invalid'},{timePrecision:'tbc'},{timeTbc:true},{startTimeTbc:true},{scheduleStatus:'provisional'}]){
 const unresolved=build.normalizeFixture({...exact,...change},'competition:uefa-champions-league');
 assert.equal(unresolved.displayDateLabel,final.displayDateLabel,'missing or unconfirmed exact facts retain the labelled calendar');
}
assert.equal(build.normalizeFixture({...exact,timingProvenance:undefined},'competition:uefa-champions-league').displayDateLabel,final.displayDateLabel,'unrelated authored labels are untouched');
if(process.argv.includes('--published')){
 const persisted=require('../data/code-inspector/champions-league.json').fixtures;
 const schedule=require('../data/follow-schedule/champions-league.json');
 for(const stage of stages){
  assert.deepEqual(persisted.find(f=>f.id===stage.id),projected.find(f=>f.id===stage.id),'actual Inspector persistence');
  assert.equal((schedule.fixtures||schedule.events||schedule).find(f=>f.id===stage.id)?.displayDateLabel,stage.displayDateLabel,'actual Schedule persistence');
 }
}
console.log('UCL calendar: all five verified stage labels reach the actual projection without invented Sydney kickoffs or teams.');
