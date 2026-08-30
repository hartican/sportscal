#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const feedPipeline = require("../lib/server-feed-pipeline");
const feedDocument = require("../data/events.json");

const html = fs.readFileSync("index.html", "utf8");
const roundSummary = html.match(/function openSportRoundSummary\(sportKey, roundNumber\)\{[\s\S]*?\n\}/)?.[0] || "";
const activateTab = html.match(/function activateTopLevelTab\(nextTab,[\s\S]*?\n\}/)?.[0] || "";
const closeInspector = html.match(/function closeCodeInspector\([\s\S]*?\n\}/)?.[0] || "";

assert(roundSummary, "round-summary navigation must remain explicit and testable");
assert(roundSummary.includes("openCodeInspector"), "AFL/NRL round summaries must open Standings & Fixtures");
assert(roundSummary.includes('activeFilter = "all"'), "opening a round summary must clear legacy Feed focus");
assert(!roundSummary.includes("setActiveFeedFilter"), "a round summary must never replace Feed with one sport");
assert.match(roundSummary, /startingGroup:summary\?\.roundLabel \|\| `Round \$\{roundNumber\}`/, "the selected round must be retained inside Standings & Fixtures");

assert(activateTab.includes('if (activeTab === "feed")'), "Feed navigation must have an explicit mixed-feed reset");
assert(activateTab.includes('activeFilter = "all"'));
assert(activateTab.includes("curatedFeedReturnState = null"));
assert.match(closeInspector, /activeFilter = returnState\.activeTab === "feed" \? "all" : returnState\.activeFilter/, "returning from Standings & Fixtures must restore a mixed Feed");

const frozenProfile = {
  events:(feedDocument.events || []).slice(0, 40),
  userId:"11111111-1111-4111-8111-111111111111",
  userState:{ preferences:{},event_user_state:{},archivedEvents:[] },
  participants:[],
  sourceVersion:"mixed-feed-navigation-test",
  sourcePublishedAt:"2026-08-31T00:00:00.000Z",
  now:new Date("2026-08-31T06:00:00.000Z"),
};
assert.deepEqual(
  feedPipeline.buildServerFeed(frozenProfile),
  feedPipeline.buildServerFeed(frozenProfile),
  "repeated identical profiles and clocks must produce identical feeds",
);

console.log("Mixed Feed navigation passed: AFL/NRL round summaries stay in Standings & Fixtures and every Feed return clears legacy sport focus.");
