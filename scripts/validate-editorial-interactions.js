#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const followFirst = require("../config/follow-first.js");

const feed = JSON.parse(fs.readFileSync("data/events.json", "utf8"));
const majorEvents = JSON.parse(fs.readFileSync("data/major-events.v1.json", "utf8"));
const knowledge = JSON.parse(fs.readFileSync("data/editorial-knowledge.v1.json", "utf8"));
const html = fs.readFileSync("index.html", "utf8");
const projections = new Map(knowledge.eventProjections.map(projection => [projection.id, projection]));

const projectedRecords = [...feed.events, ...majorEvents.events].filter(record => record.editorialNarrative);
assert(projectedRecords.length > 0, "the regression must exercise published editorial cards");
projectedRecords.forEach(record => {
  const projection = projections.get(record.editorialNarrative.projectionId);
  assert(projection, `${record.id} must reference a known editorial projection`);
  assert.equal(record.editorialNarrative.synopsis, projection.synopsis, `${record.id} must carry the researched synopsis into selected and opened card states`);
});
assert(html.includes("editorialNarrativeCopyForDisplay(ev, state)"), "selected and opened Feed cards must resolve their copy from the validated editorial projection before structural fallbacks");
assert(html.includes("editorialNarrativeCopyForDisplay(record, state)"), "selected and opened Major Events cards must resolve their copy from the validated editorial projection before structural fallbacks");

assert.equal(typeof followFirst.toggleFeedback, "function", "follow-first feedback must expose a repeat-tap toggle");
const basePreferences = followFirst.migratePreferences({});
const feedbackInput = {
  eventId:"event:toggle-like",
  direction:"positive",
  targetType:"event",
  targetId:"event:toggle-like",
  occurredAt:"2026-08-30T08:00:00.000Z",
};
const liked = followFirst.toggleFeedback(basePreferences, feedbackInput);
assert.equal(liked.followFirst.feedback.entries.at(-1)?.direction, "positive", "the first thumbs-up tap must like the event");
const unliked = followFirst.toggleFeedback(liked, { ...feedbackInput, occurredAt:"2026-08-30T08:01:00.000Z" });
assert(!unliked.followFirst.feedback.entries.some(entry => entry.eventId === feedbackInput.eventId), "the second thumbs-up tap must remove the event like");
assert.match(html, /publishPositiveNothingscoreLike\(ev,\s*!togglingOff\)/, "repeat thumbs-up must mirror its active state to the public Nothingscore like without exposing private learning data");

console.log(`Editorial interaction valid: ${projectedRecords.length} projected cards retain L1/L2 narrative and repeat thumbs-up removes the like.`);
