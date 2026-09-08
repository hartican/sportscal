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

const refreshedEvidenceTimes = catalogue.events
  .flatMap(record => Array.isArray(record.sources) ? record.sources : [])
  .map(source => Date.parse(source.checkedAt || ""))
  .filter(Number.isFinite);
const future = new Date(Math.max(
  Date.parse("2026-09-04T23:59:59.999Z"),
  Date.parse(catalogue.publishedAt || ""),
  ...refreshedEvidenceTimes,
));
const staleCatalogue = JSON.parse(JSON.stringify(catalogue));
const staleCincinnati = staleCatalogue.events.find(item => item.id === "major-event:cincinnati-open-2026");
delete staleCincinnati.lifecycleStatus;
delete staleCincinnati.retiredReason;
delete staleCincinnati.retiredAt;
delete staleCincinnati.retiredDeepLinkBehaviour;
const detailed = majorEvents.validateDocumentDetailed(staleCatalogue, { reference:future });
assert.deepEqual(detailed.fatalErrors, [], "an expired event phase must not become a fatal catalogue error");
assert(detailed.recordErrors.some(item => item.recordId === "major-event:cincinnati-open-2026" && item.code === "outside_retention_horizon"));
const usable = majorEvents.usableDocument(staleCatalogue, { reference:future });
assert(usable.document.events.some(item => item.id === "major-event:us-open-2026"), "valid Events must survive a stale sibling record");
assert(!usable.document.events.some(item => item.id === "major-event:cincinnati-open-2026"), "the stale record must be quarantined");

// Numeric stakes were retired as an admission threshold; stage meaning remains source-owned.
const followPolicy = require('../config/follow-feed-policy');
for(const key of ['afl','nrl']){
  assert.equal(followPolicy.eligibleForFollow({id:'final-test',key,name:'One v Two',cardKind:'fixture',date:'2026-09-10',time:'19:00',roundLabel:'Grand Final'},{competitionFollow:true}),true);
  assert.equal(followPolicy.eligibleForFollow({key,name:'Finals Week 1',roundLabel:'Finals Week 1'},{competitionFollow:true}),false);
}

assert.match(chatApi, /mode === "gif-config"/);
assert.match(chatApi, /async function gifConfig/);
assert.doesNotMatch(chatApi, /api\.giphy\.com/, "GIPHY API calls must not be proxied by the chat server");
assert.match(chatUi, /Big win/);
assert.match(chatUi, /Powered by GIPHY/);
assert.match(chatUi, /mode:"gif-config"/);
assert.match(chatUi, /api_key:apiKey/);
assert.match(chatUi, /action:"gif-reference"/);
assert.match(chatUi, /https:\/\/api\.giphy\.com/);
assert.doesNotMatch(chatUi, /commons\.wikimedia\.org/);

assert.match(html, /PERSONALISED_FEED_CACHE_MAX_STALE_MS = 7 \* 24 \* 60 \* 60 \* 1000/);
assert.doesNotMatch(html, /personalised-feed:\$\{subject\}:\$\{profileId\}:\$\{profileRevision\}/);
const firstLoad = html.slice(html.indexOf("async function refreshFeedOnFirstLoad"), html.indexOf("function requestFeedRefreshForFilterChange"));
assert.doesNotMatch(firstLoad, /Promise\.all\(\[nationalTeamIdentityReady, cardIdentitiesReady, remoteFeedTask\]\)/);
assert.match(firstLoad, /restoreCachedPersonalisedFeed/);
assert.match(firstLoad, /loadPublicFeedFirstPage/);

console.log("Events, canonical stakes, GIPHY and first-load reliability release contract passed.");
