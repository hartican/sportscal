#!/usr/bin/env node

const assert = require("node:assert/strict");
const path = require("node:path");
const { readJson } = require("./lib/feed-utils");
const { storylineFor } = require("./lib/storyline-card-rules");
const {
  buildStandingsIndex,
  hasCurrentLadderSignal,
  resolveStandingsAwareOverride,
} = require("./lib/editorial-preview-standings");

const overrides = readJson(path.resolve("feeds/editorial-preview-overrides.json"));
const standingsIndex = buildStandingsIndex();
const standingsAwareOverrides = Object.entries(overrides.events)
  .filter(([, override]) => hasCurrentLadderSignal(override));
const inputs = ["feeds/incoming/events.json", "data/events.json"];
let checked = 0;

inputs.forEach(input => {
  const feed = readJson(path.resolve(input));
  standingsAwareOverrides.forEach(([eventId, override]) => {
    const event = feed.events.find(candidate => candidate.id === eventId || candidate.eventId === eventId);
    assert(event, `${input} must contain standings-aware editorial card ${eventId}`);
    const expected = resolveStandingsAwareOverride(event, override, standingsIndex);
    assert.equal(event.selectedSentence, expected.selectedSentence, `${input} ${eventId} selectedSentence must match the current ladder`);
    assert.equal(event.fullSpiel, expected.fullSpiel, `${input} ${eventId} fullSpiel must match the current ladder`);

    const expectedStoryline = storylineFor({ ...event, ...expected });
    ["hookSpoilerOff", "hookSpoilerOn", "synopsisSpoilerOff", "synopsisSpoilerOn"].forEach(field => {
      assert.equal(event.storyline?.[field], expectedStoryline[field], `${input} ${eventId} storyline.${field} must match the current ladder`);
    });
    checked += 1;
  });
});

console.log(`Editorial standings valid: ${checked} card records match their current canonical ladders.`);
