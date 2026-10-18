'use strict';
const assert=require('node:assert/strict');
const editorial=require('./lib/editorial-narrative');
const providers=require('../lib/epl-provider-identities');
const registry=require('../data/canonical/epl-provider-identities.v1.json');

// The reviewed provider registry is retained season evidence. Do not depend on
// a historical match remaining in the rolling incoming Feed indefinitely.
const row=registry.fixtures.find(entry=>entry[0]===128980);
assert(row&&row[1]===401879264,'Retain the actual failed primary/secondary binding');
const fixture={id:'epl-2026-27-'+row[0],canonicalEventId:'event:premier-league:'+row[0],
 competitionId:providers.COMPETITION,season:providers.SEASON,key:'premier-league',
 homeParticipantId:'team:football:epl:'+row[2],awayParticipantId:'team:football:epl:'+row[3],
 participantIds:row.slice(2).map(id=>'team:football:epl:'+id)};
const legacy='football-premier-league-2026-27-'+row[1],before=JSON.stringify(fixture);
const index=editorial.projectionRecordIndex([fixture]);
assert.equal(index.get(legacy),fixture,'The actual incoming fixture must resolve its reviewed legacy editorial target');
for(const alias of providers.aliasesForId(fixture.id))assert.equal(index.get(alias),fixture,'Every reviewed provider ID resolves to the original record');
const projection={id:'controlled:reviewed-alias',targetType:'feed-event',targetIds:[legacy]};
assert.equal(editorial.projectionForTarget({eventProjections:[projection]},'feed-event',fixture),projection,'The writer and validator share the reviewed identity rule');
assert.equal(JSON.stringify(fixture),before,'Lookup never rewrites fixture facts, IDs, aliases or clocks');

const another=registry.fixtures.find(entry=>entry[0]!==row[0]);
for(const patch of [
 {competitionId:'competition:unreviewed'}, {season:'2027/28'}, {key:'nrl'},
 {homeParticipantId:fixture.awayParticipantId}, {awayParticipantId:fixture.homeParticipantId},
 {participantIds:fixture.participantIds.slice().reverse()}, {homeParticipantId:null,participantIds:null},
 {canonicalEventId:'event:premier-league:'+another[0]},
 {id:'controlled:unknown',canonicalEventId:'controlled:unknown'}
]){
 const changed={...fixture,...patch},snapshot=JSON.stringify(changed);
 assert.equal(editorial.projectionRecordIndex([changed]).has(legacy),false,'Unreviewed or conflicting fixture context cannot acquire provider aliases');
 assert.equal(JSON.stringify(changed),snapshot);
}
const collision={id:legacy,canonicalEventId:'controlled:distinct-fixture',key:'controlled'};
for(const records of [[fixture,collision],[collision,fixture]]){
 assert.equal(editorial.projectionRecordIndex(records).get(legacy),collision,'An actual identifier retains precedence over a derived alias');
}
console.log('Editorial provider identity: reviewed failed binding and writer/index agreement; scope, sides, ambiguity, mutation and explicit-ID precedence guards passed.');
