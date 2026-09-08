#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),identity=require("../config/fixture-identity"),calendar=require("../config/calendar-export");
const rows=[
  {id:"first",key:"tennis",courtId:"ashe",sessionStartTimeUtc:"2026-09-08T15:00:00Z",startTimeUtc:"2026-09-08T15:00:00Z",timePrecision:"exact",sequenceInSession:0,bestOf:5},
  {id:"second",key:"tennis",courtId:"ashe",sessionStartTimeUtc:"2026-09-08T15:00:00Z",timePrecision:"follows",sequenceInSession:1,bestOf:3},
  {id:"other-court",key:"tennis",courtId:"armstrong",sessionStartTimeUtc:"2026-09-08T15:00:00Z",timePrecision:"follows",sequenceInSession:1},
];
const estimated=identity.estimateTimeline(rows);
assert.equal(estimated[1].estimatedStartTimeUtc,"2026-09-08T18:10:00.000Z");
assert.equal(estimated[1].timePrecision,"estimated");assert.equal(estimated[1].startTimeUtc,undefined,"an estimate must not become an exact start");
assert.equal(estimated[1].date,"2026-09-09");assert.equal(estimated[1].time,"04:10");
assert.equal(estimated[2].estimatedStartTimeUtc,"2026-09-08T15:00:00.000Z","another court cannot inherit the first court's delay");
assert.equal(calendar.eventStart(estimated[1]).toISOString(),"2026-09-08T18:10:00.000Z");
const finished=identity.estimateTimeline([{...rows[0],status:"completed",actualEndTimeUtc:"2026-09-08T16:45:00Z"},rows[1]]);
assert.equal(finished[1].estimatedStartTimeUtc,"2026-09-08T16:55:00.000Z");
const bounded=identity.estimateTimeline([rows[0],{...rows[1],notBeforeTimeUtc:"2026-09-08T20:00:00Z"}]);
assert.equal(bounded[1].estimatedStartTimeUtc,"2026-09-08T20:00:00.000Z");
assert.deepEqual(identity.estimateTimeline(estimated),estimated,"estimation is idempotent");
const women=identity.estimateTimeline([{...rows[0],bestOf:undefined,gender:'women',competitionId:'competition:us-open-2026'},rows[1]]);
assert.equal(women[1].estimatedStartTimeUtc,'2026-09-08T16:55:00.000Z',"women's Grand Slam singles use best-of-three, not the men's substring");
const overrun=identity.estimateTimeline([{...rows[0],status:'live'},rows[1]],{now:new Date('2026-09-08T19:00:00Z')});
assert.equal(overrun[1].estimatedStartTimeUtc,'2026-09-08T19:25:00.000Z','a still-live prior match pushes an overrun estimate forward');
assert.equal(identity.retainedInActiveTimeline({date:'2026-08-26'},new Date('2026-09-08T05:00:00Z')),false);
assert.equal(identity.retainedInActiveTimeline({date:'2026-09-01'},new Date('2026-09-08T05:00:00Z')),true);
assert.equal(identity.retainedInActiveTimeline({date:'2026-08-20',endDate:'2026-09-10'},new Date('2026-09-08T05:00:00Z')),true);
assert.equal(identity.retainedInActiveTimeline({date:'2026-09-28'},new Date('2026-10-04T14:00:00Z')),true,'seven local calendar days across DST');
assert.equal(identity.retainedInActiveTimeline({date:'2026-09-27'},new Date('2026-10-04T14:00:00Z')),false);
assert.equal(identity.normalizeCore({round:'Quarterfinal',sourceUrl:'https://www.usopen.org/schedule'}).consensusTags[0].label,'Knockout');
assert.deepEqual(identity.normalizeCore({name:'Imaginary Derby',round:'Final'}).consensusTags,[],'unsourced names cannot create consensus labels');
assert.equal(identity.normalizeCore({id:'malformed',sources:{},consensusTags:'bad',editorialPreview:{consensusTags:{}}}).id,'malformed','optional tag data cannot erase a fixture');
assert.deepEqual(identity.consensusTagsForEvent({consensusTags:[{label:'Epic',confidence:1,sourceUrls:['https://example.com']},{label:'Rivalry',confidence:.4,sourceUrls:['https://example.com']}]}),[],'editorial cannot fabricate a user rating tag or low-confidence consensus');
console.log("Fixture timing: court chains, formats, progress, not-before, approximate starts and local-day retention passed.");
