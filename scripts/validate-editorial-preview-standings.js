#!/usr/bin/env node

const assert = require("node:assert/strict");
const path = require("node:path");
const { readJson } = require("./lib/feed-utils");
const { RESULT_LEAK, storylineFor } = require("./lib/storyline-card-rules");
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

assert.equal(RESULT_LEAK.test("Leeds lost only three of their final 14 matches last season before returning to the Champions League."), false, "historical form and competition names must not be mistaken for this fixture's hidden result");
assert.equal(RESULT_LEAK.test("Leeds retained a physical 3-4-2-1 structure."), false, "a tactical formation must not be mistaken for a scoreline");
assert.equal(RESULT_LEAK.test("Leeds lost to Brentford."), true, "a direct completed-result statement must remain blocked from spoiler-off copy");
assert.equal(RESULT_LEAK.test("Leeds 3-4 Brentford."), true, "a completed scoreline must remain blocked from spoiler-off copy");

inputs.forEach(input => {
  const feed = readJson(path.resolve(input));
  standingsAwareOverrides.forEach(([eventId, override]) => {
    const event = feed.events.find(candidate => candidate.id === eventId || candidate.eventId === eventId);
    assert(event, `${input} must contain standings-aware editorial card ${eventId}`);
    if (event.status === "completed") {
      // A completed fixture deliberately replaces its pre-match ladder copy
      // with the spoiler-safe result contract. Requiring the old ranks here
      // would reject a correct score refresh after the final whistle.
      const expectedStoryline = storylineFor(event);
      assert.equal(event.selectedSentence, expectedStoryline.hookSpoilerOff, `${input} ${eventId} selectedSentence must stay spoiler-safe after completion`);
      assert.equal(event.fullSpiel, expectedStoryline.synopsisSpoilerOff, `${input} ${eventId} fullSpiel must stay spoiler-safe after completion`);
      ["hookSpoilerOff", "hookSpoilerOn", "synopsisSpoilerOff", "synopsisSpoilerOn"].forEach(field => {
        assert.equal(event.storyline?.[field], expectedStoryline[field], `${input} ${eventId} storyline.${field} must match the completed-result contract`);
      });
      checked += 1;
      return;
    }
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
