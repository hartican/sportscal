'use strict';
const assert=require('node:assert/strict'),timing=require('../config/card-timing'),policy=require('../config/fixture-reminder-policy'),owner=require('../lib/tennis-scoreboard'),planning=require('../lib/publisher-start-estimates');
const receipts=require('./fixtures/publisher-planning-tennis-20261014.json'),catalogue=require('../data/canonical/tennis-catalogue-2026.json');
const parse=r=>owner.parse(r.payload,{tour:r.tour,checkedAt:r.checkedAt,now:new Date(r.checkedAt),requestUrl:r.sourceUrl,catalogue}).fixtures;
const rows=receipts.flatMap(parse),wta=rows.find(e=>e.tennisProviderMatchId==='185357'),atp=rows.find(e=>e.tennisProviderMatchId==='184954'),now=new Date(receipts[0].checkedAt);
assert(wta&&atp);assert.equal(wta.startTimeUtc,null);assert.equal(wta.timePrecision,'estimated');
assert.equal(timing.presentation(wta,now).time,'APPROX. 10:00 PM');assert.equal(timing.minimised(wta,now).time,'APPROX. 22:00');
assert.equal(timing.presentation(atp,now).time,'TIME TBC','A TBD provider timestamp cannot become a match estimate');
const baseline={...wta,planningTimeEvidence:null,timePrecision:'unresolved',scheduleStatus:'unresolved',timeTbc:true,time:null};
assert.equal(planning.apply(baseline,wta.planningTimeEvidence,now).timePrecision,'estimated');
for(const changes of [{dateOnly:true},{tournamentParent:true},{majorEventMarker:true},{participantsConfirmed:false},{status:'completed'},{status:'live'},{status:'postponed'},{scheduleStatus:'withdrawn'},{manualEstimateHeld:true},{sessionOrderEvidence:{}},{estimatedStartTimeUtc:'2026-10-14T12:00:00.000Z'}]){const e={...baseline,...changes};assert.strictEqual(planning.apply(e,wta.planningTimeEvidence,now),e,JSON.stringify(changes));}
for(const changes of [{fixtureId:atp.id},{participantIds:atp.participantIds},{sourceUrl:'javascript:alert(1)'},{sourceUrl:'https://a:b@example.com'},{checkedAt:'2026-10-15T00:00:00Z'},{checkedAt:'2026-02-30T00:00:00Z'},{startsAt:'2026-10-14T11:00:00'},{timeTbc:true}])assert.strictEqual(planning.apply(baseline,{...wta.planningTimeEvidence,...changes},now),baseline,JSON.stringify(changes));
assert.strictEqual(planning.apply(baseline,wta.planningTimeEvidence,'2026-10-14T11:00:00Z'),baseline,'An elapsed estimate is not re-admitted');
for(const invalid of ['2026-02-30T11:00Z','2026-10-14T25:00Z','2026-10-14T11:00','2026-10-14'])assert(Number.isNaN(planning.instant(invalid)));
assert(planning.displayedClockAgrees('Wed, October 14th at 7:00 AM EDT','2026-10-14T11:00Z'));assert.equal(planning.displayedClockAgrees('Wed, October 13th at 7:00 AM EDT','2026-10-14T11:00Z'),false,'A conflicting display day cannot establish a planning clock');assert.equal(planning.displayedClockAgrees('TBD','2026-10-14T11:00Z'),false);
const changedReceipt=structuredClone(receipts[0]);changedReceipt.payload.events[0].groupings[0].competitions[0].status.type.detail='TBD';changedReceipt.payload.events[0].groupings[0].competitions[0].status.type.shortDetail='TBD';
const cleared=parse(changedReceipt)[0];assert.equal(cleared.timePrecision,'unresolved');assert.equal(cleared.timeTbc,true);
const retracted=owner.merge([wta],[cleared],{now})[0];assert.equal(retracted.planningTimeEvidence,null);assert.equal(timing.presentation(retracted,now).time,'TIME TBC','A later explicit TBD retracts a displayed estimate');
const later={...wta,planningTimeEvidence:{...wta.planningTimeEvidence,checkedAt:'2026-10-13T13:30:00.000Z'}};assert.equal(owner.merge([wta],[later],{now:new Date(later.planningTimeEvidence.checkedAt)})[0].planningTimeEvidence.checkedAt,wta.planningTimeEvidence.checkedAt,'Unchanged planning facts retain their original observation');
assert.equal(policy.timing(wta,now),null);assert.equal(policy.manualTiming(wta,now),null,'Publisher planning does not expand reminder timing policy');
const compact=require('../config/match-centre').compact(wta);assert.equal(compact.startTimeTbc,false,'A selected publisher estimate clears only the display uncertainty flag; original UTC stays null');assert.equal(timing.presentation(compact,now).time,'APPROX. 10:00 PM','Existing selected projection carries the estimate separately');
const elapsed=new Date(Date.parse(wta.estimatedStartTimeUtc)+60000);assert.equal(require('../config/feed-timeline').status(wta,elapsed),'unknown','Elapsed publisher estimate cannot close the fixture');assert.equal(require('../config/feed-controls').timingState(wta,elapsed).key,'awaiting-update');assert.equal(require('../config/card-timing').presentation(wta,elapsed).status,'Awaiting match update');
const refreshedReceipt={...receipts[0],checkedAt:elapsed.toISOString()};
const refreshed=parse(refreshedReceipt)[0];assert.equal(refreshed.planningTimeEvidence,null,'First observation after its estimate passes is not admitted');
const refreshMerged=owner.merge([wta],[refreshed],{now:elapsed})[0];
assert.deepEqual(refreshMerged.planningTimeEvidence,wta.planningTimeEvidence,'An ordinary unchanged refresh retains an already admitted estimate and its original receipt');
assert.equal(require('../config/feed-timeline').status(refreshMerged,elapsed),'unknown');
assert.equal(refreshMerged.status,'scheduled');assert.equal(require('../config/feed-controls').isLiveNow(refreshMerged,elapsed),false,'An ordinary refresh after an estimate cannot invent play');
assert.equal(timing.presentation(refreshMerged,elapsed).status,'Awaiting match update','A real source refresh cannot remove the awaiting label');
assert.equal(refreshMerged.startTimeUtc,null);assert.equal(policy.timing(refreshMerged,elapsed),null);assert.equal(policy.manualTiming(refreshMerged,elapsed),null);
assert.notEqual(require('../config/match-centre').liveState(refreshMerged,+elapsed),'playing');assert.equal(timing.presentation(require('../config/match-centre').compact(refreshMerged),elapsed).status,'Awaiting match update');
const firstElapsed=owner.merge([],[refreshed],{now:elapsed})[0];assert.equal(firstElapsed.planningTimeEvidence,null);assert.equal(timing.presentation(firstElapsed,elapsed).time,'TIME TBC');
assert.equal('publisherPlanningReceipt' in firstElapsed,false,'The transient parse receipt is not published');assert.equal('publisherPlanningReceipt' in refreshMerged,false);
const reversedReceipt=structuredClone(refreshedReceipt);for(const p of reversedReceipt.payload.events[0].groupings[0].competitions[0].competitors)p.order=3-p.order;
const reversedRefresh=owner.merge([wta],parse(reversedReceipt),{now:elapsed})[0];assert.deepEqual(reversedRefresh.planningTimeEvidence,wta.planningTimeEvidence,'A provider side-order change cannot erase the same bound match estimate');assert.equal(timing.presentation(reversedRefresh,elapsed).status,'Awaiting match update');
for(const changes of [{sourceUrl:'https://other.example/match'},{checkedAt:'2026-10-15T00:00:00Z'},{checkedAt:'2026-02-30T00:00:00Z'},{participantIds:atp.participantIds}])assert.strictEqual(planning.retainElapsed(wta,refreshed,{...refreshed.publisherPlanningReceipt,...changes},elapsed),refreshed,'Invalid or changed source evidence cannot retain an elapsed estimate');
const expiredTbd=owner.merge([refreshMerged],parse({...changedReceipt,checkedAt:elapsed.toISOString()}),{now:elapsed})[0];assert.equal(expiredTbd.planningTimeEvidence,null);assert.equal(timing.presentation(expiredTbd,elapsed).time,'TIME TBC','Explicit TBD retracts even a previously admitted elapsed estimate');
const cancelledReceipt=structuredClone(refreshedReceipt);cancelledReceipt.payload.events[0].groupings[0].competitions[0].status.type.name='STATUS_CANCELED';const cancelled=owner.merge([refreshMerged],parse(cancelledReceipt),{now:elapsed})[0];assert.equal(cancelled.status,'cancelled');assert.equal(cancelled.planningTimeEvidence,null);assert.equal(policy.timing(cancelled,elapsed),null,'A source-confirmed cancellation cannot retain an estimate or alert');
const rescheduledReceipt=structuredClone(refreshedReceipt),rescheduledMatch=rescheduledReceipt.payload.events[0].groupings[0].competitions[0];rescheduledMatch.date='2026-10-14T12:00Z';rescheduledMatch.status.type.detail='Wed, October 14th at 8:00 AM EDT';rescheduledMatch.status.type.shortDetail='10/14 - 8:00 AM EDT';
const rescheduled=owner.merge([refreshMerged],parse(rescheduledReceipt),{now:elapsed})[0];assert.equal(rescheduled.planningTimeEvidence.startsAt,'2026-10-14T12:00:00.000Z');assert.equal(rescheduled.planningTimeEvidence.checkedAt,elapsed.toISOString());assert.equal(timing.presentation(rescheduled,elapsed).time,'APPROX. 11:00 PM');
rescheduledMatch.date='2026-10-14T10:00Z';rescheduledMatch.status.type.detail='Wed, October 14th at 6:00 AM EDT';rescheduledMatch.status.type.shortDetail='10/14 - 6:00 AM EDT';
assert.equal(owner.merge([refreshMerged],parse(rescheduledReceipt),{now:elapsed})[0].planningTimeEvidence,null,'A different elapsed time is not a newly admitted estimate');
assert.notEqual(require('../config/match-centre').liveState(wta,+new Date(wta.estimatedStartTimeUtc)+60000),'playing','An elapsed estimate cannot establish Live');
const official={...baseline,startTimeUtc:'2026-10-14T10:00:00.000Z',timePrecision:'not-before',scheduleStatus:'confirmed',timeTbc:false};assert.strictEqual(planning.apply(official,wta.planningTimeEvidence,now),official);assert.match(timing.presentation(official,now).time,/NOT BEFORE 9:00 PM/);
assert.strictEqual(planning.retainElapsed(official,refreshed,refreshed.publisherPlanningReceipt,elapsed),refreshed,'An official clock cannot become an elapsed publisher estimate');
const differentSport={...baseline,id:'fixture:football:one',canonicalEventId:'fixture:football:one',eventId:'fixture:football:one',key:'football',sport:'Football'};
assert.match(timing.presentation(planning.apply(differentSport,{...wta.planningTimeEvidence,fixtureId:'fixture:football:one'},now),now).time,/APPROX/,'One shared source rule supports other sporting fixtures');
const prefs={followFirst:{notifications:{autoRemindersEnabled:false}}};assert.equal(policy.automatic(wta,prefs,{},now),false);assert.equal(policy.intent(wta,prefs,{[wta.id]:{reminderChoice:'off'}},{},now).enabled,false);
// Execute the actual deferred UI reconciliation functions, not only its model.
const fs=require('node:fs'),vm=require('node:vm'),acorn=require('acorn'),model=require('../config/match-centre');
const uiSource=fs.readFileSync('assets/js/match-centre-ui.source.js','utf8'),functions=new Map();
function visit(node){if(!node||typeof node!=='object')return;if(node.type==='FunctionDeclaration'&&['planningFields','observations','currentFixture'].includes(node.id?.name))functions.set(node.id.name,uiSource.slice(node.start,node.end));for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}
visit(acorn.parse(uiSource,{ecmaVersion:'latest'}));assert.equal(functions.size,3,'Actual Match Centre planning reconciliation functions exist');
for(const next of [retracted,rescheduled,{...official,id:wta.id,planningTimeEvidence:null},refreshMerged]){
 const snapshot=model.compact(next),context={m:()=>model,scores:new Map([[model.id(wta),snapshot]]),membership:[wta],membershipOwner:'controlled',owner:()=> 'controlled',selectedView:'everything'};
 vm.runInNewContext([...functions.values()].join('\n')+'\nglobalThis.actualObservations=observations();globalThis.actualCurrent=currentFixture(membership[0]);',context);
 const expected=model.observation(model.compact(wta),snapshot);
 for(const actual of [context.actualObservations[0],context.actualCurrent])for(const field of ['startTimeUtc','estimatedStartTimeUtc','planningTimeEvidence','timePrecision','scheduleStatus','timeTbc','startTimeTbc','time','date'])assert.deepEqual(JSON.parse(JSON.stringify(actual[field]??null)),JSON.parse(JSON.stringify(expected[field]??null)),'Actual UI carries current planning field '+field);
}
(async()=>{
 let reads=0;const fetchImpl=async()=>{reads++;return new Response(JSON.stringify(receipts[0].payload),{status:200,headers:{date:elapsed.toUTCString()}});};
 const adapter=require('../lib/live-tennis-scoreboard').sources({fetchImpl}).find(s=>s.id==='live-tennis-wta');
 const liveRows=await adapter.fetch({now:elapsed,previous:[wta]});const live=liveRows.find(e=>e.id===wta.id);
 assert.equal(reads,1,'The real shared adapter keeps its single source request');assert.deepEqual(live.planningTimeEvidence,wta.planningTimeEvidence);assert.equal(timing.presentation(live,elapsed).status,'Awaiting match update');assert.equal(require('../config/feed-timeline').status(live,elapsed),'unknown');assert.equal(live.startTimeUtc,null);assert.equal(policy.timing(live,elapsed),null);assert.equal(policy.manualTiming(live,elapsed),null);assert.equal('publisherPlanningReceipt' in live,false);
 assert.equal(policy.intent(live,prefs,{[live.id]:{reminderChoice:'off'}},{},elapsed).enabled,false,'An ordinary estimate refresh cannot undo OFF');
 console.log('Publisher planning: captured estimate, ordinary refresh/adapter awaiting continuity, first-elapsed rejection, TBD retraction, changed-clock handling, original receipts, official priority and unchanged reminder/OFF rules passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
