#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),timing=require('../config/card-timing'),owner=require('../lib/tennis-scoreboard');
const capture=require('./fixtures/tennis-played-starts-20261013.json'),catalogue=require('../data/canonical/tennis-catalogue-2026.json');
const now=new Date(capture.checkedAt),parse=payload=>owner.parse(payload,{tour:'atp',checkedAt:capture.checkedAt,now,catalogue,requestUrl:capture.sourceUrl}).fixtures;
const rows=parse(capture.payload),first=rows.find(e=>e.tennisProviderMatchId==='184950'),second=rows.find(e=>e.tennisProviderMatchId==='184951');
assert.equal(first.actualStartTimeUtc,'2026-10-13T04:10:00.000Z','completed valid-time ESPN startDate reaches the fixture');
assert.equal(second.actualStartTimeUtc,'2026-10-13T05:55:00.000Z');
assert.equal(first.startTimeUtc,null,'actual start is separate from a scheduled/reminder clock');
const planned={...first,actualStartTimeUtc:undefined,actualStartEvidence:undefined,startTimeUtc:'2026-10-13T04:00:00Z',timePrecision:'not-before',timeTbc:false,status:'scheduled',timingEvidence:{clockAssociation:'official-order-of-play'}};
const played=owner.merge([planned],[first],{now})[0];assert.equal(played.startTimeUtc,planned.startTimeUtc);assert.equal(played.timePrecision,'not-before');
assert.equal(timing.presentation(played,now).time,'REPORTED START 3:10 PM');assert(!/NOT BEFORE|Scheduled/.test(timing.presentation(played,now).ariaLabel));
assert.equal(timing.minimised(played,now).time,'REPORTED START 15:10 · FINISHED','compact cards also qualify the publisher-reported start');
assert.match(timing.presentation(planned,now).time,/NOT BEFORE 3:00 PM/,'upcoming lower bounds stay qualified');
assert.equal(timing.presentation({...planned,status:'completed'},now).time,'SCHEDULED NOT BEFORE 3:00 PM','scheduled lower bound remains a labelled lower bound');
assert.equal(timing.presentation({...planned,status:'completed',timePrecision:'exact'},now).time,'SCHEDULED 3:00 PM','a scheduled exact clock is not actual-play evidence');
assert.equal(timing.actualStart({...played,cardType:'tennis_parent'},now),null,'a tournament overview is not an individual played match');
assert.match(timing.presentation({...played,status:'COMPLETED'},now).time,/REPORTED START/,'source status case does not restore obsolete qualifiers');
for(const [raw,expected] of [['2026-10-13T04:12:29Z','REPORTED START 3:12 PM'],['2026-10-13T04:12:30Z','REPORTED START 3:12 PM'],['2026-10-13T04:17:31Z','REPORTED START 3:17 PM']]){
 const e={...played,actualStartTimeUtc:raw,actualStartEvidence:{...played.actualStartEvidence,startsAt:raw}},before=JSON.stringify(e);assert.equal(timing.presentation(e,now).time,expected);assert.equal(JSON.stringify(e),before,'display rounding preserves raw source precision');
}
for(const patch of [{verified:false},{fixtureId:'other'},{sourceUrl:'javascript:alert(1)'},{sourceUrl:'https://a:b@example.com/'},{participantIds:[]},{checkedAt:'2026-12-01T00:00:00Z'}])assert.equal(timing.actualStart({...played,actualStartEvidence:{...played.actualStartEvidence,...patch}},now),null,'invalid actual-start evidence cannot establish a clock');
for(const change of [m=>m.timeValid=false,m=>delete m.startDate,m=>m.startDate='2026-02-30T04:10Z',m=>m.startDate='2026-10-13T04:10',m=>m.startDate='2026-10-14T04:10Z',m=>{m.status.type.name='STATUS_SCHEDULED';m.status.type.completed=false;}]){
 const bad=structuredClone(capture.payload);change(bad.events[0].groupings[0].competitions[0]);assert.equal(parse(bad)[0].actualStartTimeUtc,undefined,'invalid, conflicting or pre-match clocks cannot become actual starts');
}
const repeated=owner.merge([played],[{...first,actualStartEvidence:{...first.actualStartEvidence,checkedAt:new Date(+now+60000).toISOString()}}],{now:new Date(+now+60000)})[0];assert.deepEqual(repeated.actualStartEvidence,played.actualStartEvidence,'unchanged observations retain first actual-start verification');
assert.equal(require('../config/fixture-reminder-policy').timing(first,now),null,'actual historical start cannot create a reminder');
console.log('Played starts: captured publisher clocks, separate schedule facts, explicit publisher minutes, obsolete qualifiers, bad evidence and unchanged receipts passed.');
