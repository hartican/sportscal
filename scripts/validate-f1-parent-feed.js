#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const follow = require("../config/follow-first");
const policy = require("../config/follow-feed-policy");
const identity = require("../config/fixture-identity");
const { buildServerFeed } = require("../lib/server-feed-pipeline");
const { catalogue } = require("../lib/calendar-catalogue");
const now = new Date("2026-09-16T00:00:00Z");
// Minimal reproduction of persisted production choices: F1 checked, its
// unselected Motorsport parent projected as disabled. No account data needed.
const preferences = {
  selectedSelectorEntityIds:["sport:f1"], followedSports:["f1"],
  preferenceGraph:{
    domainPreferences:[{sportDomainId:"sport:motorsport",enabled:false},{sportDomainId:"sport:f1",enabled:true}],
    competitionPreferences:[], entityFollows:[],
  },
};
const published = require("../data/events.json").events;
const f1 = published.filter(event => event.key === "f1" && identity.retainedInActiveTimeline(event,now) && policy.sportingFixture(event));
assert(f1.some(event => /practice/i.test(event.name)), "include actual published practices");
assert(f1.some(event => /qualifying/i.test(event.name)), "include actual published qualifying");
assert(f1.some(event => /race/i.test(event.name)), "include actual published races");
for (const event of f1){
  assert(follow.reasonForEvent(event,preferences), `${event.name}: browser must honour F1 over its unselected parent`);
  assert.equal(policy.explicitlyExcluded(event,preferences),false, `${event.name}: browser exclusion guard must agree`);
}
const server = buildServerFeed({events:catalogue(),userId:"f1-parent-regression",userState:{preferences},now,limit:1000});
for (const event of f1){
  assert(server.events.some(item => item.id === event.id || (event.canonicalEventId && item.canonicalEventId === event.canonicalEventId)), `${event.name}: full API catalogue must retain followed F1`);
}

const context = require("../config/sport-context");
const first = context.applyContextToEvents([f1[0]],require("../data/canonical/f1-context-2026.json"))[0];
assert(first.participantIds?.length,"mute regression uses a sourced session field");
for (const [label,patch] of [
  ["competition exclusion",{preferenceGraph:{...preferences.preferenceGraph,competitionPreferences:[{competitionId:first.competitionId,enabled:false}]}}],
  ["participant mute",{preferenceGraph:{...preferences.preferenceGraph,entityFollows:[{participantId:first.participantIds[0],followLevel:"mute"}]}}],
  ["event exclusion",{followFirst:{excludedMajorEventIds:["formula-one"]}}],
]){
  const blocked = {...preferences,...patch};
  const event = label === "event exclusion" ? {...first,eventFamilyId:"formula-one"} : first;
  assert.equal(follow.reasonForEvent(event,blocked),null,`${label} still wins in browser`);
  assert.equal(buildServerFeed({events:[event],userId:"qa",userState:{preferences:blocked},now}).events.length,0,`${label} still wins on server`);
}
assert.equal(follow.reasonForEvent(first,{...preferences,preferenceGraph:{domainPreferences:[{sportDomainId:"sport:f1",enabled:false}]}}),null,"a disabled child remains an exclusion at the policy boundary");
assert.equal(follow.reasonForEvent(first,{selectedSelectorEntityIds:[],followedSports:[],preferenceGraph:{domainPreferences:[{sportDomainId:"sport:motorsport",enabled:false}]}}),null,"never infer a child follow from an unselected parent");

for (const [child,parent] of [["motogp","motorsport"],["wrc","motorsport"],["aflw","afl"],["nrlw","nrl"]]){
  const event = published.find(item => item.key === child && identity.retainedInActiveTimeline(item,now));
  assert(event,`${child}: source-backed comparison fixture exists`);
  const prefs = {selectedSelectorEntityIds:[`sport:${child}`],followedSports:[child],preferenceGraph:{domainPreferences:[{sportDomainId:`sport:${parent}`,enabled:false},{sportDomainId:`sport:${child}`,enabled:true}]}};
  const withoutParent = {...prefs,preferenceGraph:{domainPreferences:prefs.preferenceGraph.domainPreferences.slice(1)}};
  assert.equal(policy.effectiveDomainPreferences(event,prefs).some(item=>item.sportDomainId===`sport:${parent}`),false,`${child}: unselected ancestor has no veto`);
  const expected = Boolean(follow.reasonForEvent(event,withoutParent));
  assert.equal(Boolean(follow.reasonForEvent(event,prefs)),expected,`${child}: explicit child preserves ordinary admission rules`);
  assert.equal(buildServerFeed({events:[event],userId:"qa",userState:{preferences:prefs},now}).events.length>0,expected,`${child}: server agrees`);
  assert.equal(follow.reasonForEvent(first,prefs),null,`${child} does not opt into sibling F1`);
}
console.log(`F1 parent regression passed: ${f1.length} published sessions, full server catalogue, browser policy, exclusions and sibling isolation.`);
