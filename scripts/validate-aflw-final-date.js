#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const helper=require('./lib/aflw-final-date'),review=require('../config/reviewed-aflw-final-date.json'),bundle=require('../data/canonical/afl-nrl-2026.json'),reminders=require('../config/fixture-reminder-policy');
const historical=require('./fixtures/aflw-finals-placeholders-20261009.json').events;
const now=new Date('2026-10-09T11:30:00Z'),id=review.fixtureId,actual=bundle.events.find(e=>e.id===id),base={...historical.find(e=>e.id===id)};
for(const field of ['date','dateOnly','timePrecision','time','timeTbc','startTimeTbc','scheduleNote','timingProvenance'])delete base[field];
const finalsById=new Map(historical.map(e=>[e.id,e.id===id?base:e]));
const original={...bundle,events:bundle.events.map(e=>finalsById.get(e.id)||e)},before=JSON.stringify(original),projected=helper.project(original,now),final=projected.bundle.events.find(e=>e.id===id);
assert.equal(projected.used,1);assert.equal(final.date,'2026-11-27');assert.equal(final.dateOnly,true);assert.equal(final.timePrecision,'date-only');assert.equal(final.startTimeUtc,null);assert.equal(final.time,null);assert.equal(final.scheduleStatus,'tbc');assert.equal(reminders.timing(final,now),null);
assert.deepEqual(final.source,base.source);assert.equal(final.updatedAt,base.updatedAt);assert.equal(final.createdAt,base.createdAt);assert.deepEqual(final.participantIds,base.participantIds);assert.equal(final.displayName,base.displayName);
const view=require('../config/sport-hubs').canonicalFixtureView(final,{feedCards:[],participants:bundle.participants});assert.equal(view.event.date,'2026-11-27');assert.equal(view.event.displayTime,'Time TBC');assert.equal(require('../config/card-timing').dateOnlyLabel(view.event),'Time TBC');
assert.equal(final.timingProvenance.observedAt,review.observedAt);assert.equal(JSON.stringify(original),before);assert.deepEqual(helper.project(projected.bundle,now).bundle,projected.bundle);
assert.deepEqual(projected.bundle.events.filter(e=>e.id!==id),original.events.filter(e=>e.id!==id),'Other real fixtures, finals, clocks and results remain exact');
const otherFinals=projected.bundle.events.filter(e=>e.competitionId==='competition:aflw-2026'&&e.id!==id&&!/^Round \d+$/.test(e.roundLabel));assert.equal(otherFinals.length,8);assert(otherFinals.every(e=>!e.date&&!e.startTimeUtc));
for(const event of [{...base,date:'2027-01-08'},{...base,startTimeUtc:'2026-11-27T08:00:00.000Z',scheduleStatus:'confirmed'},...['completed','live','postponed','cancelled','abandoned'].map(status=>({...base,status})),{...base,result:{status:'completed',scorelineText:'Actual result'}},{...base,timingProvenance:{kind:'official',sourceUrl:base.source.sourceUrl}}])assert.deepEqual(helper.apply(event,now).event,event,'Primary or terminal facts cannot be overridden by the date announcement');
assert.deepEqual(helper.apply(base,'2026-10-08T00:00:00Z').event,base,'A historical check cannot borrow a later observation');
for(const change of [{competitionId:'wrong'},{sourceId:'wrong'},{seasonLabel:'2027'},{roundLabel:'Semi Finals'},{source:{...base.source,sourceUrl:'https://example.com'}},{startTimeUtc:'2026-02-30T08:00:00Z'},{startTimeUtc:'not-a-clock'},{date:'2026-02-30'}])assert.throws(()=>helper.apply({...base,...change},now));
for(const change of [{fixtureId:'wrong'},{date:'2026-11-28'},{date:'2026-02-30'},{publishedAt:'2026-10-10T00:00:00.000Z'},{observedAt:'2026-02-30T00:00:00.000Z'},{sourceUrl:'https://example.com'},{sourceSha256:'missing'}])assert.throws(()=>helper.apply(base,now,{...review,...change}));
assert.throws(()=>helper.project({...original,events:original.events.filter(e=>e.id!==id)},now));assert.throws(()=>helper.project({...original,events:[...original.events,base]},now));
// Exercise actual persistence, then read its written facts and an unchanged rerun.
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ns-aflw-date-'));try{
 fs.mkdirSync(path.join(temp,'data/canonical'),{recursive:true});const file=path.join(temp,'data/canonical/afl-nrl-2026.json');fs.writeFileSync(file,JSON.stringify(original,null,2)+'\n');
 const publish=require('./apply-reviewed-aflw-final-date').publish;assert.equal(publish(temp,now).changed,true);assert.deepEqual(JSON.parse(fs.readFileSync(file)),projected.bundle);const bytes=fs.readFileSync(file,'utf8');assert.equal(publish(temp,now).changed,false);assert.equal(fs.readFileSync(file,'utf8'),bytes);
}finally{fs.rmSync(temp,{recursive:true,force:true});}
const build=require('./refresh-canonical-sports').buildAflEvent;assert.equal(typeof build,'function');
const raw={id:9081,providerId:'CD_M20262641601',status:'PLACEHOLDER',round:{name:'Grand Final',roundNumber:16},home:{team:{providerId:'CD_T3020',id:3020,name:'Winner of PF1'}},away:{team:{providerId:'CD_T3021',id:3021,name:'Winner of PF2'}},venue:{name:'To Be Confirmed',location:'Victoria',timezone:'Australia/Melbourne'}};
const built=build(raw,now.toISOString(),new Map(),{code:'aflw',competitionId:'competition:aflw-2026',discoverySportId:'sport:aflw'}).event;assert.equal(built.date,'2026-11-27');assert.equal(built.startTimeUtc,null,'Normal canonical loader shares the reviewed date without a sporting clock');
const recovered=build({...raw,status:'SCHEDULED',utcStartTime:'2026-11-27T08:00:00Z'},now.toISOString(),new Map(),{code:'aflw',competitionId:'competition:aflw-2026',discoverySportId:'sport:aflw'}).event;assert.equal(recovered.startTimeUtc,'2026-11-27T08:00:00.000Z');assert(!recovered.dateOnly&&!recovered.timingProvenance,'Primary recovery cannot inherit stale date-only flags');
if(process.argv.includes('--published')){
 const observed=helper.apply(actual,new Date());assert.deepEqual(observed.event,actual,'Publication already reflects either the dated review or retained primary recovery');
 for(const name of ['code-inspector','follow-schedule']){const document=require(`../data/${name}/aflw.json`),record=document.fixtures.find(e=>e.id===id);assert(record);assert.equal(record.startTimeUtc,actual.startTimeUtc);if(observed.used){assert.equal(record.date,'2026-11-27');assert.equal(record.time,null);assert.equal(record.timePrecision,'date-only');assert.equal(reminders.timing(record,new Date()),null);}assert.equal(record.sourceCheckedAt,actual.source.checkedAt);assert.deepEqual(record.timingProvenance,actual.timingProvenance);}
}
console.log('AFLW final date: one existing final, eight retained unknown dates, exact identities/facts, source timestamps, no reminder clock, unique matching, primary recovery and actual persistence/idempotence passed.');
