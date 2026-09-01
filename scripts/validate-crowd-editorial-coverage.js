#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const demoPanel = require("../api/_nsc-modelled-panel");
const nsc = require("../config/nothingscore");
const { editorialNarrativeReadyForCard } = require("../config/enrichment-engine");
const server = require("../lib/nothingscore-server");

const feed = require("../data/events.json");
const majorEvents = require("../data/major-events.v1.json");
const footballDocuments = [
  require("../data/football/core-events.json"),
  require("../data/football/fixtures/bundesliga.json"),
  require("../data/football/fixtures/la-liga.json"),
  require("../data/football/fixtures/ligue-1.json"),
  require("../data/football/fixtures/premier-league.json"),
  require("../data/football/fixtures/serie-a.json"),
];
const frozenNow = new Date("2026-08-31T06:00:00.000Z");

function identity(record){
  return String(record?.canonicalEventId || record?.eventId || record?.id || "");
}

function crowdCopyFor(record){
  const rows = demoPanel.demoRows(record, "heat", frozenNow, { mode:"public" });
  const aggregate = nsc.aggregateRatings(rows);
  return server.crowdEditorial("heat", [], rows, nsc.aggregateRatings([]), aggregate, [], { includesModelled:true });
}

const records = [];
(feed.events || []).forEach(record => records.push({ surface:"Feed", id:identity(record), record }));
footballDocuments.forEach(document => (document.events || []).forEach(record => records.push({ surface:"Lazy football Feed", id:identity(record), record })));
(majorEvents.events || []).filter(record => record.kind !== "ticket_sale").forEach(parent => {
  records.push({ surface:"Events parent", id:parent.id, record:server.eventFor(parent.id), sourcedRecord:parent });
  (parent.subEvents || []).forEach(subEvent => records.push({
    surface:"Events child",
    id:subEvent.id,
    record:server.eventFor(subEvent.id),
    sourcedRecord:subEvent,
  }));
});

assert(records.length > 2500, "the release gate must audit the complete current Feed, lazy football, and Events catalogue");
const failures = [];
records.forEach(item => {
  const registered = server.eventFor(item.id) || item.record;
  if (!registered){
    failures.push(`${item.surface} ${item.id}: not registered`);
    return;
  }
  const first = crowdCopyFor(registered);
  const second = crowdCopyFor(registered);
  const sourced = editorialNarrativeReadyForCard(item.sourcedRecord?.editorialNarrative || item.record?.editorialNarrative);
  if (!first?.text && !sourced) failures.push(`${item.surface} ${item.id}: no deterministic crowd copy or validated sourced context`);
  if (first){
    assert.deepEqual(first, second, `${item.surface} ${item.id} must repeat exactly under a frozen clock`);
    assert.equal(first.mode, "demo", `${item.surface} ${item.id} must retain cached-reader mode compatibility`);
    assert.equal(first.presentationMode, "early", `${item.surface} ${item.id} must use the disclosed Early panel presentation`);
    assert.equal(Object.values(first.percentages).reduce((total,value)=>total+value,0), 100, `${item.surface} ${item.id} percentages must total 100`);
    assert.match(first.text, /^\d+% Major or Essential · \d+% Notable · \d+% Routine or Interesting, from \d+ contributors?\./);
  }
});
assert.deepEqual(failures, [], failures.join("\n"));

const ticketAlerts = (majorEvents.events || []).filter(record => record.kind === "ticket_sale");
assert(ticketAlerts.length > 0);
ticketAlerts.forEach(record => assert.equal(server.eventFor(record.id), null, `${record.id} must remain outside Nothingscore`));

const html = fs.readFileSync("index.html", "utf8");
assert.doesNotMatch(html, /mainDiv\.appendChild\(buildNothingscoreSummary\(ev\)\)/, "Feed cards must not surface crowd aggregates");
assert.doesNotMatch(html, /row\.appendChild\(buildNothingscoreSummary\(crowdEvent\)\)/, "Events child cards must not surface crowd aggregates");
assert.match(html, /buildEventWhyItMatters\(ev\)[\s\S]{0,1800}buildEventNothingscoreAction\(ev\)/, "Feed cards must keep the voluntary contribution action beneath sourced Why it matters copy and any in-flow editorial disclosure");
assert.match(html, /const editorialHook = buildEditorialL0Hook\(editorialNarrativeHookForDisplay\(editorialRecord\), editorialConsequenceForDisplay\(editorialRecord\)\);[\s\S]{0,220}buildEventNothingscoreAction\(crowdEvent\)/, "Events child cards must keep the voluntary contribution action beneath sourced Why it matters copy");
assert.doesNotMatch(html, /if \(crowdHook\)[\s\S]{0,120}else/, "crowd availability must never suppress sourced editorial");
assert.doesNotMatch(html, /labelText:"Independent context"/);
assert.doesNotMatch(html, /statistically significant/i);

console.log(`Crowd/editorial coverage passed: ${records.length}/${records.length} Feed and Events records retain deterministic collection data behind hidden card aggregates; ${ticketAlerts.length} ticket alerts remain excluded.`);
