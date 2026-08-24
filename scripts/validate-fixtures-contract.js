#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const feed = require("../config/personalised-feed");
const controls = require("../config/feed-controls");

const fixtures = [
  { id:"late", startTimeUtc:"2026-08-24T12:00:00Z", stakesScore:5, firstSurfacedAt:"2026-08-24T00:00:00Z" },
  { id:"early", startTimeUtc:"2026-08-24T08:00:00Z", stakesScore:1, firstSurfacedAt:"2026-08-23T00:00:00Z" },
  { id:"middle", startTimeUtc:"2026-08-24T10:00:00Z", stakesScore:3, surfacePinnedUntil:"2027-01-01T00:00:00Z" },
];
for (const mutation of [
  events => events,
  events => events.map((event, index) => ({ ...event, isNew:index === 0 })),
  events => events.map((event, index) => ({ ...event, editorialLabel:index === 2 ? "Title decider" : "Top pick" })),
  events => [...events.slice(1), events[0]],
]){
  assert.deepEqual(feed.sortChronological(mutation(fixtures)).map(event => event.id), ["early", "middle", "late"], "freshness, tags, pagination and input order must never change chronology");
}
assert.equal(controls.normalize({ stakes:"must_watch" }).stakes, "top_picks", "legacy stakes choices must migrate without retaining the removed feature");

const html = fs.readFileSync("index.html", "utf8");
assert.match(html, /function compareSurfacedEvents\(first, second\)\{[\s\S]{0,220}compareChronological/, "all Fixtures views must delegate to the canonical comparator");
assert.doesNotMatch(html, /appendManualMustWatchQueue|setMustWatch\(|Add to Must Watch|Remove from Must Watch/, "the Must Watch queue and controls must not remain active");
assert(html.includes('label.className = "new-tag"') && html.includes("seenThreshold: 0.6") && html.includes("seenDelayMs: 800"), "New must use the durable 60%-for-800ms lifecycle");
assert(html.includes('action.textContent = "Open in Events"') && html.includes("openMajorEventInEvents(event.majorEventId)"), "major event markers must expose a keyboard button into Events");
assert(html.includes('openEvents.textContent = "Open in Events"'), "linked fixture cards must expose the optional L0 Events action");
assert(html.includes("function pruneUnavailableFootballFollows(directory)") && html.includes("pruneUnavailableFootballFollows(data);"), "removed football participant follows must be pruned when the unchanged lazy directory hydrates");
assert.match(html, /--fixture-card-collapsed-height:248px[\s\S]{0,500}\.cards-grid > \.event-card\[data-card-state="compact"\][\s\S]{0,500}height:var\(--fixture-card-collapsed-height\)/, "all collapsed fixture variants must share one outer height");
assert(!fs.existsSync("data/football/fixtures/a-league-men.json") && !fs.existsSync("data/football/fixtures/a-league-men.js"), "A-League fixture bundles must be removed from active data");
const football = JSON.parse(fs.readFileSync("data/canonical/football-directory.v1.json", "utf8"));
assert.equal(football.leagues.length, 5);
assert(!football.leagues.some(league => league.id === "competition:a-leagues" || league.key === "a-league-men"));

console.log("Fixtures contract valid: canonical chronology, equal L0 geometry, New lifecycle, Events links and five-league catalogue passed.");
