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
assert.equal(initial.schemaVersion, "preference-graph.v3");
assert.deepEqual(initial.viewing.selectedBroadcasterIds, baseProviders, "all available providers must start selected");
assert.equal(initial.viewing.viewingWindowEnabled, true, "the recommended viewing window must start enabled");
assert.equal(initial.viewing.startHourLocal, 7, "the default viewing window must start at 7am");
assert.equal(initial.viewing.endHourLocal, 22, "the default viewing window must end at 10pm");
assert.equal(initial.viewing.allowLateNightOverrides, true, "high-stakes overrides must start enabled");
assert.equal(initial.viewing.calendarSyncEnabled, true, "Calendar sync must start enabled for a new profile");
assert.equal(initial.viewing.browserAlertsEnabled, false, "browser alerts must remain opt-in");
assert.equal(initial.domainPreferences[0].templateId, "template:like");
assert(!("showLadder" in initial.domainPreferences[0]), "standings visibility must not be persisted with Froth preferences");

const froth = preferences.quickAddDomain(initial, "sport:nrl", "template:froth");
const nrlFroth = froth.domainPreferences.find(item => item.sportDomainId === "sport:nrl");
assert.equal(nrlFroth.includeAllFixtures, true);
assert(!("showLadder" in nrlFroth), "Froth must not control standings visibility");
assert.equal(froth.domainPreferences.find(item => item.sportDomainId === "sport:afl").templateId, "template:like", "quick add must not alter an existing sport");

const casual = preferences.quickAddDomain(froth, "sport:nrl", "template:casual");
assert.equal(casual.domainPreferences.find(item => item.sportDomainId === "sport:nrl").templateId, "template:casual");

const customised = preferences.setCoverageMode(froth, "sport:nrl", "majorOnly");
const nrlCustom = customised.domainPreferences.find(item => item.sportDomainId === "sport:nrl");
assert.equal(nrlCustom.templateId, "template:custom", "a detailed override must win over the inherited template");
assert.equal(nrlCustom.includeAllFixtures, false);
assert.equal(nrlCustom.includeFollowedTeams, false);

const withCompetition = preferences.upsertCompetitionPreference(customised, "competition:nrl-premiership-2026", {
  enabled: true,
  templateInheritedFromDomain: false,
});
const withTeam = preferences.setEntityFollow(withCompetition, "team:nrl:canberra", "priority");
assert(!("showLadder" in withTeam.competitionPreferences[0]), "competition preferences must not persist standings visibility");
assert.equal(withTeam.entityFollows[0].followLevel, "priority");

const optedOut = preferences.updateViewingPreference(withTeam, {
  selectedBroadcasterIds: ["kayo", "sbs"],
  viewingWindowEnabled: false,
  startHourLocal: 18,
  endHourLocal: 23,
  calendarSyncEnabled: false,
  reminderLeadMinutes: [30, 60],
}, baseProviders);
assert.deepEqual(optedOut.viewing.excludedBroadcasterIds, ["stan"]);
assert.equal(optedOut.viewing.viewingWindowEnabled, false, "Any time must be an explicit durable preference");
assert.equal(optedOut.viewing.calendarSyncEnabled, false, "an explicit Calendar sync opt-out must be preserved");

const migratedWithNewProvider = preferences.migratePreferenceGraph(optedOut, {
  profileId,
  domainIds: ["sport:afl", "sport:nrl"],
  broadcasterIds: [...baseProviders, "seven"],
});
assert(migratedWithNewProvider.viewing.selectedBroadcasterIds.includes("seven"), "new providers must default to selected");
assert(!migratedWithNewProvider.viewing.selectedBroadcasterIds.includes("stan"), "an explicit provider opt-out must survive migration");
assert.equal(migratedWithNewProvider.viewing.viewingWindowEnabled, false, "an explicit Any time choice must survive migration");
assert.equal(migratedWithNewProvider.viewing.calendarSyncEnabled, false, "an explicit Calendar sync opt-out must survive migration");
assert.equal(migratedWithNewProvider.domainPreferences.find(item => item.sportDomainId === "sport:nrl").includeFollowedTeams, false);
assert.equal(migratedWithNewProvider.entityFollows[0].participantId, "team:nrl:canberra");

const migratedLegacyVisibility = preferences.migratePreferenceGraph({
  ...migratedWithNewProvider,
  schemaVersion: "preference-graph.v2",
  domainPreferences: migratedWithNewProvider.domainPreferences.map(item => ({ ...item, showLadder: "hidden" })),
  competitionPreferences: [{ ...migratedWithNewProvider.competitionPreferences[0], showLadder: "full" }],
}, {
  profileId,
  domainIds: ["sport:afl", "sport:nrl"],
  broadcasterIds: [...baseProviders, "seven"],
});
assert(migratedLegacyVisibility.domainPreferences.every(item => !("showLadder" in item)), "legacy domain visibility fields must be removed");
assert(migratedLegacyVisibility.competitionPreferences.every(item => !("showLadder" in item)), "legacy competition visibility fields must be removed");

const disabledNrl = preferences.disableDomain(migratedWithNewProvider, "sport:nrl");
assert.equal(disabledNrl.domainPreferences.find(item => item.sportDomainId === "sport:nrl").enabled, false);
assert.equal(disabledNrl.domainPreferences.find(item => item.sportDomainId === "sport:afl").enabled, true);

console.log("Preference system valid: templates, overrides, quick add, entity follows, and provider migrations passed.");
