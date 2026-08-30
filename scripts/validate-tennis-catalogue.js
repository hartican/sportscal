#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const tennisCoverage = require("../config/tennis-coverage.js");
const { assertFresh, generateCatalogue } = require("./refresh-tennis-catalogue.js");
const { syncTennisTournaments } = require("./sync-tennis-tournaments-to-feed.js");

const catalogue = generateCatalogue();
const feed = JSON.parse(fs.readFileSync("feeds/incoming/events.json", "utf8"));

assert.equal(catalogue.schemaVersion, "tennis-catalogue.v1");
assert.equal(catalogue.refreshPolicy.rankingsCadence, "weekly");
assert.equal(catalogue.refreshPolicy.parityRequired, false);
assert.equal(catalogue.refreshPolicy.independentPublicationFreshnessRequired, true);
assert.equal(catalogue.refreshPolicy.failureMode, "retain_last_good_and_fail_closed");
const verifiedNextDayPublication = {
  ...catalogue,
  sources: catalogue.sources.map(source => source.tour ? {
    ...source,
    effectiveDate: "2026-08-31",
    publicationCheckedAt: "2026-08-30T03:45:00.000Z",
    ingestionMode: "public_first_party",
    sourceTrust: "verified",
  } : source),
};
assert.equal(
  assertFresh(verifiedNextDayPublication, "2026-08-30"),
  0,
  "a verified first-party ranking published one UTC calendar day early is current rather than impossibly future"
);
assert.throws(
  () => assertFresh({
    ...verifiedNextDayPublication,
    sources: verifiedNextDayPublication.sources.map(source => source.tour === "ATP" ? { ...source, sourceTrust: "unverified" } : source),
  }, "2026-08-30"),
  /impossible future date/,
  "the one-day publication lead must never admit unverified ranking data"
);
assert.throws(
  () => assertFresh({
    ...verifiedNextDayPublication,
    sources: verifiedNextDayPublication.sources.map(source => source.tour === "ATP" ? { ...source, publicationCheckedAt: "2026-08-29T23:59:59.000Z" } : source),
  }, "2026-08-30"),
  /impossible future date/,
  "the one-day publication lead must be observed on the current UTC publication-check day"
);
assert.throws(
  () => assertFresh({
    ...verifiedNextDayPublication,
    sources: verifiedNextDayPublication.sources.map(source => source.tour === "ATP" ? { ...source, effectiveDate: "2026-09-01" } : source),
  }, "2026-08-30"),
  /impossible future date/,
  "a verified first-party snapshot more than one UTC calendar day ahead must still fail closed"
);
const independentlyConfirmedFixture = {
  ...catalogue,
  sources: catalogue.sources.map(source => source.tour === "ATP" ? {
    ...source,
    effectiveDate: "2026-08-10",
    publicationCheckedAt: "2026-08-20T00:00:00.000Z",
    ingestionMode: "public_first_party",
    sourceTrust: "verified",
  } : source.tour === "WTA" ? {
    ...source,
    effectiveDate: "2026-08-17",
    publicationCheckedAt: "2026-08-20T00:00:00.000Z",
    ingestionMode: "public_first_party",
    sourceTrust: "verified",
  } : source),
};
assert.equal(assertFresh(independentlyConfirmedFixture, "2026-08-20"), 10, "a bounded older snapshot is publishable only when the tour's latest official publication was checked recently");
assert.throws(
  () => assertFresh({
    ...independentlyConfirmedFixture,
    sources: independentlyConfirmedFixture.sources.map(source => source.tour === "ATP" ? { ...source, publicationCheckedAt: "2026-08-17T00:00:00.000Z" } : source),
  }, "2026-08-20"),
  /recently confirmed latest official publication/,
  "an old confirmation must never excuse an old ranking snapshot"
);
assert.throws(
  () => assertFresh({
    ...independentlyConfirmedFixture,
    sources: independentlyConfirmedFixture.sources.map(source => source.tour === "ATP" ? { ...source, effectiveDate: "2026-08-01" } : source),
  }, "2026-08-20"),
  /recently confirmed latest official publication/,
  "the bounded maximum publication lag must still fail closed"
);

const byTour = tour => catalogue.athletes.filter(athlete => athlete.tour === tour);
for (const tour of ["ATP", "WTA"]) {
  const athletes = byTour(tour);
  assert(athletes.length >= 50, `${tour} must have a complete catalogue universe`);
  assert.equal(athletes.filter(athlete => athlete.rankingSingles <= 50).length, 50, `${tour} must have exactly the Top 50`);
  assert(athletes.filter(athlete => athlete.rankingSingles <= 50).every(athlete => Number.isFinite(athlete.rankingPoints)), `${tour} Top 50 must retain ranking points`);
  assert(athletes.some(athlete => athlete.isAustralian && athlete.rankingSingles > 50), `${tour} must retain Australians outside the Top 50`);
  assert(athletes.every(athlete => athlete.isAustralian === (athlete.nationalityCode === "AUS")), `${tour} Australian status must derive from represented country`);
  assert(athletes.every(athlete => ["verified", "unverified"].includes(athlete.rankingSourceTrust)), `${tour} rankings must retain source trust provenance`);
}

const marqueeLevels = new Set(catalogue.tournaments.map(tournament => tournament.level));
assert.equal(new Set(catalogue.tournaments.map(tournament => tournament.tournamentId)).size, catalogue.tournaments.length, "canonical tournament IDs must stay unique when ATP and WTA share a city and title");
for (const level of ["grand_slam", "atp_masters_1000", "wta_1000", "atp_finals", "wta_finals", "team_competition"]) {
  assert(marqueeLevels.has(level), `tournament normalization must cover ${level}`);
}
assert(catalogue.tournaments.some(tournament => tournament.representedTours.includes("ATP")));
assert(catalogue.tournaments.some(tournament => tournament.representedTours.includes("WTA")));

const top50Match = { level: "wta_1000", tour: "WTA", round: "early", participants: [{ rankingSingles: 12 }] };
const australianMatch = { level: "wta_250", tour: "WTA", round: "early", participants: [{ rankingSingles: 90, isAustralian: true }] };
assert(tennisCoverage.inclusionReasons(top50Match).includes("top_50"));
assert(tennisCoverage.inclusionReasons(australianMatch).includes("australian"));
assert(tennisCoverage.isCatalogueEligible(australianMatch), "an Australian outside the Top 50 remains eligible");

const behaviours = {
  low: tennisCoverage.isVisibleAtFroth({ ...top50Match, round: "quarterfinal" }, "low"),
  balanced: tennisCoverage.isVisibleAtFroth({ ...top50Match, cardType: "tournament_overview" }, "balanced"),
  high: tennisCoverage.isVisibleAtFroth({ level: "wta_250", round: "early", participants: [] }, "high"),
  maximum: tennisCoverage.isVisibleAtFroth({ level: "challenger", round: "final", participants: [] }, "maximum"),
};
assert.deepEqual(behaviours, { low: true, balanced: true, high: true, maximum: true }, "all four tennis froth contracts must retain their defining coverage");

const toronto = catalogue.tournaments.find(tournament => tournament.providerAlias.includes("wta-toronto-806"));
assert(toronto, "the Toronto WTA 1000 regression fixture must be normalized");
assert.equal(toronto.level, "wta_1000");
assert.equal(tennisCoverage.isTournamentActive(toronto, "2026-08-13"), true);
assert.equal(tennisCoverage.isVisibleAtFroth({ ...toronto, active: true, cardType: "tournament_overview", round: "all", participants: [] }, "balanced"), true, "Toronto must not require a followed player at balanced froth");
assert(
  tennisCoverage.rankingScore({ ...toronto, active: true }, { followedTours: ["WTA"] })
    > tennisCoverage.rankingScore({ level: "challenger", tour: "ATP", active: true }, {}),
  "an active followed-tour WTA 1000 must outrank long-tail tennis"
);

const torontoSync = syncTennisTournaments(feed, catalogue, { referenceDate: "2026-08-13", publishedAt: "2026-08-13T02:00:00.000Z" });
const torontoCards = torontoSync.generated.filter(event => event.tennisTournamentId === toronto.tournamentId);
assert.equal(torontoCards.length, 1, "Toronto must generate one active tournament card");
assert.equal(torontoCards[0].key, "tennis");
assert.equal(torontoCards[0].taxonomySportId, "sport:tennis");
assert.equal(torontoCards[0].taxonomyCompetitionId, "competition:wta-tour");
assert.equal(torontoCards[0].sourceUrl, "https://www.wtatennis.com/tournaments/806/toronto/2026");
assert.equal(torontoCards[0].editorialPreview.status, "journalistic", "active tournament overview cards inside the editorial window need source-backed preview metadata");
assert(torontoCards[0].editorialPreview.contextSignals.includes("closing-day"));
assert.match(torontoCards[0].selectedSentence, /women's WTA 1000 reaches the final day/, "Toronto must have event-specific closing-day copy rather than a generic active-tournament hook");
const cincinnatiCards = torontoSync.generated.filter(event => /cincinnati/i.test(event.name));
assert.equal(new Set(cincinnatiCards.map(event => event.selectedSentence)).size, cincinnatiCards.length, "simultaneous ATP and WTA tournaments must not share duplicate hooks");

const registry = require("../config/sport-domain-registry.js");
const hierarchy = require("../config/sport-hierarchy.js");
const taxonomy = require("../config/canonical-sports-taxonomy.js");
assert(registry.selectorLibrary().tennis, "Tennis must be a top-level surfaced sport");
assert.equal(hierarchy.canonicalNodeId("tennis"), "sport:tennis");
assert.equal(hierarchy.canonicalNodeId("wimbledon"), "event-series:wimbledon", "the legacy Wimbledon selection must retain exact event-series meaning");
assert(taxonomy.competitionFamilies.some(family => family.id === "family:atp-tour"));
assert(taxonomy.competitionFamilies.some(family => family.id === "family:wta-tour"));
for (const tour of ["atp", "wta"]) {
  const competition = taxonomy.competitions.find(item => item.id === `competition:${tour}-singles-2026`);
  assert(competition, `${tour.toUpperCase()} standings must be registered in the browser taxonomy`);
  assert.equal(competition.preferenceDomainId, "sport:tennis", `${tour.toUpperCase()} standings must follow the top-level Tennis preference`);
}

const sql = fs.readFileSync("supabase/nothingsports-tennis-catalogue.sql", "utf8");
assert(sql.includes("create table if not exists public.tennis_athletes"));
assert(sql.includes("create table if not exists public.tennis_tournaments"));
assert(sql.includes("force row level security"));
assert(!/grant\s+(insert|update|delete)/i.test(sql), "browser roles must never receive tennis catalogue writes");

console.log(`Tennis catalogue valid: ${catalogue.athletes.length} athletes, ${catalogue.tournaments.length} tournaments, independent ATP/WTA publication freshness, four froth levels, and Toronto automatic coverage.`);
