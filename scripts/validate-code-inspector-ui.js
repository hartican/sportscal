#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const manifestPath = path.join(ROOT, "data/code-inspector/manifest.json");

assert.deepEqual([...html.matchAll(/<span class="tab-label">([^<]+)<\/span>/g)].map(m=>m[1]),['Feed','Events','Follow']);
assert(html.includes('Back to Follow')&&html.includes('#follow/')&&html.includes('follow|standings-fixtures|inspect'),'legacy links resolve to Follow with Back restoration');
assert(html.includes('inspectorReturnState')&&html.includes('popstate'),'dedicated screens retain navigation state');
assert(html.includes('follow-sport-track')&&html.includes('follow-sport-pager')&&html.includes('follow-sport-pages'),'Follow uses a paged horizontal sport track');
assert(!html.includes('open.textContent = "Inspect"'),'sport icons replace Inspect');
for(const label of ['Schedule','Teams & players','Major Events','Ladder','Standings'])assert(html.includes(label));
assert(html.includes('renderCodeInspectorIdentity')&&html.includes('codeInspectorParticipantMark'),'Schedule reuses canonical identities');
assert(html.includes("return buildEventCard(event,{mode:'schedule',inspectorFixture:fixture})")&&html.includes('cardViewStates'),'Schedule fixtures share independent card expansion state');
assert(html.includes('added ? "Remove from Feed" : "Add to Feed"')&&html.includes('manualPin:true'),'concrete fixture pins remain available');
assert(html.includes('inspectorAlwaysShowsAllFixtures'),'Schedule can browse all fixtures independently of follows');
assert(html.includes('confirmStandingsReveal'),'standings retain spoiler protection');
assert(html.includes('syncTopLevelNavigationState'),'navigation has one active state owner');

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
const { eventMatchesCode, mergeFixtureRecords } = require("./build-code-inspector");
const aflwCode = manifest.codes.find(code => code.id === "sport:aflw");
assert(aflwCode, "AFLW must be published as a separate Follow code");
assert.equal(aflwCode.slug, "aflw");
assert.equal(aflwCode.label, "AFLW");
assert.equal(aflwCode.parentSportId, "sport:afl", "AFLW must remain grouped under AFL");
const aflCode = manifest.codes.find(code => code.id === "sport:afl");
assert(aflCode, "AFL must remain available beside its AFLW child code");
assert.equal(eventMatchesCode({
  key: "aflw",
  sportDomainId: "sport:afl",
  discoverySportId: "sport:aflw",
  competitionId: "competition:aflw-2026",
}, aflCode), false, "AFL must not absorb AFLW fixtures");
assert.equal(eventMatchesCode({
  key: "aflw",
  sportDomainId: "sport:afl",
  discoverySportId: "sport:aflw",
  competitionId: "competition:aflw-2026",
}, aflwCode), true, "AFLW must recognise its own fixtures");
const aflwChunk = JSON.parse(fs.readFileSync(path.join(ROOT, aflwCode.chunkPath), "utf8"));
assert(aflwChunk.fixtures.length > 0, "AFLW must publish its full fixture list");
assert(aflwChunk.fixtures.every(fixture => fixture.competitionId !== "competition:afl-premiership-2026"), "the AFLW chunk must not contain men's AFL fixtures");
const aflChunk = JSON.parse(fs.readFileSync(path.join(ROOT, aflCode.chunkPath), "utf8"));
assert(aflChunk.fixtures.every(fixture => fixture.competitionId !== "competition:aflw-2026"), "the AFL chunk must not contain AFLW fixtures");
const canonicalCodes = [
  ...taxonomy.sportDomains.filter(code => code.isActive !== false),
  { id: "sport:aflw" },
  taxonomy.competitions.find(code => code.id === "competition:uefa-champions-league"),
].filter(Boolean);
assert.deepEqual(
  new Set(manifest.codes.map(code => code.id)),
  new Set(canonicalCodes.map(code => code.id)),
  "Follow Schedule must cover every active canonical code, including unfollowed codes"
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

const canonicalBundle = JSON.parse(fs.readFileSync(path.join(ROOT, "data/canonical/afl-nrl-2026.json"), "utf8"));
const canonicalAflwFixtures = canonicalBundle.events.filter(event => event.competitionId === "competition:aflw-2026");
const publishedAflwFixtureIds = new Set(aflwChunk.fixtures.map(fixture => fixture.id));
assert(canonicalAflwFixtures.length > 0, "the canonical AFLW schedule must not be empty");
assert(canonicalAflwFixtures.every(fixture => publishedAflwFixtureIds.has(fixture.id)), "every canonical AFLW fixture must be published in the AFLW chunk");
assert(canonicalBundle.ladderSnapshots.some(snapshot => snapshot.competitionId === "competition:aflw-2026" && snapshot.entries?.length), "AFLW must have a published ladder for its Standings tab");
const publishedFeed = JSON.parse(fs.readFileSync(path.join(ROOT, "data/events.json"), "utf8"));
const placeholderPattern = /(?:winner|loser|highest|lowest)[ -]ranked|winner of|loser of|\bTBC\b/i;
for (const fixture of canonicalBundle.events.filter(event => event.status === "scheduled" && /final/i.test(event.roundLabel || "") && event.participantIds?.length === 2 && !placeholderPattern.test(event.displayName || ""))){
  const card = publishedFeed.events.find(event => event.canonicalEventId === fixture.id);
  if (!card) continue;
  assert.equal(card.name, fixture.displayName, `${fixture.id} must replace a resolved finals placeholder with canonical team names`);
  assert(!placeholderPattern.test(card.name), `${fixture.id} must not retain a bracket placeholder after both teams resolve`);
}

console.log(`Follow Schedule and Standings UI contract valid across ${manifest.codes.length} canonical codes.`);
