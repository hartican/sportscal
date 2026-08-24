#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const manifestPath = path.join(ROOT, "data/code-inspector/manifest.json");

assert(html.includes('<span class="tab-label">Code Inspector</span>'), "top navigation must be named Code Inspector");
assert(html.includes("#inspect/") && html.includes("history.pushState") && html.includes("popstate"), "Inspector must use dedicated history state and browser Back");
assert(html.includes("activeInspectorCodeId") && html.includes("inspectorReturnState"), "Inspector must preserve a separate feed return state");
assert(!html.includes("tuneSelectAllBtn") && !html.includes("tuneDeselectAllBtn") && !html.includes('role="checkbox"'), "visit-scoped multi-select filtering must be removed from Code Inspector");
assert(html.includes('open.textContent = "Inspect"') && html.includes("More codes"), "every canonical code must expose Inspect and unfollowed codes must collapse under More codes");
assert(html.includes("renderCodeInspectorIdentity") && html.includes("renderEventIdentityMark(identity, event, sportMetaForEvent(event))"), "Inspector rows and headings must use the central official identity registry");
assert(html.includes('sportHubState.activeTab = "all-fixtures"') && html.includes("inspectorAlwaysShowsAllFixtures"), "Inspector must always open All Fixtures independently of Froth");
assert(html.includes('recordFeedInteraction("inspector_fixture_render"') && html.indexOf('recordFeedInteraction("inspector_open"') < html.indexOf("await loadCodeInspectorChunk(codeId)"), "Inspector performance must measure rendering separately from fixture transfer latency");
assert(html.includes('["results", "Results"]') && !html.includes("Results/Replays") && !html.includes("results-replays"), "Inspector result labels and state identifiers must not imply video replays");
assert(html.includes("Sports followed & Tune") && html.includes("Sports") && html.includes("Froth knobs"), "Settings must expose Sports and Froth knobs tabs under the retained entry name");
assert(html.includes("Froth represents enthusiasm for a sport") && html.includes("Code Inspector always shows All Fixtures"), "the accessible Froth help must explain feed effects and Inspector isolation");
assert(html.includes("scheduleStatus") && html.includes("participantSlots") && html.includes("detailsExpectedAt"), "fixture rendering must support stable finals placeholders");
assert(html.includes("Details likely known by") && html.includes("TBC"), "unknown finals details must be explicit and dated");
assert(/starting-round-select[\s\S]{0,220}min-height:\s*48px/.test(html), "Starting round must provide a 48px minimum touch target");
assert(html.includes("confirmStandingsReveal") && !html.includes("Show Standings"), "spoiler-safe standings must use one confirmation without an intermediate second action");
assert(html.includes("identity-frame") && html.includes("object-fit: contain") && html.includes("overflow: hidden"), "all official identities must stay inside reserved role frames");

assert(fs.existsSync(manifestPath), "the canonical update must publish code-inspector.v1");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
assert.equal(manifest.schemaVersion, "code-inspector.v1");
assert(Array.isArray(manifest.codes) && manifest.codes.length > 0);
assert(manifest.codes.every(code => (
  code.id
  && Number.isInteger(code.fixtureCount)
  && ["round", "stage", "competition-date"].includes(code.groupingMode)
  && ["complete", "partial", "unavailable"].includes(code.coverageStatus)
  && typeof code.chunkPath === "string"
)), "every code manifest row must state grouping, coverage and a lazy chunk");

const taxonomy = require("../config/canonical-sports-taxonomy");
const { mergeFixtureRecords } = require("./build-code-inspector");
const canonicalCodes = taxonomy.sportDomains.filter(code => code.isActive !== false);
assert.deepEqual(
  new Set(manifest.codes.map(code => code.id)),
  new Set(canonicalCodes.map(code => code.id)),
  "Inspector must cover every active canonical code, including unfollowed codes"
);

const placeholder = {
  id: "event:test:final-1",
  codeId: "sport:nrl",
  name: "Qualifying Final 1",
  date: null,
  time: null,
  venue: null,
  scheduleStatus: "provisional",
  participantSlots: [{ slot: 1, label: "1st" }, { slot: 2, label: "4th" }],
  detailsExpectedAt: "2026-09-07T09:00:00+10:00",
  schedulingWindow: { startsOn: "2026-09-11", endsOn: "2026-09-13", timeZone: "Australia/Sydney" },
};
const confirmed = {
  id: placeholder.id,
  name: "Broncos v Storm",
  startTimeUtc: "2026-09-11T09:50:00.000Z",
  venueName: "Suncorp Stadium",
  participantIds: ["team:nrl:322", "team:nrl:324"],
  roundLabel: "Qualifying Final 1",
};
const merged = mergeFixtureRecords([placeholder], [confirmed], "sport:nrl", new Set([confirmed]));
assert.equal(merged.length, 1, "a confirmed final must replace its stable placeholder rather than duplicate it");
assert.equal(merged[0].id, placeholder.id);
assert.equal(merged[0].scheduleStatus, "confirmed");
assert.equal(merged[0].venue, "Suncorp Stadium");
assert.equal(merged[0].sourceCoverage, "official-canonical");
assert.deepEqual(merged[0].participantSlots.map(slot => slot.label), ["Broncos", "Storm"]);
assert.equal(merged[0].detailsExpectedAt, null);

console.log(`Code Inspector UI contract valid across ${manifest.codes.length} canonical codes.`);
