#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const discovery = require("../config/broadcaster-discovery.js");
const {
  MAXIMUM_SNAPSHOT_AGE_DAYS,
  assertFreshSnapshots,
  buildReport,
  canonicalCatalogue,
  loadSnapshots,
  outputSet,
  sydneyDate,
} = require("./scan-broadcaster-coverage.js");
const { applyDecisions } = require("./review-coverage-candidates.js");
const { applyApprovedCoverage } = require("./apply-approved-coverage.js");

const prioritySourceIds = ["kayo", "foxtel", "stan_sport", "espn_au", "sbs", "9now", "7plus", "paramount_plus_au"];
assert.deepEqual(discovery.sourceProfiles.filter(source => source.priorityAu).map(source => source.id), prioritySourceIds, "all eight specified AU adapters must remain configured in order");
for (const sourceId of ["eurosport", "canal_plus_fr", "tnt_sports_uk", "dazn", "bein_sports_au"]) {
  assert(discovery.sourceProfiles.some(source => source.id === sourceId), `${sourceId} must remain available as an optional territory-scoped adapter`);
}
assert.deepEqual(discovery.ACCESS_TYPES, ["free", "included", "ppv", "unknown"]);
assert(discovery.services.some(service => service.id === "main_event" && service.defaultAccessType === "ppv"));
assert(discovery.services.some(service => service.id === "sbs_on_demand" && service.defaultAccessType === "free"));
assert.deepEqual(discovery.commercialSourceOptions.slice(0, 5).map(source => source.id), ["yuvu", "gracenote_on", "justwatch_sports", "sportradar", "stats_perform"], "the paid-source shortlist must keep linear EPG, streaming availability and fixture truth separate");
assert(discovery.commercialSourceOptions.every(source => /^https:\/\//.test(source.sourceUrl) && source.pricing), "every paid-source option needs a primary product link and pricing status");

function snapshotFor(sourceId, overrides = {}){
  const profile = discovery.sourceProfiles.find(source => source.id === sourceId);
  const serviceId = overrides.serviceId === undefined ? profile.defaultServiceId : overrides.serviceId;
  return {
    schemaVersion: "broadcaster-schedule-export.v1",
    snapshotId: `test-${sourceId}`,
    sourceId,
    sourceMode: profile.allowedModes.includes("manual_fixture") ? "manual_fixture" : profile.allowedModes[0],
    territory: overrides.territory || profile.territory,
    sourceUrl: "https://example.test/approved-source",
    observedAt: "2026-08-13T02:00:00Z",
    windowStart: "2026-08-13",
    windowEnd: "2026-08-20",
    items: [{
      sourceListingId: "listing-1",
      rawTitle: "Australia v Bangladesh First Test",
      rawSport: "Cricket",
      rawCompetition: "International cricket",
      rawParticipants: ["Australia", "Bangladesh"],
      venue: "Marrara Cricket Ground, Darwin",
      territory: overrides.territory || profile.territory,
      ...(serviceId ? { serviceId } : {}),
      accessType: overrides.accessType || "included",
      liveOrReplay: overrides.liveOrReplay || "live",
      timeConfidence: overrides.timeConfidence || "exact",
      localDate: "2026-08-13",
      eventStartsAtUtc: "2026-08-13T00:30:00Z",
    }],
  };
}

prioritySourceIds.forEach(sourceId => {
  const normalized = discovery.normalizeSnapshot(snapshotFor(sourceId, {
    serviceId: sourceId === "espn_au" ? "disney_plus_au" : undefined,
  }));
  assert.equal(normalized.sourceId, sourceId);
  assert.equal(normalized.items.length, 1);
  assert.equal(normalized.items[0].canEstablishAuAvailability, true, `${sourceId} must normalize an explicit AU service option`);
});

const international = discovery.normalizeSnapshot(snapshotFor("tnt_sports_uk", { territory: "GB", serviceId: null }));
assert.equal(international.items[0].canEstablishAuAvailability, false, "international discovery must never fabricate AU availability");

const replay = discovery.normalizeSnapshot(snapshotFor("stan_sport", { liveOrReplay: "replay" })).items[0];
const exactListing = discovery.normalizeSnapshot(snapshotFor("7plus", { accessType: "free" })).items[0];
const canonical = canonicalCatalogue();
const cricket = canonical.find(event => event.id === "cricket-australia-bangladesh-first-test-2026");
assert(cricket, "the deterministic match regression needs the canonical Bangladesh Test");
const exactScore = discovery.scoreListingAgainstEvent(exactListing, discovery.resolveTaxonomy(exactListing), cricket);
assert.equal(exactScore.confidence, 1, "competition, both participants, start, venue and title must produce an exact match");
const exactCandidate = discovery.candidateForListing(exactListing, canonical, "coverage-report:2026-08-13");
assert.equal(exactCandidate.matchStatus, "matched");
assert.equal(exactCandidate.catalogueStatus, "matched");
assert.equal(exactCandidate.coverageReason, "broadcaster_featured");
assert.equal(exactCandidate.suggestedAction, "publish");
assert.equal(exactCandidate.broadcastsAu[0].accessType, "free");
assert.equal(exactCandidate.blockers.length, 0);
assert(discovery.canPublishCandidate(exactCandidate));
assert(discovery.scoreListingAgainstEvent(replay, discovery.resolveTaxonomy(replay), cricket).confidence <= 0.49, "replay evidence must stay below the event match threshold");

const snapshots = loadSnapshots();
assert.equal(assertFreshSnapshots(snapshots, "2026-08-13"), undefined);
assert.throws(() => assertFreshSnapshots(snapshots, `2026-08-${13 + MAXIMUM_SNAPSHOT_AGE_DAYS + 1}`), /refresh|review or replace/, "stale broadcaster evidence must fail closed");
const report = buildReport({ referenceDate: "2026-08-13", snapshots, catalogue: canonical });
assert.equal(report.sources.filter(source => source.priorityAu).length, 8);
assert.equal(report.summary.priorityAuSourcesLoaded, 1);
assert.equal(report.summary.nonEventProgrammesExcluded, 1, "studio/replay/highlights programming must not become event candidates");
assert(report.summary.newCatalogueGaps >= 1, "the weekly report must identify missing broadcaster-promoted events");
assert(report.summary.highPriorityRecommendations >= 1, "the report must identify high-priority additions");
assert.equal(report.commercialSourceOptions.length, discovery.commercialSourceOptions.length, "the machine report must expose paid-source possibilities too");
const formulaE = report.candidates.find(candidate => candidate.title === "Formula E");
assert(formulaE, "the reviewed Stan schedule must surface Formula E as a long-tail gap");
assert.equal(formulaE.matchStatus, "new");
assert.equal(formulaE.taxonomy.taxonomyStatus, "sport_only", "a new competition must enter review without editing the taxonomy");
assert.equal(formulaE.provisionalEvent.status, "provisional");
assert.equal(formulaE.broadcastsAu[0].serviceId, "stan_sport");
assert.equal(formulaE.broadcastsAu[0].accessType, "included");
assert(report.candidates.every(candidate => candidate.sourceEvidence.every(source => source.sourceUrl.startsWith("https://"))), "every candidate must retain reviewable source lineage");
assert(report.sources.some(source => source.sourceId === "kayo" && source.status === "no_approved_input"), "missing inputs must be visible rather than silently treated as zero coverage");

const currentReport = buildReport({ referenceDate: sydneyDate(), snapshots, catalogue: canonical });
const outputs = outputSet(currentReport);
outputs.forEach((expected, filePath) => assert.equal(fs.readFileSync(filePath, "utf8"), expected, `${filePath} must be current`));
assert(fs.readFileSync("data/coverage/latest.md", "utf8").includes("## Licensed-source path"));
assert(fs.readFileSync("data/coverage/latest.html", "utf8").includes("Paid and licensed possibilities"));
assert(fs.readFileSync("data/coverage/latest.md", "utf8").includes("YuVu") && fs.readFileSync("data/coverage/latest.md", "utf8").includes("Gracenote") && fs.readFileSync("data/coverage/latest.md", "utf8").includes("JustWatch"), "the human report must contain the commercial shortlist, not merely link to it");

const approved = applyDecisions({ ...report, candidates: [...report.candidates, exactCandidate] }, {
  schemaVersion: "coverage-review-decisions.v1",
  reportId: report.reportId,
  decisions: [{ candidateId: exactCandidate.candidateId, decision: "publish", reviewedBy: "Phase 3 test", reviewedAt: "2026-08-13T03:00:00Z" }],
});
assert.equal(approved.summary.publish, 1);
assert.equal(approved.published[0].canonicalEventId, cricket.id);
const appliedAvailability = applyApprovedCoverage({
  schemaVersion: "events.v1",
  version: "phase3-test",
  publishedAt: "2026-08-13T03:00:00Z",
  events: [{
    id: cricket.id,
    eventId: cricket.id,
    sport: "Cricket",
    key: "cricket",
    name: cricket.title,
    displayTitleCompact: cricket.title,
    date: "2026-08-13",
    time: "10:30",
    startTimeUtc: cricket.startTimeUtc,
    broadcaster: "Foxtel",
    broadcastOptions: ["Foxtel"],
    expected: 8,
    venue: cricket.venue.name,
    liveWindow: 8,
    round: "all",
    narrativeType: "test",
    selectedSentence: "An official international Test fixture is ready for broadcaster availability verification.",
    fullSpiel: "This canonical regression fixture verifies that a reviewed, exact broadcaster match can add a normalized Australian viewing option without changing fixture identity or timing.",
    sourceName: "Official competition fixture",
    sourceUrl: "https://example.test/official-fixture",
    sourceCheckedAt: "2026-08-13T02:00:00Z",
    sourceType: "official",
  }],
}, approved);
assert.equal(appliedAvailability.summary.availabilityUpdates, 1);
assert.equal(appliedAvailability.feed.events[0].startTimeUtc, cricket.startTimeUtc, "broadcaster evidence must never replace canonical fixture time");
assert(appliedAvailability.feed.events[0].broadcastOptions.includes("7plus"));
assert.equal(appliedAvailability.feed.events[0].coverageSources[0].candidateId, exactCandidate.candidateId);
assert.throws(() => applyDecisions(report, {
  schemaVersion: "coverage-review-decisions.v1",
  reportId: report.reportId,
  decisions: [{ candidateId: formulaE.candidateId, decision: "publish", reviewedBy: "Phase 3 test", reviewedAt: "2026-08-13T03:00:00Z" }],
}), /needs a fully reviewed canonicalEvent/, "a broadcaster-only provisional event must never bypass editorial identity checks");

const uefaCandidate = report.candidates.find(candidate => candidate.title === "UEFA Super Cup");
const reviewedAddition = {
  id: "official-uefa-super-cup-2026",
  eventId: "official-uefa-super-cup-2026",
  sport: "Football",
  key: "fifa",
  name: "UEFA Super Cup 2026",
  displayTitleCompact: "UEFA Super Cup 2026",
  date: "2026-08-13",
  time: "05:00",
  startTimeUtc: "2026-08-12T19:00:00Z",
  broadcaster: "Stan Sport",
  broadcastOptions: ["Stan Sport"],
  expected: 8,
  venue: "Neutral venue",
  liveWindow: 3,
  round: "final",
  narrativeType: "cup-final",
  selectedSentence: "A verified UEFA showpiece fixture has cleared editorial identity, timing and source review.",
  fullSpiel: "This official-source regression fixture proves that a broadcaster-discovered catalogue gap can enter the canonical feed only after fixture truth, taxonomy and card copy are separately reviewed.",
  sourceName: "Official UEFA fixture",
  sourceUrl: "https://www.uefa.com/uefasupercup/",
  sourceCheckedAt: "2026-08-13T02:30:00Z",
  sourceType: "official",
};
const approvedAddition = applyDecisions(report, {
  schemaVersion: "coverage-review-decisions.v1",
  reportId: report.reportId,
  decisions: [{ candidateId: uefaCandidate.candidateId, decision: "publish", reviewedBy: "Phase 3 test", reviewedAt: "2026-08-13T03:00:00Z", canonicalEvent: reviewedAddition }],
});
assert.equal(approvedAddition.published[0].publicationType, "canonical_addition");
const appliedAddition = applyApprovedCoverage({
  schemaVersion: "events.v1",
  version: "phase3-test",
  publishedAt: "2026-08-13T03:00:00Z",
  events: [appliedAvailability.feed.events[0]],
}, approvedAddition);
assert.equal(appliedAddition.summary.canonicalAdditions, 1);
assert(appliedAddition.feed.events.some(event => event.eventId === reviewedAddition.eventId), "a separately reviewed official fixture must enter the canonical incoming feed");
assert.throws(() => applyDecisions(report, {
  schemaVersion: "coverage-review-decisions.v1",
  reportId: report.reportId,
  decisions: [{ candidateId: uefaCandidate.candidateId, decision: "publish", reviewedBy: "Phase 3 test", reviewedAt: "2026-08-13T03:00:00Z", canonicalEvent: { ...reviewedAddition, sourceType: "broadcaster" } }],
}), /official HTTPS fixture source/, "a new event needs independent official fixture truth, not broadcaster evidence alone");

[
  "schemas/broadcaster-schedule-export.schema.json",
  "schemas/coverage-candidate.schema.json",
  "schemas/coverage-report.schema.json",
  "schemas/coverage-review-decisions.schema.json",
].forEach(filePath => assert.doesNotThrow(() => JSON.parse(fs.readFileSync(filePath, "utf8")), `${filePath} must be valid JSON`));

const sql = fs.readFileSync("supabase/nothingsports-coverage-candidates.sql", "utf8");
assert(sql.includes("create table if not exists public.coverage_candidates"));
assert(sql.includes("create table if not exists public.coverage_candidate_decisions"));
assert.equal((sql.match(/force row level security/g) || []).length, 2);
assert(sql.includes("revoke all on table public.coverage_candidates from anon, authenticated"));
assert(sql.includes("revoke all on table public.coverage_candidate_decisions from anon, authenticated"));
assert(!/grant\s+[^;]+\s+to\s+(anon|authenticated)/i.test(sql), "coverage evidence and decisions must stay private from browser roles");

console.log(`Broadcaster discovery valid: 8 AU adapters, ${report.candidates.length} candidates, ${report.summary.newCatalogueGaps} gaps, normalized AU availability, private review tables, and fail-closed publishing.`);
