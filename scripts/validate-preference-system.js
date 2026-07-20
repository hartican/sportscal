#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const preferences = require("../config/preference-system.js");

const schema = JSON.parse(fs.readFileSync("schemas/preference-graph.schema.json", "utf8"));
assert.equal(schema.properties.schemaVersion.const, preferences.SCHEMA_VERSION);
assert.deepEqual(preferences.templates.map(template => template.slug), ["froth", "like", "casual", "custom"]);

const profileId = "profile:phase2-test";
const baseProviders = ["kayo", "stan", "sbs"];
const initial = preferences.createPreferenceGraph({
  profileId,
  domainIds: ["sport:afl"],
  broadcasterIds: baseProviders,
});
assert.deepEqual(initial.viewing.selectedBroadcasterIds, baseProviders, "all available providers must start selected");
assert.equal(initial.domainPreferences[0].templateId, "template:like");
assert.equal(initial.domainPreferences[0].showLadder, "summary");

const froth = preferences.quickAddDomain(initial, "sport:nrl", "template:froth");
const nrlFroth = froth.domainPreferences.find(item => item.sportDomainId === "sport:nrl");
assert.equal(nrlFroth.includeAllFixtures, true);
assert.equal(nrlFroth.showLadder, "full");
assert.equal(froth.domainPreferences.find(item => item.sportDomainId === "sport:afl").templateId, "template:like", "quick add must not alter an existing sport");

const customised = preferences.setCoverageMode(froth, "sport:nrl", "majorOnly");
const nrlCustom = customised.domainPreferences.find(item => item.sportDomainId === "sport:nrl");
assert.equal(nrlCustom.templateId, "template:custom", "a detailed override must win over the inherited template");
assert.equal(nrlCustom.includeAllFixtures, false);
assert.equal(nrlCustom.includeFollowedTeams, false);

const withCompetition = preferences.upsertCompetitionPreference(customised, "competition:nrl-premiership-2026", {
  enabled: true,
  templateInheritedFromDomain: false,
  showLadder: "full",
});
const withTeam = preferences.setEntityFollow(withCompetition, "team:nrl:canberra", "priority");
assert.equal(withTeam.competitionPreferences[0].showLadder, "full");
assert.equal(withTeam.entityFollows[0].followLevel, "priority");

const optedOut = preferences.updateViewingPreference(withTeam, {
  selectedBroadcasterIds: ["kayo", "sbs"],
  startHourLocal: 18,
  endHourLocal: 23,
  reminderLeadMinutes: [30, 60],
}, baseProviders);
assert.deepEqual(optedOut.viewing.excludedBroadcasterIds, ["stan"]);

const migratedWithNewProvider = preferences.migratePreferenceGraph(optedOut, {
  profileId,
  domainIds: ["sport:afl", "sport:nrl"],
  broadcasterIds: [...baseProviders, "seven"],
});
assert(migratedWithNewProvider.viewing.selectedBroadcasterIds.includes("seven"), "new providers must default to selected");
assert(!migratedWithNewProvider.viewing.selectedBroadcasterIds.includes("stan"), "an explicit provider opt-out must survive migration");
assert.equal(migratedWithNewProvider.domainPreferences.find(item => item.sportDomainId === "sport:nrl").includeFollowedTeams, false);
assert.equal(migratedWithNewProvider.entityFollows[0].participantId, "team:nrl:canberra");

const disabledNrl = preferences.disableDomain(migratedWithNewProvider, "sport:nrl");
assert.equal(disabledNrl.domainPreferences.find(item => item.sportDomainId === "sport:nrl").enabled, false);
assert.equal(disabledNrl.domainPreferences.find(item => item.sportDomainId === "sport:afl").enabled, true);

console.log("Preference system valid: templates, overrides, quick add, entity follows, and provider migrations passed.");
