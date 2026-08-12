#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const feedControls = require("../config/feed-controls.js");
const preferences = require("../config/preference-system.js");

const schema = JSON.parse(fs.readFileSync("schemas/feed-controls.schema.json", "utf8"));
const html = fs.readFileSync("index.html", "utf8");
const serviceWorker = fs.readFileSync("service-worker.js", "utf8");

assert.equal(schema.properties.schemaVersion.const, feedControls.SCHEMA_VERSION);
assert.deepEqual(feedControls.MIX_TARGETS.balanced, { direct: 0.75, adjacent: 0.20, discovery: 0.05 });
assert.equal(feedControls.EXPERIMENT_FLAGS.balancedDiscovery, true);
assert.equal(feedControls.EXPERIMENT_FLAGS.firstImpressionDiscoveryCap, 1);
assert.deepEqual(feedControls.normalize({ froth: "invalid", scope: "invalid" }), feedControls.DEFAULT_CONTROLS);
assert.equal(feedControls.eventStart({ date: "2026-08-13", time: "19:00" }).toISOString(), "2026-08-13T09:00:00.000Z", "legacy local times must be interpreted in Australia/Sydney");

const viewingEvent = {
  date: "2026-08-13",
  time: "19:00",
  startTimeUtc: "2026-08-13T09:00:00.000Z",
  stakesScore: 4,
  broadcasts: [
    { accessType: "free" },
    { platformType: "streaming" },
    { platformType: "ppv" },
  ],
};
assert.deepEqual(feedControls.accessTypes(viewingEvent), ["free", "included", "ppv"]);
assert(feedControls.matchesAvailability(viewingEvent, "free"));
assert(feedControls.matchesAvailability(viewingEvent, "included"));
assert(feedControls.matchesAvailability(viewingEvent, "ppv"));
assert(feedControls.matchesTiming(viewingEvent, "tonight", new Date("2026-08-13T08:00:00.000Z")));
assert(feedControls.matchesTiming(viewingEvent, "this_week", new Date("2026-08-13T08:00:00.000Z")));
assert(!feedControls.matchesEvent({ ...viewingEvent, stakesScore: 2 }, { froth: "balanced" }), "Balanced must keep low-stakes noise out by default");
assert(feedControls.matchesEvent({ ...viewingEvent, stakesScore: 2 }, { froth: "balanced" }, { explicitCoverage: true }), "explicit all-fixture coverage must survive feed-density controls");

assert.equal(feedControls.classifyRecommendation({ directInterest: true }).classification, "direct");
assert.equal(feedControls.classifyRecommendation({ directInterest: true, explicitUnfollow: true }).classification, "suppressed", "explicit unfollows must win over direct interest");
assert.equal(feedControls.classifyRecommendation({ stakes: 5 }).classification, "discovery");
assert.equal(feedControls.classifyRecommendation({ learningScore: 10 }).classification, "adjacent");
assert.equal(feedControls.classifyRecommendation({ learningScore: 10, negativeContextCount: 2 }).classification, "suppressed", "repeated negative context must suppress rediscovery");

const items = [
  ...Array.from({ length: 20 }, (_value, index) => ({ id: `direct:${index}`, classification: "direct", score: 90 - index, startsAt: index })),
  ...Array.from({ length: 10 }, (_value, index) => ({ id: `adjacent:${index}`, classification: "adjacent", score: 70 - index, startsAt: index + 1 })),
  ...Array.from({ length: 10 }, (_value, index) => ({ id: `discovery:${index}`, classification: "discovery", score: 100 - index, startsAt: index + 1 })),
];
const balanced = feedControls.selectRecommendationMix(items, { froth: "balanced", scope: "for_you" });
assert.equal([...balanced].filter(id => id.startsWith("discovery:")).length, 1, "Balanced must retain rare discovery");
assert.equal([...balanced].filter(id => id.startsWith("adjacent:")).length, 5);
assert(items.filter(item => item.classification === "direct").every(item => balanced.has(item.id)), "discovery must never displace followed events");
const followingOnly = feedControls.selectRecommendationMix(items, { froth: "maximum", scope: "following" });
assert([...followingOnly].every(id => id.startsWith("direct:")), "Following scope must contain only direct interests");

let graph = preferences.createPreferenceGraph({ profileId: "profile:feed-control-test", domainIds: ["sport:nrl"] });
for (let index = 0; index < 2; index += 1){
  graph = preferences.applyLearningSignal(graph, {
    targetType: "event",
    targetId: "event:test",
    value: -1,
    source: "feed",
  }, {
    recordedAt: new Date(Date.UTC(2026, 7, 13, 0, index)).toISOString(),
    contextReferences: [{ targetType: "competition", targetId: "competition:test" }],
  });
}
assert.equal(preferences.negativeContextCount(graph, [{ targetType: "competition", targetId: "competition:test" }]), 2);

assert(html.includes('id="feedControlGrid"') && html.includes('data.feedControl') === false, "feed controls must have a distinct UI mount from sport navigation");
assert(html.includes("function renderFeedControls()") && html.includes("function eventRecommendationProfile(ev)"));
assert(html.includes('contextReferences: eventLearningReferences(ev)'), "curated dislikes must retain event context");
assert(html.includes('className = "badge discovery"') && html.includes('className = "badge availability"'), "discovery and access must be labelled on cards");
assert(html.includes('sessionOpenedEventIds.add(') && html.includes('updateEventAction(ev, { watched: true'), "open signals must remain session-local while watch completion stays in durable user state");
assert(html.includes("action.mustWatch ? 12") && html.includes("action.saved ? 10") && html.includes("action.watched ? 6"), "reminders, saves, opens and watch completion must influence local recommendation scoring");
assert(serviceWorker.includes('const CACHE_NAME = "nothingsport-shell-v83"'));
assert(serviceWorker.includes('"/config/feed-controls.js"') && serviceWorker.includes('"/schemas/feed-controls.schema.json"'));

console.log("Feed controls valid: durable UI model, Sydney timing, availability, mix targets, discovery caps and negative suppression passed.");
