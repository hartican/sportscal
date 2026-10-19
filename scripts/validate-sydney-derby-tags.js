#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const identity=require('../config/fixture-identity');
const schedule=require('../data/football/fixtures/a-league-men.json');
const fixture=schedule.events.find(event=>event.officialMatchId==='4e0451akfpt8wphhcwc1y47pw');
assert(fixture,'retained Sydney derby fixture exists');
const before=JSON.stringify(fixture);
const labels=event=>identity.consensusTagsForEvent(event).map(tag=>tag.label);
const reverse=event=>({...event,participantIds:[...event.participantIds].reverse(),homeParticipantId:event.awayParticipantId,awayParticipantId:event.homeParticipantId,participants:[...event.participants].reverse()});
for(const event of [fixture,reverse(fixture)])assert(labels(event).includes('Derby'),'both Sydney FC/WSW orientations must be Derby');
for(const names of [['Sydney FC','Western Sydney Wanderers'],['Western Sydney','Sydney FC']]){
 const event={...fixture,participantIds:[],homeParticipantId:null,awayParticipantId:null,participants:names.map(name=>({name}))};
 assert(labels(event).includes('Derby'),'exact reviewed participant names must resolve the derby');
}
for(const label of ['Rivalry','Round-Robin','Knockout','Final','Record Chase']){
 const tag={label,confidence:.8,sourceUrls:['https://example.test/retained-review']};
 assert.deepEqual(identity.consensusTagsForEvent({...fixture,consensusTags:[tag]}).find(t=>t.label===label),tag);
}
assert.equal(identity.consensusTagsForEvent({...fixture,consensusTags:[{label:'Derby',confidence:.95,sourceUrls:['https://example.test/stronger-review']}]}).filter(t=>t.label==='Derby').length,1);
for(const event of [
 {...fixture,competitionId:'competition:other'},
 {...fixture,competitionId:'competition:a-league-women'},
 {...fixture,participantIds:['team:football:sydney-fc','team:football:club:macarthur-fc'],awayParticipantId:'team:football:club:macarthur-fc'},
 {...fixture,participantIds:['team:football:sydney-fc','team:football:sydney-fc'],awayParticipantId:'team:football:sydney-fc'},
 {...fixture,participantIds:['team:football:sydney-fc-women','team:football:western-sydney-wanderers-women']},
 {...fixture,participantIds:[],homeParticipantId:null,awayParticipantId:null,participants:[{name:'Sydney Olympic'},{name:'Western Sydney Wanderers'}]},
 {...fixture,participantIds:[],homeParticipantId:null,awayParticipantId:null,participants:[],name:'Sydney FC v Western Sydney Wanderers'},
 {...fixture,sourceUrl:null,sourceUrls:[],sources:[]},
])assert(!labels(event).includes('Derby'),'competition, contradictory identities, unknown names and absent source evidence must not infer a derby');
// Every supplied strong representation must agree; names cannot repair it.
const pair=fixture.participantIds,other='team:football:club:macarthur-fc';
const aliasOnly={...fixture,participantIds:[],homeParticipantId:null,awayParticipantId:null,participants:[{name:'Sydney FC'},{name:'Western Sydney'}]};
const contradictions=[
 {name:'top-level pair versus object IDs',event:{...fixture,participants:[{id:pair[0]},{id:other}]}},
 {name:'top-level pair versus object participantId',event:{...fixture,participants:[{participantId:pair[0]},{participantId:other}]}},
 {name:'object id versus participantId',event:{...fixture,participants:[{id:pair[0],participantId:pair[1]},{id:pair[1]}]}},
 {name:'top-level pair versus slot IDs',event:{...fixture,participantSlots:[{participantId:pair[0]},{participantId:other}]}},
 {name:'aliases versus slot IDs',event:{...aliasOnly,participantSlots:[{participantId:pair[0]},{participantId:other}]}},
 {name:'partial object group',event:{...fixture,participants:[{id:pair[0]},{name:'Western Sydney'}]}},
 {name:'partial slot group',event:{...aliasOnly,participantSlots:[{participantId:pair[0]},{}]}},
 {name:'partial home-away group',event:{...fixture,awayParticipantId:null}},
 {name:'partial top-level group',event:{...fixture,participantIds:[pair[0]]}},
 {name:'unknown top-level group',event:{...aliasOnly,participantIds:['unknown',pair[1]]}},
];
for(const {name,event} of contradictions){
 assert(!labels(event).includes('Derby'),name+' must reject direct classification');
 assert(!identity.normalizeCore(event).consensusTags.some(tag=>tag.label==='Derby'),name+' must reject ordinary normalization');
}
const previouslyClassified=identity.normalizeCore(fixture);
const changedIdentities={...previouslyClassified,participantSlots:[{participantId:pair[0]},{participantId:other}]};
assert(!labels(changedIdentities).includes('Derby'),'a prior pair-derived tag must not bypass later conflicting identities');
assert(!identity.normalizeCore(changedIdentities).consensusTags.some(tag=>tag.label==='Derby'),'ordinary renormalization must revalidate its own pair-derived tag');
for(const event of [
 {...fixture,participants:pair.map(id=>({id,participantId:id})),participantSlots:[...pair].reverse().map(participantId=>({participantId}))},
 {...aliasOnly,participantSlots:pair.map(participantId=>({participantId}))},
 aliasOnly,
]){
 assert(labels(event).includes('Derby'),'consistent identities or alias-only participants classify directly');
 assert(identity.normalizeCore(event).consensusTags.some(tag=>tag.label==='Derby'),'consistent identities or alias-only participants classify through normalization');
}
assert.equal(JSON.stringify(fixture),before,'classification must not alter retained fixture facts');
const normalized=identity.normalizeCore(fixture);
assert(normalized.consensusTags.some(tag=>tag.label==='Derby'),'ordinary normalization surfaces Derby');
assert.equal(normalized.startTimeUtc,fixture.startTimeUtc);assert.equal(normalized.status,fixture.status);assert.equal(normalized.homeScore,fixture.homeScore);assert.equal(normalized.awayScore,fixture.awayScore);
assert.equal(schedule.events.length,156);
assert.equal(require('../data/canonical/football-directory.v1.json').teams.filter(t=>t.leagueId==='competition:a-leagues').length,12);
console.log('Sydney Derby: both orientations, exact reviewed aliases, competition/identity guards, retained tags, source evidence and unchanged facts passed.');
