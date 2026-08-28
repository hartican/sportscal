#!/usr/bin/env node

const assert = require("node:assert/strict");
const engine = require("../config/enrichment-engine.js");
const preferences = require("../config/preference-system.js");
const sportRegistry = require("../config/sport-domain-registry.js");

const graph = preferences.createPreferenceGraph({
  profileId: "profile:test",
  domainIds: ["rugby", "fifa"],
  templateByDomain: { rugby: "template:froth", fifa: "template:casual" },
  broadcasterIds: ["stan", "kayo"],
});
graph.entityFollows.push({ profileId: graph.profileId, participantId: "participant:australia", followLevel: "priority" });
graph.domainPreferences.push({ profileId: graph.profileId, sportDomainId: "sport:tennis", templateId: "template:casual", enabled: true });
graph.viewing.startHourLocal = 18;
graph.viewing.endHourLocal = 23;

assert.equal(engine.canonicalFixtureTitle("Japan vs Wallabies", { sportKey: "rugby" }), "Japan v Australia");
assert.equal(engine.canonicalFixtureTitle("Wallabies versus Cherry Blossoms", { sportKey: "rugby" }), "Australia v Japan");
assert.equal(engine.canonicalFixtureTitle("Storm vs Broncos", { sportKey: "nrl" }), "Storm v Broncos");
assert.equal(engine.canonicalFixtureTitle("Australia v England 🇦🇺", { sportKey: "fifa" }), "Australia v England", "decorative emoji must not survive canonical fixture formatting");

const tourNarrative = engine.enrichEvent({
  id: "tour-mountain",
  key: "tdf",
  name: "Stage 19 — Alpe d'Huez (Mountain)",
  time: "20:00",
  expected: 7,
}, { preferenceGraph: graph, narrativeProfile: sportRegistry.byKey.tdf.narrativeProfile });
assert.equal(tourNarrative.storyline.visibleLabel, "Top pick", "sport-specific narrative signals must run before global fallback rules");
assert.equal(tourNarrative.storyline.archetype, "quest");

const routine = engine.enrichEvent({
  id: "routine",
  key: "fifa",
  name: "Canada vs Morocco",
  time: "20:00",
  expected: 3,
  broadcasterIds: ["stan"],
}, { preferenceGraph: graph });
const defining = engine.enrichEvent({
  id: "defining",
  key: "rugby",
  name: "Japan v Wallabies — World Cup Final",
  time: "02:00",
  expected: 10,
  participantIds: ["participant:australia"],
  broadcasterIds: ["stan"],
  storyline: { intensity: 5 },
}, {
  preferenceGraph: graph,
  participants: [{
    id: "participant:australia",
    type: "nationalSide",
    displayName: "Australia",
    canonicalName: "Australia",
  }],
});

assert.equal(routine.cardVariant, "plain", "routine fixtures must derive a plain card");
assert.equal(defining.cardVariant, "marquee", "defining events must derive a marquee card");
assert(defining.mustWatchScore > routine.mustWatchScore, "high stakes and follows must outrank routine fixtures");
assert.equal(defining.followBoost, 5, "priority follows must produce an explainable boost");
assert.deepEqual(defining.followContext, [{
  participantId: "participant:australia",
  participantType: "nationalSide",
  displayName: "Australia",
  followLevel: "priority",
}], "enrichment must carry resolved followed-entity context into derived presentation");
assert.equal(defining.timeWindowFitScore, 3, "critical events may use the late-night override");
assert.equal(defining.storyline.visibleLabel, "Title Decider");
assert.equal(defining.storyline.arcStage, "climax");
assert.equal(defining.storyline.intensitySource, "manual");
assert.equal(defining.schemaVersion, "enriched-event.v2");
assert.equal(defining.rankingVersion, "premium-ranking.v1");
assert.equal(defining.stakesScore, 5);
assert.equal(defining.australiaRelevanceScore, 5);
assert.equal(defining.premiumSurface, "homeMustWatch");
assert(defining.storyline.scoreReasons.length >= 7);

const similarStakesFollowed = engine.enrichEvent({
  id: "followed-similar-stakes",
  key: "rugby",
  name: "Australia v Japan — World Cup Semifinal",
  date: "2026-08-16",
  time: "20:00",
  expected: 8,
  participantIds: ["participant:australia"],
  broadcasterIds: ["stan"],
  storyline: { stakes: 4, intensity: 4 },
}, {
  preferenceGraph: graph,
  participants: [{
    id: "participant:australia",
    type: "nationalSide",
    displayName: "Australia",
    canonicalName: "Australia",
  }],
});
const similarStakesDiscovery = engine.enrichEvent({
  id: "discovery-similar-stakes",
  key: "tennis",
  sportId: "tennis",
  name: "WTA 1000 Semifinal",
  date: "2026-08-16",
  time: "20:00",
  expected: 8,
  storyline: { stakes: 4, intensity: 4 },
}, { preferenceGraph: graph });
assert(similarStakesFollowed.mustWatchScore > similarStakesDiscovery.mustWatchScore, "followed events must outrank discovery at similar stakes");

const toronto = engine.enrichEvent({
  id: "tennis-tournament-wta-toronto-806-2026-2026-08-13",
  key: "tennis",
  tour: "WTA",
  tennisLevel: "wta_1000",
  cardType: "tournament_overview",
  name: "National Bank Open presented by Rogers — WTA 1000",
  date: "2026-08-13",
  time: "09:00",
  expected: 8,
}, { preferenceGraph: graph });
assert.equal(toronto.cardVariant, "marquee", "editorial overrides must support flagship card treatment");
assert.equal(toronto.premiumSurface, "homeMustWatch");
assert.equal(toronto.editorialOverride.reviewedBy, "Nothing Sport editorial");

const competitorGraph = preferences.setEntityFollow(
  preferences.createPreferenceGraph({
    profileId: "profile:competitor",
    domainIds: ["sport:motorsport"],
    broadcasterIds: ["kayo"],
  }),
  "competitor:f1:test-driver",
  "follow"
);
assert.deepEqual(engine.followContextForEvent({
  id: "f1-round",
  participantIds: ["competitor:f1:test-driver"],
}, {
  preferenceGraph: competitorGraph,
  participants: [{
    id: "competitor:f1:test-driver",
    type: "competitor",
    displayName: "Test Driver",
    canonicalName: "Test Driver",
  }],
}), [{
  participantId: "competitor:f1:test-driver",
  participantType: "competitor",
  displayName: "Test Driver",
  followLevel: "follow",
}], "team and Competitor follows must resolve through the same sport-aware enrichment path");

const anyTimeGraph = preferences.updateViewingPreference(graph, {
  viewingWindowEnabled: false,
}, ["stan", "kayo"]);
const anyTimeEvent = engine.enrichEvent({
  id: "any-time-event",
  key: "rugby",
  name: "Routine overnight fixture",
  time: "02:00",
  expected: 3,
  storyline: { intensity: 2 },
}, { preferenceGraph: anyTimeGraph });
assert.equal(anyTimeEvent.timeWindowFitScore, 5, "an explicit Any time preference must disable time-window filtering");

const source = {
  id: "quarterfinal",
  status: "completed",
  startTimeUtc: "2026-07-18T10:00:00.000Z",
};
const semifinal = {
  id: "semifinal",
  key: "fifa",
  name: "World Cup Semifinal",
  displayTitleCompact: "World Cup Semifinal",
  status: "scheduled",
  startTimeUtc: "2026-07-22T10:00:00.000Z",
  matchupParticipants: [
    { name: "France", sourceEventId: "quarterfinal" },
    { name: "Spain" },
  ],
};
const sourceEventsById = new Map([[source.id, source]]);
assert.equal(
  engine.spoilerSafeFixtureTitle(semifinal, { now: new Date("2026-07-19T10:00:00.000Z"), sourceEventsById }),
  "Opponent hidden v Spain",
  "a recent source result may still protect a dependent opponent"
);
assert.equal(
  engine.spoilerSafeFixtureTitle(semifinal, { now: new Date("2026-07-22T10:00:01.000Z"), sourceEventsById }),
  "France v Spain",
  "a fixture that has run must always rebuild with real opponents"
);
semifinal.startTimeUtc = "2026-07-30T10:00:00.000Z";
assert.equal(
  engine.spoilerSafeFixtureTitle(semifinal, { now: new Date("2026-07-22T10:00:01.000Z"), sourceEventsById }),
  "France v Spain",
  "opponents must rebuild after the three-day recent-history window"
);

const ranked = engine.rankEvents([
  { id: "b", key: "fifa", name: "Routine B", expected: 3, time: "20:00", broadcasterIds: ["stan"] },
  { id: "a", key: "rugby", name: "World Cup Final", expected: 10, time: "20:00", broadcasterIds: ["stan"] },
], { preferenceGraph: graph });
assert.equal(ranked[0].event.id, "a", "ranking must deterministically surface the highest score first");

const surfaces = engine.selectPremiumSurfaces([
  { id: "routine-1", key: "fifa", name: "Routine fixture", date: "2026-08-15", time: "20:00", expected: 3 },
  { id: "story-1", key: "golf", name: "Major Championship Semifinal", date: "2026-08-15", time: "20:00", expected: 8, storyline: { stakes: 4, intensity: 4 } },
  { id: "must-1", key: "rugby", name: "World Cup Final", date: "2026-08-16", time: "20:00", expected: 10, storyline: { stakes: 5, intensity: 5 } },
  { id: "outside-horizon", key: "rugby", name: "Later World Cup Final", date: "2026-08-25", time: "20:00", expected: 10, storyline: { stakes: 5, intensity: 5 } },
], { preferenceGraph: graph, now: new Date("2026-08-13T00:00:00+10:00") });
assert.deepEqual(surfaces.mustWatch.map(item => item.event.id), ["must-1"]);
assert.deepEqual(surfaces.topStorylines.map(item => item.event.id), ["story-1"]);
assert(!surfaces.mustWatch.some(item => item.event.id === "routine-1"), "routine breadth must not enter premium rails");

console.log("Enrichment engine validation passed.");
