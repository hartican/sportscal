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
 const saved=structuredClone(require('../data/events.json'));
 // The complete production projection is already applied before this gate.
 // Verify its real, changing source inputs separately from deliberately missing
 // context. A valid new competition source must not look like an unrelated edit.
 const baseline=path.join(temp,'baseline.json');fs.writeFileSync(baseline,JSON.stringify(saved));
 execFileSync(process.execPath,[path.join(__dirname,'apply-representative-metadata.js'),baseline],{cwd:root,stdio:'pipe'});
 assert.deepEqual(JSON.parse(fs.readFileSync(baseline)).events,saved.events,'actual current writer preserves already-projected fixtures');
 // Controlled replay of the second source tuple observed in rejected full run
 // 38112293255. It is not the discarded complete provider response. Each child
 // uses the real CLI and full document with only its context-reader inputs
 // isolated; no provider, repository, account or database is changed.
 const secondary={id:'fixture:cricket:espn:1528714',key:'cricket',participantIds:record.participantIds,startTimeUtc:record.startTimeUtc,
  competitionId:record.competitionId,competitionName:record.competitionName,sourceType:'trusted-reporting',
  sourceUrl:'https://www.espn.in/cricket/series/24270/game/1528714/australia-vs-new-zealand-4th-test-24270',sourceCheckedAt:'2026-10-11T04:40:56.927Z'};
 const cases=[['retained-official',null,false],['matching-secondary',secondary,true],
  ['reversed-teams',{...secondary,participantIds:[...record.participantIds].reverse()},false],
  ['different-start',{...secondary,startTimeUtc:'2027-01-04T23:30:00Z'},false],
  ['different-series',{...secondary,competitionId:'competition:cricket:another'},false],
  ['future-observation',{...secondary,sourceCheckedAt:'2099-01-01T00:00:00Z'},false],
  ['invalid-observation',{...secondary,sourceCheckedAt:'2026-02-30T00:00:00Z'},false],
  ['foreign-source',{...secondary,sourceUrl:'https://example.invalid/fixture'},false]];
 const preserved=['id','eventId','canonicalEventId','participantIds','startTimeUtc','date','time','sourceCheckedAt','statusCheckedAt','scoreCheckedAt','endTimeUtc','actualEndTimeUtc','venue','broadcaster','viewingOptions','storyline','editorialNarrative'];
 for(const [name,candidate,accepted] of cases){
  const dir=path.join(temp,name);fs.mkdirSync(dir);
  const fixture={...current,sourceEventIds:[...new Set([...(current.sourceEventIds||[]),secondary.id])]};
  const inputs=[[path.join(root,'data/follow-sources/coverage.v1.json'),{events:candidate?[candidate]:[]}],[path.join(root,'data/code-inspector/cricket.json'),{fixtures:[fixture]}]];
  const preload=path.join(dir,'context.cjs');fs.writeFileSync(preload,`const inputs=${JSON.stringify(inputs)};for(const [file,value] of inputs){const id=require.resolve(file);require.cache[id]={id,filename:id,loaded:true,exports:value};}\n`);
  const doc=structuredClone(saved);doc.events[doc.events.findIndex(e=>e.id===missing.id)]=missing;
  const expected={...fixed,...(accepted?{competitionProvenance:{sourceEventId:secondary.id,sourceUrl:secondary.sourceUrl,checkedAt:secondary.sourceCheckedAt}}:{})};
  const file=path.join(dir,'events.json');fs.writeFileSync(file,JSON.stringify(doc));
  const run=args=>execFileSync(process.execPath,['--require',preload,...args],{cwd:root,stdio:'pipe'});
  const writer=[path.join(__dirname,'apply-representative-metadata.js'),file];run(writer);
  const written=JSON.parse(fs.readFileSync(file));assert.deepEqual(written.events.map(e=>e.id),doc.events.map(e=>e.id),name+': actual writer preserves every identity/order');
  for(let i=0;i<doc.events.length;i++)assert.deepEqual(written.events[i],doc.events[i].id===missing.id?expected:doc.events[i],name+': actual writer changes only the reviewed missing context');
  const match=written.events.find(e=>e.id===missing.id);
  for(const key of preserved)assert.deepEqual(match[key],missing[key],name+': original '+key+' remains');
  assert.equal(match.calendarProvenance.checkedAt,record.checkedAt,name+': format/calendar keeps the official observation');
  assert.equal(match.competitionProvenance.checkedAt,accepted?secondary.sourceCheckedAt:record.checkedAt,name+': competition keeps its own supporting observation');
  assert.equal(follow.reasonForEvent(match,preferences)?.id,record.competitionId,name+': same saved series admits fixture');
  assert.equal(follow.reasonForEvent(match,{preferenceGraph:{competitionPreferences:[{competitionId:record.competitionId,enabled:false}],entityFollows:[{participantId:'team:cricket:australia',followLevel:'follow'}]}}),null,name+': explicit exclusion still wins');
  const bytes=fs.readFileSync(file);run(writer);assert(fs.readFileSync(file).equals(bytes),name+': unchanged writer retains bytes');
  const output=path.join(dir,'published.json');fs.writeFileSync(output,JSON.stringify(doc));
  const publication=[path.join(__dirname,'publish-feed.js'),file,output,path.join(dir,'meta.json'),path.join(dir,'events.js'),'--preserve-known'];run(publication);
  const actual=JSON.parse(fs.readFileSync(output));assert.deepEqual(actual.events.map(e=>e.id),doc.events.map(e=>e.id),name+': publication retains every identity/order');
  const published=actual.events.find(e=>e.id===missing.id);
  for(const key of [...preserved,'format','matchFormat','endDate','numberOfDays','roundLabel','competitionId','calendarProvenance','competitionProvenance','sourceEventIds'])assert.deepEqual(published[key],expected[key],name+': publication persists '+key);
  const publishedEvents=structuredClone(actual.events);run(publication);assert.deepEqual(JSON.parse(fs.readFileSync(output)).events,publishedEvents,name+': unchanged publication retains fixture facts');
 }
}finally{fs.rmSync(temp,{recursive:true,force:true});}
console.log('Reviewed fourth Test: real current projection and eight isolated actual-writer/publication paths, independent official/secondary clocks, unchanged fixtures/IDs, saved series/exclusions, rejected source context and unchanged reruns passed.');
