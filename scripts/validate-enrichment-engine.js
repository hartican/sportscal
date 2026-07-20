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
assert.equal(tourNarrative.storyline.visibleLabel, "Must Watch", "sport-specific narrative signals must run before global fallback rules");
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
}, { preferenceGraph: graph });

assert.equal(routine.cardVariant, "plain", "routine fixtures must derive a plain card");
assert.equal(defining.cardVariant, "marquee", "defining events must derive a marquee card");
assert(defining.mustWatchScore > routine.mustWatchScore, "high stakes and follows must outrank routine fixtures");
assert.equal(defining.followBoost, 5, "priority follows must produce an explainable boost");
assert.equal(defining.timeWindowFitScore, 3, "critical events may use the late-night override");
assert.equal(defining.storyline.visibleLabel, "Title Decider");
assert.equal(defining.storyline.arcStage, "climax");
assert.equal(defining.storyline.intensitySource, "manual");
assert.equal(defining.storyline.scoreReasons.length, 5);

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

console.log("Enrichment engine validation passed.");
