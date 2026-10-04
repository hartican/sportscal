'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),review=require('../data/canonical/skiing-calendar-review.v1.json'),api=require('./lib/skiing-calendar-review');
const identity=require('../config/fixture-identity'),timing=require('../config/card-timing'),inspector=require('./build-code-inspector'),policy=require('../config/fixture-reminder-policy');
const clone=value=>JSON.parse(JSON.stringify(value));
const seed={id:'evt_103',key:'ski',name:"Sun Valley — Men's Alpine Finals Downhill",date:'2027-03-20',time:'04:00',status:'upcoming',broadcaster:'FIS broadcast',broadcastOptions:['FIS broadcast'],sourceTrust:'unverified',sourceCheckedAt:'2026-07-10T08:30:00+10:00',fullSpiel:'Sun Valley is retained as a marquee winter-sport appointment. Watch via FIS broadcast.',selectedSentence:'Generic seed preview',participantIds:[]};
const calendar=api.qualify(seed);assert.equal(calendar.id,seed.id);assert.equal(calendar.time,null);assert.equal(calendar.startTimeUtc,null);assert.equal(calendar.timePrecision,'date-only');assert.equal(calendar.sourceCheckedAt,review.checkedAt);assert.equal(calendar.broadcaster,'Australian viewing unconfirmed');assert(!/Watch via FIS/.test(calendar.fullSpiel));
assert.deepEqual(api.qualify(calendar),calendar,'Unchanged reruns must not refresh observations');
assert.equal(policy.timing(calendar),null,'Calendar dates cannot create reminder clocks');
assert.match(timing.presentation(calendar).fullSchedule,/Idaho date.*TIME TBC.*Sydney start TBC/);assert(!timing.presentation(calendar).fullSchedule.includes('(Sydney time)'));
const exact={...calendar,sourceCheckedAt:review.checkedAt,scheduleStatus:'confirmed',timePrecision:'exact',timeTbc:false,startTimeTbc:false,startTimeUtc:'2027-03-20T20:00:00.000Z'};
assert.deepEqual(api.qualify(exact),exact,'A verified exact start survives the old calendar review');
const normalized=identity.normalizeCore(exact);assert.equal(normalized.date,'2027-03-21');assert.equal(normalized.dateOnly,false);assert(!normalized.displayDateLabel);assert(!normalized.endDate,'Old venue day cannot become a backwards Sydney range');assert.match(timing.presentation(normalized).fullSchedule,/21 MAR.*Sydney time/);
for(const status of ['completed','live','cancelled','postponed']){const event={...calendar,status,result:{score:'Retained outcome'}};assert.deepEqual(api.qualify(event),event);}
assert.deepEqual(api.qualify({...calendar,scheduleStatus:'cancelled'}),{...calendar,scheduleStatus:'cancelled'});assert.throws(()=>api.qualify({...seed,sportDomainId:'sport:tennis'}));
const later={...calendar,date:'2027-03-22',sourceCheckedAt:'2026-10-03T21:36:13.000Z'};assert.deepEqual(api.qualify(later),later,'A later verified source reschedule survives');
const offsetObservation={...later,sourceCheckedAt:'2026-10-04T08:36:13+11:00'};assert.deepEqual(api.qualify(offsetObservation),offsetObservation,'A genuine offset-form observation also survives');
const custom={...seed,fullSpiel:'A reviewed current narrative.',editorialNarrative:{researchedAt:'2026-08-29T23:56:41.761Z'}};assert.equal(api.qualify(custom).fullSpiel,custom.fullSpiel);assert.deepEqual(api.qualify(custom).editorialNarrative,custom.editorialNarrative);
const hookRow=review.events.find(row=>row.id==='evt_101');
const ownedHook={...calendar,id:hookRow.id,sourceUrl:hookRow.sourceUrl,sourceCheckedAt:review.checkedAt,selectedSentence:hookRow.preview,fullSpiel:hookRow.preview,storyline:{hookSpoilerOff:hookRow.preview,hookSpoilerOn:hookRow.preview,synopsisSpoilerOff:hookRow.preview,synopsisSpoilerOn:hookRow.preview}};
const shortened=api.qualify(ownedHook);assert.equal(shortened.selectedSentence,hookRow.hook);assert.equal(shortened.fullSpiel,ownedHook.fullSpiel);assert.equal(shortened.sourceCheckedAt,ownedHook.sourceCheckedAt);assert.equal(shortened.storyline.synopsisSpoilerOff,ownedHook.fullSpiel);assert.deepEqual(api.qualify(shortened),shortened);
const independentlyReviewed={...ownedHook,selectedSentence:'A separate reviewed hook.'};assert.equal(api.qualify(independentlyReviewed).selectedSentence,independentlyReviewed.selectedSentence,'Calendar owner must not shorten independently reviewed copy');
const code={id:'sport:skiing',slug:'skiing'};for(const key of ['ski','skiing','snow'])assert(inspector.eventMatchesCode({key},code));assert(!inspector.eventMatchesCode({key:'skinny'},code));assert(!inspector.eventMatchesCode({key:'ski',sportDomainId:'sport:tennis'},code));assert(!inspector.eventMatchesCode({key:'nfl',name:'Skiing highlights'},code));
for(const mutation of [r=>r.events.pop(),r=>r.events[1]=r.events[0],r=>r.events[0].sourceUrl='https://example.test/DB/general/event-details.html',r=>r.events[0].sourceRaceIds=[999],r=>r.events[0].date='2027-02-30',r=>r.events[0].startTimeUtc='2027-03-06T12:00:00.000Z',r=>r.checkedAt='2099-01-01T00:00:00.000Z']){const invalid=clone(review);mutation(invalid);assert.throws(()=>api.validate(invalid));}
// Exercise the real persistent writer in isolation: no partial writes or ID additions.
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'ns-ski-review-'));
try{
 const events=review.events.map(row=>({...seed,id:row.id})),other={id:'unrelated-fixture',key:'tennis',sourceCheckedAt:'2020-01-01T00:00:00.000Z'};
 const files=['feeds/incoming/events.json','data/events.json'];for(const f of files){fs.mkdirSync(path.dirname(path.join(temporary,f)),{recursive:true});fs.writeFileSync(path.join(temporary,f),JSON.stringify({events:[...events,other]}));}
 assert(api.applyRetained({root:temporary}).every(s=>s.changed.length===4));const first=files.map(f=>fs.readFileSync(path.join(temporary,f),'utf8'));
 assert(api.applyRetained({root:temporary}).every(s=>s.changed.length===0));assert.deepEqual(files.map(f=>fs.readFileSync(path.join(temporary,f),'utf8')),first);
 assert.deepEqual(JSON.parse(first[0]).events.at(-1),other);
 const broken=JSON.parse(first[1]);broken.events.pop();broken.events.pop();fs.writeFileSync(path.join(temporary,files[1]),JSON.stringify(broken));assert.throws(()=>api.applyRetained({root:temporary}));assert.equal(fs.readFileSync(path.join(temporary,files[0]),'utf8'),first[0]);
}finally{fs.rmSync(temporary,{recursive:true,force:true});}
if(!process.argv.includes('--unit-only')){
 for(const file of ['feeds/incoming/events.json','data/events.json']){
  const document=JSON.parse(fs.readFileSync(path.join(root,file)));for(const row of review.events){const event=document.events.find(e=>e.id===row.id);assert(event,`${file}: existing Skiing ID missing`);assert.deepEqual(api.qualify(event),event,`${file}: review not applied or a later observation regressed`);if(event.timingProvenance?.precision==='venue-calendar'&&event.sourceCheckedAt===review.checkedAt){assert.equal(event.displayDateLabel,row.dateLabel);assert.equal(event.timeTbc,true);assert.equal(event.startTimeUtc,null);assert.equal(policy.timing(event),null);assert(!/FIS broadcast/.test(event.broadcaster||''));assert(!/Watch via FIS broadcast/.test(event.fullSpiel||''));}}
 }
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'data/code-inspector/manifest.json'))),entry=manifest.codes.find(c=>c.id==='sport:skiing');assert.equal(entry.fixtureCount,4);assert.notEqual(entry.coverageStatus,'complete','Four appointments are not full Skiing coverage');
 const chunk=JSON.parse(fs.readFileSync(path.join(root,entry.chunkPath)));assert.equal(chunk.fixtures.length,4);assert(chunk.fixtures.filter(f=>f.timePrecision==='date-only').every(f=>f.dateOnly&&f.time===null&&policy.timing(f)===null&&f.participantSlots.length===0));
}
assert(require('./quick-results').projectionSteps(['Skiing calendar review']).some(args=>args[0]==='scripts/publish-feed.js'),'Quick review changes must publish their projections');
assert(require('./update-cards').buildSteps({localOnly:true}).some(args=>args[0]==='scripts/lib/skiing-calendar-review.js'),'Full refresh must retain this review');
console.log('Skiing calendar integrity: reviewed dates, venue/Sydney uncertainty, exact recovery, statuses, IDs, real persistence, invalid inputs, aliases and canonical ownership pass.');
