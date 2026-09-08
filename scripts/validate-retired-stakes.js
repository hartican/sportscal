#!/usr/bin/env node
"use strict";
const assert=require('node:assert/strict'),engine=require('../config/enrichment-engine'),major=require('../config/major-events');
const event={id:'same',key:'rugby',name:'Test match',date:'2026-09-10',time:'20:00'};
assert.deepEqual(engine.enrichEvent({...event,stakesScore:1,storyline:{stakes:1}}),engine.enrichEvent({...event,stakesScore:5,storyline:{stakes:5}}),'legacy stakes must not affect active enrichment');
assert.deepEqual(engine.rankEvents([{...event,id:'late',startTimeUtc:'2026-09-10T12:00:00Z',stakesScore:5},{...event,id:'early',startTimeUtc:'2026-09-10T10:00:00Z',stakesScore:1}]).map(row=>row.event.id),['early','late']);
const parent={id:'major-event:us-open-2026',kind:'tournament',name:'US Open',sportKey:'tennis',startDate:'2026-08-23',endDate:'2026-09-13'};
assert(major.visibleRecords({events:[parent]},['tennis'],new Date('2026-09-08T00:00:00Z')).events.length,'an event parent does not need a stakes score');
console.log('Retired stakes: enrichment, chronology and event-parent admission are independent of legacy scores.');
