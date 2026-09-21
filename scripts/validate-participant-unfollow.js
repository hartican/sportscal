#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const follow=require('../config/follow-first');
const prefs=require('../config/preference-system');
const policy=require('../config/follow-feed-policy');
const {buildServerFeed,normalizeUserFollowState}=require('../lib/server-feed-pipeline');
const {expandedFollowEntityIds}=require('../lib/follow-fixture-resolver');
const {catalogue}=require('../lib/calendar-catalogue');
const now=new Date('2026-09-22T00:00:00Z');
const aus='team:cricket:australia',sa='team:cricket:south-africa';
const preferences=(selected,opponents=[],level='mute')=>({version:22,preferenceGraph:{entityFollows:[...selected.map(participantId=>({participantId,followLevel:'follow'})),...opponents.map(participantId=>({participantId,followLevel:level}))]}});
const odi=catalogue().filter(e=>/^fixture:cricket:espn:152565[567]$/.test(e.id));
assert.equal(odi.length,3);
for(const selected of [[aus],[sa],[aus,sa]]){
 const p=preferences(selected,[aus,sa].filter(id=>!selected.includes(id)));
 assert.equal(buildServerFeed({events:odi,userId:'audit',userState:{preferences:p},now}).events.length,3,'ordinary opponent unfollow must retain all three ODIs');
 for(const e of odi)assert(follow.reasonForEvent(e,p),'shared browser policy must admit either followed team');
}
assert.equal(buildServerFeed({events:odi,userId:'audit',userState:{preferences:preferences([],[aus,sa])},now}).events.length,0);
const migrated=follow.migratePreferences(preferences([aus],[sa]));
assert.equal(migrated.preferenceGraph.entityFollows.find(p=>p.participantId===sa).followLevel,'unfollow');
assert.deepEqual(follow.migratePreferences(migrated),migrated);
assert.equal(normalizeUserFollowState({preferences:migrated}).preferences.preferenceGraph.entityFollows.find(p=>p.participantId===sa).followLevel,'unfollow');
let graph=prefs.setEntityFollow(migrated.preferenceGraph,sa,'follow');
graph=prefs.setEntityFollow(graph,sa,'unfollow');
assert.equal(graph.entityFollows.find(p=>p.participantId===sa).followLevel,'unfollow');
const collections={'collection:test':{memberIds:[aus,sa]}};
const grouped={...migrated,followFirst:{...migrated.followFirst,collectionFollows:['collection:test']}};
assert.equal(follow.effectiveParticipantFollow(sa,grouped,collections).followed,false);
assert(follow.reasonForEvent(odi[0],grouped,{collectionsById:collections}));
const player=require('../data/canonical/football-follow-index.v1.json').players.find(p=>p.currentTeamId);
assert(!expandedFollowEntityIds({preferences:preferences([player.id],[player.currentTeamId])}).has(player.currentTeamId),'team opt-out stops inheritance');
for(const p of [
 {...migrated,preferenceGraph:{...migrated.preferenceGraph,competitionPreferences:[{competitionId:odi[0].competitionId,enabled:false}]}},
 {...migrated,followFirst:{...migrated.followFirst,excludedMajorEventIds:['test-series'],eventFamilyDecisions:{states:{'test-series':'excluded'}}}}
])assert.equal(buildServerFeed({events:[{...odi[0],eventFamilyId:'test-series'}],userId:'audit',userState:{preferences:p},now}).events.length,0,'explicit competition/event exclusions survive');
console.log('Participant unfollow migration, ODI admission, collections, inheritance and exclusions passed.');

const persistence=require('../lib/supabase-server');
const stored=persistence.normalizeUserState({preferences:preferences([aus],[sa]),eventUserState:{kept:{rating:5}}},'audit',now);
assert.equal(stored.preferences.preferenceGraph.entityFollows.find(f=>f.participantId===sa).followLevel,'unfollow','legacy writes migrate before persistence');
assert.equal(persistence.userStateFromRow(stored).preferences.preferenceGraph.entityFollows.find(f=>f.participantId===sa).followLevel,'unfollow','readback retains opt-out');
assert.deepEqual(stored.event_user_state,{kept:{rating:5}},'migration preserves saved actions');

const tennisAlias='competitor:tennis:atp:regression-player',tennisCanonical='athlete:tennis:regression-player';
assert(!expandedFollowEntityIds({preferences:preferences([tennisAlias],[tennisCanonical])}).has(tennisAlias),'Canonical opt-out also excludes a followed provider alias');

assert.equal(buildServerFeed({events:[{id:'tennis-alias-regression',key:'tennis',name:'Player v Opponent',date:'2026-09-24',participantIds:[tennisAlias,'athlete:tennis:opponent']}],userId:'audit',userState:{preferences:preferences([tennisAlias],[tennisCanonical])},now}).events.length,0,'Server must respect canonical opt-out against alias follow');

const pages=[];let cursor=0;
do {const page=buildServerFeed({events:odi,userId:'audit',userState:{preferences:preferences([aus],[sa])},now,cursor,limit:1});pages.push(...page.events.map(e=>e.id));cursor=page.pagination.nextCursor;}while(cursor!==null);
assert.equal(new Set(pages).size,3,'Every ODI survives paginated Follow admission');
