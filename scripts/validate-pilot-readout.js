#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const PILOT_READOUT = require("../config/pilot-readout");
const { buildReadinessReport } = require("./verify-pilot-readiness");
const { inputFromReadout } = require("./evaluate-pilot-readout");

const now = new Date("2026-08-11T08:00:00.000Z");

function participant(id, label){
  return { id, displayName: label, shortName: label };
}

function fixture({ sport, id, roundNumber, startTimeUtc, home, away, completed = false }){
  return {
    id,
    sportDomainId: `sport:${sport}`,
    competitionId: `competition:${sport}-premiership-2026`,
    roundNumber,
    roundLabel: `Round ${roundNumber}`,
    displayName: `${home} v ${away}`,
    startTimeUtc,
    scheduleStatus: "confirmed",
    homeParticipantId: home,
    awayParticipantId: away,
    participantIds: [home, away],
    status: completed ? "completed" : "scheduled",
    broadcasters: [{
      broadcasterId: "broadcaster:test",
      broadcasterName: "Test Sports",
      live: true,
      replay: true,
      deeplinkUrl: "https://example.test/watch",
    }],
    result: completed ? {
      status: "completed",
      scorelineText: `${home} v ${away} — 10-8`,
    } : null,
  };
}

const participants = [
  participant("team:afl:a", "AFL A"), participant("team:afl:b", "AFL B"),
  participant("team:afl:c", "AFL C"), participant("team:afl:d", "AFL D"),
  participant("team:nrl:a", "NRL A"), participant("team:nrl:b", "NRL B"),
  participant("team:nrl:c", "NRL C"), participant("team:nrl:d", "NRL D"),
];
const canonical = {
  schemaVersion: "canonical-sports.v1",
  generatedAt: "2026-08-11T06:00:00.000Z",
  participants,
  events: [
    fixture({ sport: "afl", id: "afl-r1", roundNumber: 1, startTimeUtc: "2026-08-01T05:00:00.000Z", home: "team:afl:a", away: "team:afl:b", completed: true }),
    fixture({ sport: "afl", id: "afl-r2", roundNumber: 2, startTimeUtc: "2026-08-12T05:00:00.000Z", home: "team:afl:a", away: "team:afl:c" }),
    fixture({ sport: "afl", id: "afl-r3", roundNumber: 3, startTimeUtc: "2026-08-19T05:00:00.000Z", home: "team:afl:b", away: "team:afl:d" }),
    fixture({ sport: "nrl", id: "nrl-r1", roundNumber: 1, startTimeUtc: "2026-08-01T07:00:00.000Z", home: "team:nrl:a", away: "team:nrl:b", completed: true }),
    fixture({ sport: "nrl", id: "nrl-r2", roundNumber: 2, startTimeUtc: "2026-08-13T07:00:00.000Z", home: "team:nrl:a", away: "team:nrl:c" }),
    fixture({ sport: "nrl", id: "nrl-r3", roundNumber: 3, startTimeUtc: "2026-08-20T07:00:00.000Z", home: "team:nrl:b", away: "team:nrl:d" }),
  ],
};
const feedMeta = { publishedAt: "2026-08-11T06:05:00.000Z" };

const ready = buildReadinessReport({ canonical, feedMeta, now });
assert.equal(ready.ready, true);
assert.equal(ready.supportedFixtureCoveragePercent, 100);
assert.equal(ready.supportedFixtureCount, 4);
assert.equal(ready.completeFixtureCount, 4);
assert.equal(ready.overdueResultCount, 0);
assert.deepEqual(ready.sports.afl.roundNumbers, [2, 3]);
assert.deepEqual(ready.sports.nrl.roundNumbers, [2, 3]);

const cancelled = structuredClone(canonical);
const cancelledFixture = cancelled.events.find(event => event.id === "afl-r1");
cancelledFixture.status = "cancelled";
cancelledFixture.result = null;
assert.equal(buildReadinessReport({ canonical: cancelled, feedMeta, now }).overdueResultCount, 0, "cancelled fixtures are resolved without a fabricated scoreline");

const missingWatch = structuredClone(canonical);
missingWatch.events.find(event => event.id === "nrl-r2").broadcasters = [];
const missingWatchReport = buildReadinessReport({ canonical: missingWatch, feedMeta, now });
assert.equal(missingWatchReport.ready, false);
assert.equal(missingWatchReport.supportedFixtureCoveragePercent, 75);
assert(missingWatchReport.issues.some(issue => /missing live watch destination/.test(issue)));

const overdue = structuredClone(canonical);
const overdueFixture = overdue.events.find(event => event.id === "nrl-r2");
overdueFixture.startTimeUtc = "2026-08-10T00:00:00.000Z";
const overdueReport = buildReadinessReport({ canonical: overdue, feedMeta, now });
assert.equal(overdueReport.ready, false);
assert.equal(overdueReport.overdueResultCount, 1);

const stale = structuredClone(canonical);
stale.generatedAt = "2026-08-10T16:59:59.000Z";
const staleReport = buildReadinessReport({ canonical: stale, feedMeta, now });
assert.equal(staleReport.ready, false);
assert(staleReport.issues.some(issue => /Canonical snapshot/.test(issue)));

const passingInput = {
  pilot: { startedAt: "2026-07-28T08:00:00.000Z", endedAt: now.toISOString(), daysObserved: 14, distinctPilotUsers: 8, weeklyPulseUsers: 6 },
  readiness: { supportedFixtureCoveragePercent: 100, overdueResults: 0 },
  metrics: {
    tsdrPercent: 70,
    fullFixtureAdoptionPercent: 50,
    multipleCrossCheckPercent: 10,
    missedFixturePercent: 5,
    aboutRightFeedPercent: 75,
    positiveTrustPercent: 80,
    meaningfulActionRatePercent: 25,
    promptDismissalPercent: 25,
    spectacleRatingCompletionPercent: 40,
  },
};
assert.equal(PILOT_READOUT.evaluatePilotDecision({ ...passingInput, pilot: { ...passingInput.pilot, daysObserved: 13 } }).status, "collecting");
assert.equal(PILOT_READOUT.evaluatePilotDecision({ ...passingInput, metrics: { ...passingInput.metrics, missedFixturePercent: 11 } }).recommendation, PILOT_READOUT.RECOMMENDATIONS.COVERAGE);
assert.equal(PILOT_READOUT.evaluatePilotDecision({ ...passingInput, metrics: { ...passingInput.metrics, tsdrPercent: 59 } }).recommendation, PILOT_READOUT.RECOMMENDATIONS.PERSONALISATION);
assert.equal(PILOT_READOUT.evaluatePilotDecision(passingInput).recommendation, PILOT_READOUT.RECOMMENDATIONS.WATCHING_NOW);

const input = inputFromReadout([{
  cohort: "all",
  pilot_started_at: "2026-07-28T08:00:00.000Z",
  pilot_ended_at: now.toISOString(),
  days_observed: 14,
  exposed_users: 8,
  pulse_users: 6,
  tsdr_percent: 70,
  full_fixture_adoption_percent: 50,
  multiple_cross_check_percent: 10,
  missed_fixture_percent: 5,
  about_right_feed_percent: 75,
  positive_trust_percent: 80,
  meaningful_action_rate_percent: 25,
  prompt_dismissal_percent: 25,
  spectacle_rating_completion_percent: 40,
}], ready);
assert.equal(input.metrics.fullFixtureAdoptionPercent, 50);
assert.equal(input.readiness.supportedFixtureCoveragePercent, 100);

const sql = fs.readFileSync("supabase/nothingsports-pilot-readout.sql", "utf8");
assert.match(sql, /product_events has no authenticated SELECT grant/i);
assert.match(sql, /interval '14 days'/i);
assert.match(sql, /properties ->> 'pilotVersion' = 'trust-pilot\.v1'/i);
assert.match(sql, /date_trunc\('week', event\.occurred_at at time zone 'Australia\/Sydney'\)/i);
assert.doesNotMatch(sql, /create\s+(?:or replace\s+)?view/i, "the administrator readout must not create an exposed view");
const runbook = fs.readFileSync("docs/pilot/phase6-runbook.md", "utf8");
assert.match(runbook, /9am, midday and 11pm Sydney time/i);
assert.match(runbook, /Fourteen full elapsed days are required/i);
assert.match(runbook, /never recommends social from incomplete evidence/i);

console.log("Pilot readout valid: fresh complete coverage, fourteen-day evidence, cohort metrics, prompt burden and three-way investment gate passed.");
