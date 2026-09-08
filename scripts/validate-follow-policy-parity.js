#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const policy = require("../config/follow-feed-policy");
const follow = require("../config/follow-first");
const {buildServerFeed} = require("../lib/server-feed-pipeline");
const now = new Date("2026-09-07T00:00:00Z");
assert.equal(policy.eligibleForFollow({id:'muted-pin'},{explicitSelection:true,muted:true}),false,'explicit mutes override a previously pinned fixture');
const fixture = (id, fields={}) => ({id,eventId:id,key:"tennis",date:"2026-09-08",time:"12:00",name:id,...fields});
function included(event, preferences, expected, description){
  assert.equal(Boolean(follow.reasonForEvent(event,preferences)),expected,`browser: ${description}`);
  const response=buildServerFeed({events:[event],userId:"policy-test",userState:{preferences},now});
  assert.equal(response.events.length>0,expected,`server: ${description}`);
}
const rugby={followedSports:["rugby"]};
included(fixture("ordinary",{key:"rugby",stakesScore:5,storyline:{stakes:5}}),rugby,false,"stakes never confer eligibility");
included(fixture("women-test",{key:"rugby",competitionScope:"international",gender:"women",stakesScore:1}),rugby,false,"women internationals require explicit follows");
included(fixture("u20-test",{key:"rugby",competitionScope:"international",ageGroup:"U20"}),rugby,false,"age-group fixtures are not senior internationals");
included(fixture("domestic-final",{key:"rugby",round:"Grand Final",stakesScore:1}),rugby,false,"rugby finals require explicit team or competition follows");
included(fixture('motogp-gp',{key:'motogp',name:'San Marino Grand Prix Race'}),{followedSports:['motogp']},true,'premier Grand Prix races remain marquee without stakes');
included(fixture('sailgp-meet',{key:'sailgp',name:'Sydney Sail Grand Prix'}),{followedSports:['sailgp']},true,'premier SailGP meets remain marquee without stakes');
const tennis={followedSports:["tennis"],followFirst:{australiansOnlySportIds:["sport:tennis"]}};
included(fixture("early-aussie",{round:"Round 1",participantCountryCodes:["AUS"]}),tennis,false,"early tennis requires a followed player");
included(fixture("foreign-final",{round:"Final",participantCountryCodes:["ITA","USA"]}),tennis,false,"tennis finals require a player follow");
included(fixture("explicit-event",{round:"Quarter-final",eventFamilyId:"us-open",participantCountryCodes:["ITA","USA"]}),{...tennis,followFirst:{...tennis.followFirst,followedMajorEventIds:["us-open"]}},false,"event follows never bypass player selection");
included(fixture("early-event",{round:"Round 1",eventFamilyId:"us-open"}),{followFirst:{followedMajorEventIds:["us-open"]}},false,"event follows remain marquee only");
included(fixture("doubles-semi",{round:"Semi-final",eventType:"doubles"}),{followedSports:["tennis"]},false,"doubles start at finals");
included(fixture('doubles-format',{stage:"Women's Doubles",roundLabel:'Quarterfinal',matchType:'womens-doubles'}),{followedSports:['tennis']},false,'Events and source format labels use the same doubles finals policy');
included(fixture("singles-quarter",{round:"Quarterfinal",eventType:"singles"}),{followedSports:["tennis"]},false,"singles quarter-finals require followed players");
const athlete={followedSports:[],preferenceGraph:{entityFollows:[{participantId:"competitor:f1:max-verstappen",followLevel:"follow"}]}};
included(fixture("nls",{key:"motorsport",participantIds:["competitor:f1:max-verstappen"],stakesScore:1}),athlete,true,"athlete follows cross disciplines");
included(fixture("excluded",{key:"motorsport",participantIds:["competitor:f1:max-verstappen"],excludedParticipantIds:["competitor:f1:max-verstappen"]}),athlete,false,"confirmed exclusion overrides provisional entry");
included(fixture("muted",{round:"Final",participantIds:["athlete:tennis:muted"]}),{followedSports:["tennis"],preferenceGraph:{entityFollows:[{participantId:"athlete:tennis:muted",followLevel:"mute"}]}},false,"explicit mute overrides broad follow");
included(fixture("empty-preferences",{key:"rugby",round:"Final",stakesScore:5}),{},false,"no follows means no unsolicited fixture");
const footballPlayer=require('../data/canonical/football-follow-index.v1.json').players.find(player=>player.currentTeamId);
for(const fields of [{},{participantsConfirmed:true},{excludedParticipantIds:[footballPlayer.id]}]){
  const event=fixture('excluded-team-inheritance',{key:'football',participantIds:[footballPlayer.currentTeamId],...fields});
  assert.equal(buildServerFeed({events:[event],userId:'qa',userState:{preferences:{preferenceGraph:{entityFollows:[{participantId:footballPlayer.id,followLevel:'follow'}]}}},now}).events.length,0,'team membership alone never confirms fixture participation');
}
const order=require('../config/football-directory');
assert.deepEqual(order.followOrder([{id:'club-a',teamKind:'club'},{id:'national',teamKind:'national'},{id:'club-b',teamKind:'club'}],{preferenceGraph:{entityFollows:[{participantId:'club-b',followLevel:'follow'}]}}).map(record=>record.id),['club-b','club-a','national']);
for(const key of ["afl","aflw","nrl","nrlw"])assert.equal(policy.australiansFilterUseful({key}),false,`${key} has no redundant Australian toggle`);
assert.equal(policy.australiansFilterUseful({key:"cricket",competitionScope:"domestic",countryCode:"AU"}),false);
assert.equal(policy.australiansFilterUseful({key:"football"}),true);
const summary=require('../config/follow-summary').allFollowed({followedSports:["tennis"],followFirst:{collectionFollows:["collection:test"]},preferenceGraph:{entityFollows:[{participantId:"athlete:tennis:muted",followLevel:"mute"}]}}, {collectionsById:{"collection:test":{label:"Watch list",memberIds:["athlete:tennis:watched","athlete:tennis:muted"]}}});
assert(summary.some(item=>item.id==="athlete:tennis:watched"&&item.origins.includes("Watch list")));
assert(!summary.some(item=>item.id==="athlete:tennis:muted"));
console.log("Follow policy parity: sport/event/Australian/direct/mute and cross-discipline cases passed.");
