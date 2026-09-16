#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const reconciliation = require("../config/feed-fixture-reconciliation");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const inlineSource = html.slice(
  html.indexOf("function fxAliases("),
  html.indexOf("const COMPETITION_CLASSIFICATION")
);
const inlineContext = vm.createContext({});
vm.runInContext(`${inlineSource};globalThis.reconciliation=FEED_FIXTURE_RECONCILIATION;`, inlineContext);

// This is the exact identity split retained by an installed PWA after the
// Cricket Australia and ESPN records were consolidated in the published feed.
const cachedCricketAustralia = {
  id:"fixture:cricket:CA:40288",
  sourceEventIds:["fixture:cricket:CA:40288"],
  codeId:"sport:cricket",
  key:"cricket",
  competitionId:"competition:cricket:4621",
  name:"Zimbabwe Men v Australia Men",
  startTimeUtc:"2026-09-15T07:30:00.000Z",
  participantIds:["team:cricket:zimbabwe", "team:cricket:australia"],
  broadcaster:null,
  viewingOptions:[],
};

const publishedEspn = {
  id:"fixture:cricket:espn:1530203",
  sourceEventIds:["fixture:cricket:espn:1530203", "fixture:cricket:CA:40288"],
  codeId:"sport:cricket",
  key:"cricket",
  competitionId:"competition:cricket:espn:24303",
  name:"Zimbabwe v Australia",
  startTimeUtc:"2026-09-15T07:30:00.000Z",
  participantIds:["team:cricket:zimbabwe", "team:cricket:australia"],
  broadcaster:"Fox Cricket / Foxtel / Kayo Sports",
  viewingOptions:[{ providerId:"kayo", name:"Kayo Sports", url:"https://kayosports.com.au/" }],
};

assert.equal(
  reconciliation.semanticFixtureKey(cachedCricketAustralia),
  reconciliation.semanticFixtureKey(publishedEspn),
  "provider-specific competition IDs must not split the same sport, start and participants"
);
assert.equal(
  reconciliation.canonicalFixtureFor(cachedCricketAustralia, [publishedEspn]),
  publishedEspn,
  "the refreshed richer record must replace the installed PWA's stale provider record"
);
assert.deepEqual(
  reconciliation.reconcileFixtures([publishedEspn], [cachedCricketAustralia]),
  [publishedEspn],
  "cache reconciliation must render one card and retain the Kayo-equipped record"
);
assert.notEqual(
  reconciliation.semanticFixtureKey(publishedEspn),
  reconciliation.semanticFixtureKey({...publishedEspn, startTimeUtc:"2026-09-18T07:30:00.000Z"}),
  "separate matches between the same teams remain distinct"
);

assert.equal(
  inlineContext.reconciliation.semanticFixtureKey(cachedCricketAustralia),
  inlineContext.reconciliation.semanticFixtureKey(publishedEspn),
  "the actual browser reconciliation must ignore provider-specific competition IDs"
);
assert.deepEqual(
  JSON.parse(JSON.stringify(inlineContext.reconciliation.reconcileFixtures([publishedEspn], [cachedCricketAustralia]))),
  [publishedEspn],
  "the installed browser path must retain one current Kayo-equipped card"
);

const canonicalF1 = {
  id:"evt_30", eventId:"evt_30", canonicalEventId:"event:f1:2026:azerbaijan:qualifying",
  key:"f1", name:"Azerbaijan GP · Qualifying", date:"2026-09-25", startTimeUtc:"2026-09-25T12:00:00.000Z",
};
const providerF1 = {
  id:"provider:f1:991", eventId:"provider:f1:991", canonicalEventId:"provider:f1:991",
  key:"f1", name:"Azerbaijan Grand Prix Qualifying", date:"2026-09-25", startTimeUtc:"2026-09-25T12:00:00.000Z",
};
assert.equal(reconciliation.feedFixtureIdentity(canonicalF1),reconciliation.feedFixtureIdentity(providerF1),"F1 session identity is independent of provider IDs");
assert.equal(inlineContext.reconciliation.feedFixtureIdentity(canonicalF1),inlineContext.reconciliation.feedFixtureIdentity(providerF1),"installed browser uses the same F1 identity");
assert.equal(inlineContext.reconciliation.reconcileFixtures([canonicalF1],[providerF1]).length,1,"installed browser renders one F1 card per session");

console.log("Installed-PWA reconciliation converges Cricket and F1 provider records to one card.");
