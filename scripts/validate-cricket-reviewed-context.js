'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),record=require('../data/canonical/cricket-reviewed-context.v1.json').records[0],{createResolver}=require('./lib/cricket-reviewed-context'),follow=require('../config/follow-first');
const current=require('../data/events.json').events.find(e=>e.id===record.eventId),source={...record,id:record.sourceEventId,key:'cricket',sourceEventIds:[record.sourceEventId],sourceType:'official',sourceCheckedAt:record.checkedAt};
const missing=structuredClone(current);for(const key of ['format','matchFormat','numberOfDays','endDate','roundLabel','competitionId','competitionName','calendarProvenance','competitionProvenance'])delete missing[key];missing.sourceEventIds=[missing.id];
const original=structuredClone(missing),resolve=createResolver(),fixed=resolve(missing);
for(const field of ['format','numberOfDays','endDate','roundLabel','competitionId','competitionName'])assert.equal(fixed[field],record[field],'actual retained fourth Test recovers '+field);
assert.equal(fixed.matchFormat,'Test');assert.equal(fixed.calendarProvenance.checkedAt,record.checkedAt);assert.equal(fixed.calendarProvenance.basis,'scheduled-calendar');assert.deepEqual(fixed.sourceEventIds,[record.eventId,record.sourceEventId]);
for(const field of ['id','eventId','canonicalEventId','participantIds','startTimeUtc','date','time','sourceCheckedAt','statusCheckedAt','scoreCheckedAt','endTimeUtc','actualEndTimeUtc','venue','broadcaster','viewingOptions','storyline','editorialNarrative'])assert.deepEqual(fixed[field],missing[field],field+' retains original value/clock');
assert.deepEqual(missing,original,'pure resolver never changes its input');assert.equal(resolve(fixed),fixed,'unchanged review retains object and provenance');
for(const variant of [{id:'another-fixture'},{key:'rugby'},{participantIds:['team:cricket:new-zealand','team:cricket:australia']},{participantIds:['team:cricket:australia-women','team:cricket:new-zealand-women']},{startTimeUtc:'2027-01-04T23:30:00Z'},{startTimeUtc:'invalid'},{format:'ODI'},{calendarProvenance:{checkedAt:'2026-10-06T00:00:00Z'}}]){
 const event={...missing,...variant};assert.equal(resolve(event),event,'unreviewed/rescheduled/conflicting/later context is not guessed');
}
const later={...missing,endDate:'2027-01-07',numberOfDays:4,roundLabel:'Later confirmed label',competitionId:'competition:cricket:retained',competitionName:'Retained series',endTimeUtc:'2027-01-07T05:00:00Z',actualEndTimeUtc:'2027-01-07T04:01:00Z'};
const kept=resolve(later);for(const key of Object.keys(later).filter(k=>k!=='sourceEventIds'))assert.deepEqual(kept[key],later[key],key+': nonempty later facts remain exact');
for(const variant of [{checkedAt:'2026-02-30T00:00:00Z'},{checkedAt:'2099-01-01T00:00:00Z'},{endDate:'2027-02-30'},{numberOfDays:4},{sourceUrl:'https://example.invalid/schedule'},{sourceUrl:'http://www.cricket.com.au/schedule'},{sourceUrl:'https://owner:secret@www.cricket.com.au/schedule'},{sourceEndTimeUtc:'invalid'}])assert.throws(()=>createResolver({records:[{...record,...variant}]}),/Invalid reviewed|Invalid URL/,'invalid evidence rejects before writer');
assert.throws(()=>createResolver({records:[record,record]}),/Invalid reviewed/,'ambiguous duplicate review rejects');
const preferences={preferenceGraph:{competitionPreferences:[{competitionId:record.competitionId,enabled:true}]}};
assert.equal(follow.reasonForEvent(fixed,preferences)?.id,record.competitionId,'same existing series admits fourth Test');
assert.equal(follow.reasonForEvent(fixed,{preferenceGraph:{competitionPreferences:[{competitionId:record.competitionId,enabled:false}],entityFollows:[{participantId:'team:cricket:australia',followLevel:'follow'}]}}),null,'series exclusion wins over followed Australia');
assert.equal(follow.reasonForEvent(fixed,{followFirst:{followedSportIds:['cricket']}}),null,'broad Cricket does not imply series');
const {mergeFixtureRecords}=require('./build-code-inspector');
for(const order of [[missing,source],[source,missing]]){
 const before=structuredClone(order),fixtures=mergeFixtureRecords([],order,'sport:cricket',new Set(order));assert.equal(fixtures.length,1,'retained source and card merge once');assert.equal(fixtures[0].id,current.id,'both orders preserve action identity');assert.equal(fixtures[0].format,'Test');assert.equal(fixtures[0].endDate,record.endDate);assert.deepEqual(order,before,'real merger inputs stay immutable');
}
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ns-cricket-review-'));
try{
 const doc=structuredClone(require('../data/events.json'));doc.events[doc.events.findIndex(e=>e.id===missing.id)]=missing;
 const file=path.join(temp,'events.json');fs.writeFileSync(file,JSON.stringify(doc));
 execFileSync(process.execPath,[path.join(__dirname,'apply-representative-metadata.js'),file],{cwd:root,stdio:'pipe'});
 const written=JSON.parse(fs.readFileSync(file));assert.deepEqual(written.events.map(e=>e.id),doc.events.map(e=>e.id),'actual writer preserves every identity/order');
 for(let i=0;i<doc.events.length;i++)assert.deepEqual(written.events[i],doc.events[i].id===missing.id?fixed:doc.events[i],'actual writer only changes reviewed fixture');
 const bytes=fs.readFileSync(file);execFileSync(process.execPath,[path.join(__dirname,'apply-representative-metadata.js'),file],{cwd:root,stdio:'pipe'});assert(fs.readFileSync(file).equals(bytes),'actual unchanged writer retains bytes');
 const output=path.join(temp,'published.json');fs.writeFileSync(output,JSON.stringify(doc));
 execFileSync(process.execPath,[path.join(__dirname,'publish-feed.js'),file,output,path.join(temp,'meta.json'),path.join(temp,'events.js'),'--preserve-known'],{cwd:root,stdio:'pipe'});
 const actual=JSON.parse(fs.readFileSync(output));assert.deepEqual(actual.events.map(e=>e.id),doc.events.map(e=>e.id),'publication retains every identity/order');const match=actual.events.find(e=>e.id===missing.id);for(const key of ['format','matchFormat','endDate','numberOfDays','roundLabel','competitionId','calendarProvenance','sourceCheckedAt','statusCheckedAt','startTimeUtc'])assert.deepEqual(match[key],fixed[key],key+': publication persists exact scope');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
console.log('Reviewed fourth Test: actual writer/merger, sourced five-day window and original clocks, retained IDs, exact follow/exclusion, invalid evidence, later facts and unchanged rerun passed.');
