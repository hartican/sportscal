#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), "utf8");
const json = relativePath => JSON.parse(read(relativePath));

global.window = global;
const taxonomy = require(path.join(ROOT, "config/selector-taxonomy.js"));
const followFirst = require(path.join(ROOT, "config/follow-first.js"));
const identities = require(path.join(ROOT, "config/card-identities.js"));

const html = read("index.html");
const exposedSports = taxonomy.exposedSportNodes.filter(node => Number(node.level) === 2);
const exposedIds = exposedSports.map(node => node.id);
assert.equal(exposedSports.length, 19, "the user-facing catalogue must expose exactly nineteen top-level sports");
assert(exposedIds.includes("sport:ice-hockey"), "Ice Hockey must be a first-class exposed sport");
for (const retiredId of ["sport:hockey", "sport:gymnastics", "sport:multi-sport"]){
  assert(!exposedIds.includes(retiredId), `${retiredId} must not remain user-facing`);
}
assert(taxonomy.byId["cwg:hockey"] && taxonomy.byId["cwg:gymnastics"] && taxonomy.byId["cwg:miscellaneous"], "retired user-facing sports must retain internal Commonwealth Games compatibility nodes");

const startupIds = followFirst.STARTUP_SPORTS.map(sport => sport.id);
for (const requiredId of ["american-football", "ice-hockey", "swimming"]){
  assert(startupIds.includes(requiredId), `${requiredId} must be offered during signup`);
}
assert(!followFirst.MAJOR_EVENT_FAMILIES.some(event => event.id === "cincinnati-open"), "failed Cincinnati must not remain a followable major event");
assert.equal(followFirst.TENNIS_LEGENDS_WATCHLIST.length, 10, "Tennis must ship a ten-name legends and exhibitions watchlist");
const legacyPreferences = {
  followedSports:["sport:multi-sport", "sport:hockey", "sport:gymnastics"],
  selectedSelectorEntityIds:["sport:multi-sport", "sport:hockey", "sport:gymnastics"],
  followFirst:{ followedMajorEventIds:[] },
};
const migratedPreferences = followFirst.migratePreferences(legacyPreferences);
assert.deepEqual(migratedPreferences.followedSports, [], "retired sports must be removed rather than remapped to Ice Hockey");
assert.deepEqual(migratedPreferences.selectedSelectorEntityIds, [], "retired selectors must leave the user-facing profile");
assert(migratedPreferences.followFirst.followedMajorEventIds.includes("commonwealth-games"), "a legacy Other Games follow must migrate to the Commonwealth Games major event");
assert.deepEqual(followFirst.migratePreferences(migratedPreferences), migratedPreferences, "the retired-sport preference migration must be idempotent");

const manifest = json("data/follow-directory/manifest.v1.json");
assert.equal(manifest.sports.length, 19, "the lazy Follow manifest must match the nineteen exposed sports");
const chunks = new Map(manifest.sports.map(sport => [sport.key, json(sport.jsonUrl)]));
const swimming = chunks.get("swimming")?.records || [];
assert.equal(swimming.length, 60, "Swimming must contain exactly sixty current ranked athletes");
assert.equal(swimming.filter(record => record.genderCategory === "female").length, 30, "Swimming must contain thirty women");
assert.equal(swimming.filter(record => record.genderCategory === "male").length, 30, "Swimming must contain thirty men");
assert(swimming.every(record => record.entityType === "athlete" && Number.isFinite(record.ranking)), "every swimmer must be a ranked athlete");

const nfl = chunks.get("american-football")?.records || [];
assert.equal(nfl.filter(record => record.entityType === "team").length, 32, "NFL must expose all thirty-two teams");
assert(nfl.filter(record => record.entityType === "athlete").length >= 1500, "NFL must expose complete current active rosters");
const iceHockey = chunks.get("ice-hockey")?.records || [];
assert(iceHockey.filter(record => record.leagueId === "competition:nhl" && record.entityType === "team").length === 32, "NHL must expose all thirty-two clubs");
assert(iceHockey.filter(record => record.entityType === "athlete").length >= 700, "Ice Hockey must expose complete current rosters");
const iceHockeyCanonical = json("data/canonical/ice-hockey-directory.v1.json");
assert.equal(iceHockeyCanonical.sourceStatus.nhl.standingsStatus, "not-started", "unpublished 2026–27 NHL standings must not inherit the previous season's table");
assert.equal(iceHockeyCanonical.standings.filter(row => row.competitionId === "competition:nhl").length, 0, "the previous NHL season must not be presented as the current ladder");
assert(iceHockeyCanonical.fixtures.filter(fixture => fixture.competitionId === "competition:chl").every(fixture => fixture.viewingOptions?.[0]?.providerId === "iihf-tv" && fixture.viewingOptions[0].linkScope === "sport"), "CHL fixtures must use the verified IIHF.TV all-other-markets fallback without inventing fixture permalinks");

for (const [sportKey, chunk] of chunks){
  for (const record of chunk.records.filter(item => item.entityType === "team")){
    assert(record.identityId, `${sportKey}/${record.id}: team identity is required`);
    assert(!record.countryFlagOnly, `${sportKey}/${record.id}: a club or franchise cannot rely on a country flag`);
    if (["american-football", "ice-hockey"].includes(sportKey)){
      assert(record.logoUrl, `${sportKey}/${record.id}: every NFL/NHL club must have a crest`);
    }
  }
}

assert(!/window\.addEventListener\("scroll", scheduleCardRetractionDuringScroll/.test(html), "scrolling must never auto-collapse expanded Feed cards");
assert(!/CARD_RETRACTION_SCROLL_IDLE_MS/.test(html), "the delayed scroll retraction timer must be removed");
assert(html.includes("warmNextFeedPageDuringIdle"), "the next Feed page must warm without rebuilding the visible page");
assert(html.includes("decodeIdentityImageInPlace"), "identity images must reveal only after decode without rerendering their card");
assert(html.includes("loading-indicator-overlay"), "the top-bar loader must use an overlay that cannot displace date/time chrome");
assert(html.includes('code-inspector-viewing-action') && html.includes('configureProviderLaunch(watch, viewing)'), "expanded Standings & Fixtures cards must expose the same verified provider action as other fixture surfaces");

const viewing = followFirst.viewingLink({
  key:"tennis",
  competitionId:"competition:tennis:us-open",
  status:"scheduled",
  viewingOptions:[{
    providerId:"stan",
    webUrl:"https://www.stan.com.au/watch/example-us-open-match",
    linkScope:"fixture",
    sourceUrl:"https://www.stan.com.au/watch/example-us-open-match",
    verifiedAt:"2026-08-26T00:00:00.000Z",
    permalinkVerifiedAt:"2026-08-26T00:00:00.000Z",
  }],
});
assert.equal(viewing.linkScope, "fixture");
assert.equal(viewing.webUrl, "https://www.stan.com.au/watch/example-us-open-match");
assert(viewing.permalinkVerifiedAt, "fixture permalinks must retain their verification timestamp");

const rights = json("data/coverage/australian-viewing-rights.v1.json");
assert.equal(rights.sports.length, 19, "the Australian rights matrix must match the active catalogue");
assert(rights.sports.some(sport => sport.key === "ice-hockey"), "Ice Hockey viewing rights must be audited");
assert(!rights.sports.some(sport => ["hockey", "gymnastics", "multi-sport"].includes(sport.key)), "retired sport rows must leave the active rights matrix");

const majorEvents = json("data/major-events.v1.json");
const cincinnati = majorEvents.events.find(event => event.id === "major-event:cincinnati-open-2026");
assert(cincinnati?.lifecycleStatus === "retired" && cincinnati?.retiredReason === "source-failed", "Cincinnati must retain a safe retired tombstone");
const usOpen = majorEvents.events.find(event => event.id === "major-event:us-open-2026");
assert(usOpen, "US Open Event card is required");
assert((usOpen.subEvents || []).some(match => /federer/i.test(JSON.stringify(match))), "US Open must include the Federer legends exhibition");
assert((usOpen.subEvents || []).some(match => /serena williams/i.test(JSON.stringify(match))), "US Open must include Serena Williams");
assert((usOpen.subEvents || []).filter(match => Array.isArray(match.matchupSides) && match.matchupSides.length === 2).length >= 2, "US Open children must persist concrete one- or two-player sides");

console.log("Feed stability, sport catalogue, identity, viewing and Event reliability contract valid.");
