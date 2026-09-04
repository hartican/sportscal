#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const manifestPath = path.join(ROOT, "data/code-inspector/manifest.json");

assert(html.includes('<span class="tab-label">Standings &amp; Fixtures</span>'), "top navigation must be named Standings & Fixtures");
assert(!html.includes("Code Inspector"), "the retired Code Inspector label must not remain user-facing");
assert(html.includes('return "#standings-fixtures"') && html.includes("#standings-fixtures/") && html.includes("history.pushState") && html.includes("popstate"), "Standings & Fixtures must use picker and detail history states with browser Back");
assert(html.includes("history.replaceState({ inspectorFeed: true }") && html.includes("history.pushState({ inspectorPicker: true }") && html.includes("history.pushState({ codeInspector: codeId, inspectorParent: true }"), "direct code deep links must synthesize Feed, Inspector and detail history entries");
assert(html.includes("activeInspectorCodeId") && html.includes("inspectorReturnState"), "Inspector must preserve a separate feed return state");
assert(html.includes('back.textContent = "Back to Standings & Fixtures"'), "detail must return to Standings & Fixtures rather than directly to Feed");
assert(html.includes('window.scrollTo({ top: 0, behavior: "auto" })') && html.indexOf('window.scrollTo({ top: 0, behavior: "auto" })') < html.indexOf("await loadCodeInspectorChunk(codeId)"), "Inspector detail must jump to top exactly before deferred fixture hydration");
assert(!html.includes("tuneSelectAllBtn") && !html.includes("tuneDeselectAllBtn") && !html.includes('role="checkbox"'), "visit-scoped multi-select filtering must be removed from Inspector");
assert(html.includes('open.textContent = "Inspect"') && html.includes("More codes"), "every canonical code must expose Inspect and unfollowed codes must collapse under More codes");
assert(html.includes("orderCodeInspectorHierarchy") && html.includes("code.parentSportId"), "child codes must stay directly beneath their parent in Standings & Fixtures");
assert(html.includes("renderCodeInspectorIdentity") && html.includes("renderEventIdentityMark(identity, event, sportMetaForEvent(event))"), "Inspector rows and headings must use the central official identity registry");
assert(html.includes('frame.className = "code-inspector-team-icon identity-frame"') && html.includes('logo.width = 24') && html.includes('logo.height = 24'), "each Inspector participant must have a fixed 24px canonical identity frame");
assert(html.includes("codeInspectorParticipantMark") && html.includes("appendTeamIdentityFallback(frame, mark, label)"), "recognised participants must resolve by canonical identity, flag or monogram rather than a question mark");
assert(html.includes("codeInspectorExpandedFixtureIds") && html.includes('row.setAttribute("aria-expanded", String(expanded))'), "fixture cards must retain independent session expansion state");
assert(html.includes('added ? "Remove from Feed" : "Add to Feed"') && html.includes("manualPin:true"), "future concrete fixtures must persist an explicit Add/Remove Feed pin");
assert(html.includes('if (snapshot){') && html.includes('className = "code-inspector-status-stamp"') && html.includes('fixture.scheduleStatus === "provisional"'), "past and unresolved fixtures must omit the pin action and use a compact status stamp");
assert(html.includes('sportHubState.activeTab = "all-fixtures"') && html.includes("inspectorAlwaysShowsAllFixtures"), "Standings & Fixtures must always expose the complete timetable independently of Feed follows");
assert(html.includes('recordFeedInteraction("inspector_fixture_render"') && html.indexOf('recordFeedInteraction("inspector_open"') < html.indexOf("await loadCodeInspectorChunk(codeId)"), "Inspector performance must measure rendering separately from fixture transfer latency");
assert(html.includes('["results", "Results"]') && !html.includes("Results/Replays") && !html.includes("results-replays"), "Inspector result labels and state identifiers must not imply video replays");
assert(html.includes('settingsMenuItem("subscriptions", "ui:watch", "Subscriptions"') && html.includes('settingsMenuItem("notifications", "ui:bell", "Notifications"') && html.includes('settingsMenuItem("location", "ui:map-pin", "Set location"'), "Settings must expose the follow-first utility entries");
assert(!html.includes('id="frothKnobList"') && !html.includes("Sports followed & Tune"), "retired Froth settings must not remain user-facing");
assert(html.includes("scheduleStatus") && html.includes("participantSlots") && html.includes("detailsExpectedAt"), "fixture rendering must support stable finals placeholders");
assert(html.includes("Details likely known by") && html.includes("TBC"), "unknown finals details must be explicit and dated");
assert(/starting-round-select[\s\S]{0,220}min-height:\s*48px/.test(html), "Starting round must provide a 48px minimum touch target");
assert(html.includes("confirmStandingsReveal") && !html.includes("Show Standings"), "spoiler-safe standings must use one confirmation without an intermediate second action");
assert(html.includes("identity-frame") && html.includes("object-fit: contain") && html.includes("overflow: hidden"), "all official identities must stay inside reserved role frames");
assert(html.includes("syncTopLevelNavigationState") && html.includes('button.setAttribute("aria-current", "page")'), "one central navigation state must own the only active underline and aria-current marker");

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
assert(aflwCode, "AFLW must be published as a separate Standings & Fixtures code");
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
  "Standings & Fixtures must cover every active canonical code, including unfollowed codes"
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

console.log(`Standings & Fixtures UI contract valid across ${manifest.codes.length} canonical codes.`);
