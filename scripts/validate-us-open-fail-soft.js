#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),source=require('./refresh-us-open-events');
const day={message:'Tuesday, September 8',tournDay:16},court={courtName:'Arthur Ashe Stadium',startEpoch:1788883200};
const match={match_id:'missing-flag',eventCode:'MS',roundName:'Quarterfinal',team1:[{firstNameA:'Known',lastNameA:'Player',idA:'atpunknown'}],team2:[{firstNameA:'Other',lastNameA:'Player',idA:'atpother',nationA:'AUS'}],order:2};
const fixture=source.fixtureFromMatch(match,court,day,'https://www.usopen.org/schedule','2026-09-08T00:00:00Z');
assert.equal(fixture.matchupSides[0].players[0].name,'Known Player');assert.equal(fixture.matchupSides[0].players[0].nationalityCode,null,'unknown flag, not guessed nationality');
const tbc={...match,match_id:'tbc-player',team1:[],team2:[]};assert.equal(source.isPublishedMatch(tbc),true,'an announced fixture does not require named opponents');
assert.match(source.fixtureFromMatch(tbc,court,day,'https://www.usopen.org/schedule','2026-09-08T00:00:00Z').name,/TBC/);
assert.equal(source.isPublishedMatch({...tbc,match_id:'0'}),false,'spacer rows stay excluded');
assert.equal(require('../config/follow-feed-policy').isMarquee({...fixture,key:'tennis'}),true);
assert.equal('stakesScore' in fixture,false,'new US Open fixtures never generate retired stakes scores');
const partial=source.fixturesFromSnapshot({schemaVersion:'us-open-official-schedule-snapshot.v1',capturedAt:'2026-09-08T00:00:00Z',scheduleDays:{eventDays:[{...day,feedUrl:'https://www.usopen.org/schedule'}]},scheduleFeeds:[{sourceUrl:'https://www.usopen.org/schedule',payload:{courts:[{...court,startEpoch:1e300,matches:[match]}]}}]})[0];
assert.equal(partial.sourceQuality,'partial');assert(partial.id&&partial.name&&partial.date,'broken optional timing still emits the core card');
const schema=require('../schemas/major-events.schema.json');
assert(!schema.$defs.subEvent.required.includes('stakesScore'),'publication schema does not reintroduce a stakes gate');
console.log('US Open fail-soft: unnamed players and unknown flags retain published quarterfinal cards; spacer rows remain excluded.');
