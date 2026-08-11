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
assert.equal(initial.schemaVersion, "preference-graph.v4");
assert.deepEqual(initial.learning, {
  signals: [],
  dislikeCount: 0,
  tuningPromptCount: 0,
  lastTunePromptDislikeCount: null,
  calibrationSkippedTargetIds: [],
  calibrationCompletedAt: null,
  calibrationSkippedAt: null,
  tuningInteractionCount: 0,
  tuningDomainIds: [],
  completedTuningSessionCount: 0,
  lastTuningSessionCompletedAt: null,
  meaningfulTuningAt: null,
  meaningfulTuningDislikeCount: null,
});
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

const forwardCompatibleGraph = {
  ...migratedWithNewProvider,
  futureProfileSetting: { compactCards: true },
  viewing: {
    ...migratedWithNewProvider.viewing,
    futureViewingSetting: "preserve-me",
  },
};
const migratedOnce = preferences.migratePreferenceGraph(forwardCompatibleGraph, {
  profileId,
  domainIds: ["sport:afl", "sport:nrl"],
  broadcasterIds: [...baseProviders, "seven"],
});
const migratedTwice = preferences.migratePreferenceGraph(migratedOnce, {
  profileId,
  domainIds: ["sport:afl", "sport:nrl"],
  broadcasterIds: [...baseProviders, "seven"],
});
assert.deepEqual(migratedTwice, migratedOnce, "reapplying the same preference migration must be idempotent");
assert.equal(migratedOnce.futureProfileSetting.compactCards, true, "unknown profile settings must survive app migrations");
assert.equal(migratedOnce.viewing.futureViewingSetting, "preserve-me", "unknown viewing settings must survive app migrations");

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

const likedWimbledon = preferences.applyLearningSignal(disabledNrl, {
  targetType: "event_family",
  targetId: "special:wimbledon",
  value: 1,
  source: "calibration",
}, { recordedAt: "2026-08-11T08:00:00.000Z" });
assert.equal(likedWimbledon.learning.signals.length, 1, "calibration choices must persist immediately in the graph");
assert.equal(preferences.learningScore(likedWimbledon, [{ targetType: "event_family", targetId: "special:wimbledon" }]), 10, "positive learning must lift a matching curated event");

const dislikedWimbledon = preferences.applyLearningSignal(likedWimbledon, {
  targetType: "event_family",
  targetId: "special:wimbledon",
  value: -1,
  source: "feed",
}, { recordedAt: "2026-08-11T08:01:00.000Z" });
assert.equal(dislikedWimbledon.learning.signals.length, 1, "the latest signal for one target must replace its earlier value");
assert.equal(dislikedWimbledon.learning.dislikeCount, 1, "qualifying dislikes must increment the durable counter");
assert.equal(preferences.learningScore(dislikedWimbledon, [{ targetType: "event_family", targetId: "special:wimbledon" }]), -10, "negative learning must lower matching curated ranking without deleting truth");

const promptCadence = [1, 4, 10, 25, 50, 100, 150];
assert.deepEqual(
  Array.from({ length: 160 }, (_value, index) => index + 1).filter(preferences.shouldPromptTune),
  promptCadence,
  "Tune prompts must use the deterministic decaying cadence"
);
assert.equal(preferences.shouldPromptTune(2), false, "the second dislike must never show a Tune prompt");
const prompted = preferences.recordTunePrompt(dislikedWimbledon, { dislikeCount: 1 });
assert.equal(prompted.learning.tuningPromptCount, 1);
assert.equal(prompted.learning.lastTunePromptDislikeCount, 1);

let tuned = dislikedWimbledon;
for (let index = 0; index < 8; index += 1){
  tuned = preferences.applyTuningSignal(tuned, {
    targetType: "team",
    targetId: `team:tune:${index}`,
    value: index % 2 ? -1 : 1,
  }, {
    domainId: index < 4 ? "sport:nrl" : "sport:afl",
    recordedAt: new Date(Date.UTC(2026, 7, 12, 0, index)).toISOString(),
  });
}
assert.equal(tuned.learning.tuningInteractionCount, 8, "fine-tuning interactions must be durable");
assert.deepEqual(tuned.learning.tuningDomainIds, ["sport:nrl", "sport:afl"], "fine-tuning must retain distinct domains");
assert.equal(tuned.learning.dislikeCount, 1, "negative Tune choices must not count as qualifying feed dislikes");
assert.equal(preferences.isMeaningfullyTuned(tuned), true, "eight interactions across two domains must be meaningful");
assert.equal(tuned.learning.meaningfulTuningDislikeCount, 1, "meaningful tuning must capture its dislike baseline");
const postTuneLearning = {
  ...tuned.learning,
  dislikeCount: 101,
  lastTunePromptDislikeCount: 1,
};
assert.equal(
  preferences.shouldPromptTune(postTuneLearning, { now: new Date("2026-09-10T23:59:59.000Z") }),
  false,
  "meaningful tuning must suppress prompts until thirty complete days have passed"
);
assert.equal(
  preferences.shouldPromptTune(postTuneLearning, { now: new Date("2026-09-11T00:07:00.000Z") }),
  true,
  "meaningful tuning may prompt after both thirty days and one hundred additional dislikes"
);
assert.equal(
  preferences.shouldPromptTune({ ...postTuneLearning, dislikeCount: 100 }, { now: new Date("2026-09-20T00:00:00.000Z") }),
  false,
  "ninety-nine additional dislikes must remain suppressed"
);
const oneSession = preferences.completeTuningSession(initial, { recordedAt: "2026-08-12T01:00:00.000Z" });
const twoSessions = preferences.completeTuningSession(oneSession, { recordedAt: "2026-08-13T01:00:00.000Z" });
assert.equal(preferences.isMeaningfullyTuned(oneSession), false, "one completed Tune session is not meaningful by itself");
assert.equal(preferences.isMeaningfullyTuned(twoSessions), true, "two completed Tune sessions must be meaningful");

let bounded = initial;
for (let index = 0; index < preferences.MAX_LEARNING_SIGNALS + 25; index += 1){
  bounded = preferences.applyLearningSignal(bounded, {
    targetType: "event",
    targetId: `event:${index}`,
    value: index % 2 ? 1 : -1,
    source: "feed",
  }, { recordedAt: new Date(Date.UTC(2026, 7, 11, 9, index)).toISOString() });
}
assert.equal(bounded.learning.signals.length, preferences.MAX_LEARNING_SIGNALS, "learning history must remain bounded");

let skipped = initial;
for (let index = 0; index < preferences.MAX_CALIBRATION_SKIPS + 4; index += 1){
  skipped = preferences.skipCalibrationTarget(skipped, `target:${index}`);
}
assert.equal(skipped.learning.calibrationSkippedTargetIds.length, preferences.MAX_CALIBRATION_SKIPS, "skipped calibration progress must remain bounded");
const completed = preferences.completeCalibration(skipped, { skipped: true, recordedAt: "2026-08-11T10:00:00Z" });
assert.equal(completed.learning.calibrationCompletedAt, "2026-08-11T10:00:00.000Z");
assert.equal(completed.learning.calibrationSkippedAt, "2026-08-11T10:00:00.000Z");
const mergedLearning = preferences.mergeLearning(dislikedWimbledon.learning, {
  signals: [{ targetType: "sport", targetId: "sport:afl", value: 1, source: "feed", recordedAt: "2026-08-11T11:00:00.000Z" }],
  dislikeCount: 0,
  tuningPromptCount: 0,
});
assert.equal(mergedLearning.signals.length, 2, "sign-in must merge local and server learning targets instead of replacing the local graph");
assert.equal(mergedLearning.dislikeCount, 1, "sign-in must preserve the higher durable dislike counter");

console.log("Preference system valid: v4 migration, bounded learning, meaningful Tune suppression, templates, follows and viewing preferences passed.");
