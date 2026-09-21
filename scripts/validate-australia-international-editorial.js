#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const pauses=require('../config/coverage-pauses');
const {catalogue}=require('../lib/calendar-catalogue');
const {editorialKey}=require('../lib/fixture-editorial');
const events=catalogue().filter(e=>e.key==='cricket'&&!pauses.womensT20(e)&&e.isInternational&&(e.participantIds||[]).some(id=>/^team:cricket:australia(?:-women)?$/.test(id)));
assert(events.length>20);
const schedule=require('../data/follow-schedule/cricket.json').fixtures;
for(const event of events){
 assert(event.editorialNarrative?.hook&&event.editorialNarrative?.synopsis,`Missing editorial ${event.id}`);
 assert(event.editorialNarrative.sourceIds.length>=2,`Missing provenance ${event.id}`);
 const matches=schedule.filter(e=>e.id===event.id||(e.sourceEventIds||[]).includes(event.id)||(editorialKey(e)&&editorialKey(e)===editorialKey(event)));
 assert(matches.length,`Missing schedule ${event.id}`);
 for(const fixture of matches)assert(fixture.editorialNarrative?.hook,`Schedule drops editorial ${fixture.id}`);
}
for(const id of ['1525655','1525656','1525657']){
 const e=events.find(e=>e.id.endsWith(id));assert(e?.editorialNarrative?.hook);
 const raw=require('../data/follow-sources/coverage.v1.json').events.find(e=>e.id.endsWith(id));
 for(const key of ['id','participantIds','startTimeUtc','sourceUrl','homeParticipantId','awayParticipantId'])assert.deepEqual(e[key],raw[key],`Editorial changed ${key}`);
}
console.log(`${events.length} Australian international source records retain researched editorial in server catalogue and schedules (${new Set(events.map(editorialKey)).size} fixture keys).`);
