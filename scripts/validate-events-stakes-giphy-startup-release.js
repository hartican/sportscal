#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const majorEvents = require("../config/major-events.js");
const enrichment = require("../config/enrichment-engine.js");
const stakesPolicy = enrichment;
const catalogue = JSON.parse(fs.readFileSync("data/major-events.v1.json", "utf8"));
const canonical = JSON.parse(fs.readFileSync("data/canonical/afl-nrl-2026.json", "utf8"));
const html = fs.readFileSync("index.html", "utf8");
const chatApi = fs.readFileSync("api/chat.js", "utf8");
const chatUi = fs.readFileSync("config/chat-media-ui.js", "utf8");

const future = new Date("2026-09-04T00:00:00.000Z");
const staleCatalogue = JSON.parse(JSON.stringify(catalogue));
const staleQualification = staleCatalogue.events.find(item => item.id === "major-event:uefa-champions-league-2026-27:qualification");
delete staleQualification.lifecycleStatus;
delete staleQualification.retiredReason;
delete staleQualification.retiredAt;
delete staleQualification.retiredDeepLinkBehaviour;
const detailed = majorEvents.validateDocumentDetailed(staleCatalogue, { reference:future });
assert.deepEqual(detailed.fatalErrors, [], "an expired event phase must not become a fatal catalogue error");
assert(detailed.recordErrors.some(item => item.recordId === "major-event:uefa-champions-league-2026-27:qualification" && item.code === "outside_retention_horizon"));
const usable = majorEvents.usableDocument(staleCatalogue, { reference:future });
assert(usable.document.events.some(item => item.id === "major-event:us-open-2026"), "valid Events must survive a stale sibling record");
assert(!usable.document.events.some(item => item.id === "major-event:uefa-champions-league-2026-27:qualification"), "the stale record must be quarantined");

const cases = [
  ["sport:afl", "Wildcard Finals", 4],
  ["sport:afl", "Qualifying & Elimination Finals", 4],
  ["sport:afl", "Semi Finals", 4],
  ["sport:afl", "Preliminary Finals", 5],
  ["sport:afl", "Grand Final", 5],
  ["sport:nrl", "Round 27", 4],
  ["sport:nrl", "Finals Week 1", 4],
  ["sport:nrl", "Preliminary Final", 5],
  ["sport:nrl", "Grand Final", 5],
];
cases.forEach(([sportDomainId, roundLabel, expected]) => {
  const policy = stakesPolicy.applyCompetitionStakes({ sportDomainId, roundLabel });
  assert.equal(policy.stakesFloor, expected, `${sportDomainId} ${roundLabel} must have the canonical floor`);
  const enriched = enrichment.enrichEvent({ id:`test:${sportDomainId}:${roundLabel}`, key:sportDomainId.split(":").pop(), sportDomainId, roundLabel, storyline:{ stakes:2 } }, {});
  assert.equal(enriched.stakesScore, expected, "a stale generated score must not beat the stage floor");
});
canonical.events.filter(item => item.sportDomainId === "sport:afl" && /final/i.test(item.roundLabel || "")).forEach(item => {
  assert(stakesPolicy.stakesFloorForFixture(item) >= 4, `${item.id} must be at least 4/5`);
});

assert.match(chatApi, /mode === "gif-config"/);
assert.doesNotMatch(chatApi, /async function gifSearch/);
assert.match(chatUi, /Big win/);
assert.match(chatUi, /Powered by GIPHY/);
assert.match(chatUi, /config\.searchUrl/);
assert.match(chatUi, /config\.trendingUrl/);
assert.doesNotMatch(chatUi, /commons\.wikimedia\.org/);

assert.match(html, /PERSONALISED_FEED_CACHE_MAX_STALE_MS = 7 \* 24 \* 60 \* 60 \* 1000/);
assert.doesNotMatch(html, /personalised-feed:\$\{subject\}:\$\{profileId\}:\$\{profileRevision\}/);
const firstLoad = html.slice(html.indexOf("async function refreshFeedOnFirstLoad"), html.indexOf("function requestFeedRefreshForFilterChange"));
assert.doesNotMatch(firstLoad, /Promise\.all\(\[nationalTeamIdentityReady, cardIdentitiesReady, remoteFeedTask\]\)/);
assert.match(firstLoad, /restoreCachedPersonalisedFeed/);
assert.match(firstLoad, /loadPublicFeedFirstPage/);

console.log("Events, canonical stakes, GIPHY and first-load reliability release contract passed.");
