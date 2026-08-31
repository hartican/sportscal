#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const engine = require("../config/enrichment-engine.js");
const overrides = require("../config/storyline-overrides.js");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const feed = JSON.parse(fs.readFileSync(path.join(root, "data/events.json"), "utf8"));
const activeWta1000 = feed.events.find(event => (
  String(event.key || event.sport || "").toLowerCase() === "tennis"
  && String(event.tour || "").toUpperCase() === "WTA"
  && event.tennisLevel === "wta_1000"
  && event.cardType === "tournament_overview"
  && event.editorialPreview?.contextSignals?.includes("active-tournament-window")
));
const referenceDate = activeWta1000?.date || "2026-08-13";
const reference = new Date(`${referenceDate}T00:00:00+10:00`);
const events = feed.events.map(event => ({ ...event, status: event.date >= referenceDate ? "upcoming" : "completed" }));
const neutralContext = {
  now: reference,
  followedSports: [],
  selectedBroadcasterIds: [],
};

assert.equal(engine.SCHEMA_VERSION, "enriched-event.v2");
assert.equal(engine.RANKING_VERSION, "premium-ranking.v1");
assert.equal(overrides.SCHEMA_VERSION, "storyline-overrides.v1");
assert(Object.values(overrides.overrides).every(override => override.reviewedAt && override.reviewedBy && override.note), "every editorial override needs review provenance");
assert(Object.values(overrides.ruleOverrides).every(override => override.reviewedAt && override.reviewedBy && override.note), "every rule-based editorial override needs review provenance");

const routine = engine.enrichEvent({
  id: "phase5-routine",
  key: "nrl",
  name: "Routine fixture",
  date: "2026-08-15",
  time: "15:00",
  expected: 3,
}, neutralContext);
const defining = engine.enrichEvent({
  id: "phase5-defining",
  key: "fifa",
  name: "World Cup Final",
  date: "2026-08-15",
  time: "20:00",
  expected: 10,
}, neutralContext);
assert(defining.mustWatchScore > routine.mustWatchScore, "high stakes must outrank routine fixtures without explicit follows");
assert.equal(routine.cardVariant, "plain", "routine catalogue breadth must remain visually quiet");
assert.equal(defining.cardVariant, "marquee", "defining events need marquee treatment");

const surfaces = engine.selectPremiumSurfaces(events, neutralContext);
const mustWatchIds = surfaces.mustWatch.map(item => item.enrichment.canonicalEventId);
const storylineIds = surfaces.topStorylines.map(item => item.enrichment.canonicalEventId);
if (activeWta1000) {
  assert(mustWatchIds.includes(activeWta1000.id), "the current reviewed WTA 1000 flagship must enter Must Watch");
  assert.equal(overrides.forEvent(activeWta1000)?.forceSurface, "homeMustWatch", "the current active WTA 1000 tournament must inherit the reviewed flagship rule");
}
assert(mustWatchIds.length <= engine.PREMIUM_SURFACE_POLICY.mustWatchLimit, "Must Watch must stay capped");
assert(storylineIds.length <= engine.PREMIUM_SURFACE_POLICY.topStorylineLimit, "weekly storylines must stay capped");
assert(!mustWatchIds.some(id => storylineIds.includes(id)), "premium surfaces must not duplicate events");
assert([...surfaces.mustWatch, ...surfaces.topStorylines].every(item => item.enrichment.stakesScore >= 4), "routine fixtures must stay out of premium surfaces");

assert(!html.includes('function appendManualMustWatchQueue') && !html.includes("appendPremiumSurfaces(container, filtered)"), "editorial scoring must not split cards out of the chronological feed");
assert(!html.includes('const displayLabel = enrichment.storyline.visibleLabel === "Must Watch"') && !html.includes('? "Top pick"'), "legacy editorial labels must remain ranking inputs without rendering Top pick tags");
assert(html.includes('return activeTodayAnchorId();'), "the initial feed jump must land at Today");
assert(html.includes('label.textContent = `STAKES ${score}/5`'), "visible stakes must not be mislabeled storyline intensity");
assert(!html.includes("Editorially reviewed ·"), "opened flagship cards must not expose editorial-review metadata");

console.log(`Phase 5 editorial ranking valid: ${mustWatchIds.length} top picks and ${storylineIds.length} storyline events scored without splitting the chronological feed.`);
