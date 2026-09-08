#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const {catalogue} = require("../lib/calendar-catalogue");
const identity = require("../config/fixture-identity");
const policy = require("../config/follow-feed-policy");
const lifecycle = require("../config/card-lifecycle");
const {buildServerFeed} = require("../lib/server-feed-pipeline");
const manifest = require("../data/code-inspector/manifest.json");
const candidates = catalogue();
const ids = event => [event?.canonicalEventId,event?.eventId,event?.id].filter(Boolean).map(id=>id.toLowerCase().replace(/[^a-z0-9]/g,""));
const candidateIds = new Set(candidates.flatMap(ids));
const now = new Date("2026-09-07T00:00:00Z");
const rows = [];
for (const code of manifest.codes){
  const chunk = JSON.parse(fs.readFileSync(path.resolve(__dirname,"..",code.chunkPath),"utf8"));
  const events = chunk.fixtures.map(fixture => identity.fromSchedule(fixture,code));
  for (const event of events) assert(ids(event).some(id => candidateIds.has(id)),`${code.id}: Schedule fixture ${event.id} missing from shared catalogue`);
  const active = events.filter(event => lifecycle.lifecycleState(event,{now}).state === "active");
  const preferences = {followedSports:[...new Set(events.map(event => event.key))],preferenceGraph:{domainPreferences:[{sportDomainId:code.id,enabled:true}]}};
  const eligible = active.filter(event => identity.retainedInActiveTimeline(event,now) && require('../config/follow-first').reasonForEvent(event,preferences));
  const returned = new Set(), cards = new Set();
  let cursor = 0;
  do {
    const page = buildServerFeed({events,userId:"public-coverage-audit",userState:{preferences},now,cursor,limit:1000});
    page.events.forEach(event => ids(event).forEach(id=>returned.add(id)));
    page.derivedCardCache.derivedCards.forEach(card => ids(card).forEach(id=>cards.add(id)));
    cursor = page.pagination.nextCursor;
  } while(cursor !== null);
  for (const event of eligible){
    assert(ids(event).some(id=>returned.has(id)),`${code.id}: eligible ${event.id} missing from server Feed`);
    assert(ids(event).some(id=>cards.has(id)),`${code.id}: eligible ${event.id} missing its renderable card`);
  }
  rows.push({code:code.id,source:code.coverageStatus,known:events.length,active:active.length,eligible:eligible.length,
    september1to9:events.filter(event=>event.date >= "2026-09-01" && event.date <= "2026-09-09").length});
}
console.table(rows);
console.log("Every published Schedule fixture is reachable; every active policy-eligible fixture has a server card. Empty/partial source coverage above is not proof of complete real-world calendars.");
