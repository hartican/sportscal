#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const MEASUREMENT = require("../config/discovery-measurement.js");
const FEED_CONTROLS = require("../config/feed-controls.js");
const DISCOVERY = require("../config/broadcaster-discovery.js");
const DASHBOARD = require("./build-discovery-dashboard.js");

function readJson(filePath){
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const feed = readJson("data/events.json");
const marqueePolicy = readJson("data/canonical/australian-marquee-events-2026.json");
const coverageReport = readJson("data/coverage/latest.json");
const approvedCoverage = readJson("data/coverage/approved-coverage.json");
const pendingReadout = readJson("data/measurement/discovery-aggregate.template.json");

const baseline = MEASUREMENT.buildReport({
  feed,
  marqueePolicy,
  coverageReport,
  approvedCoverage,
  behaviouralReadout: pendingReadout,
  coverageHistory: { snapshots: [] },
  generatedAt: coverageReport.generatedAt,
});

assert.equal(MEASUREMENT.SCHEMA_VERSION, "discovery-measurement.v1");
assert.equal(baseline.coverage.missingMarquee.missingCount, 0);
assert.equal(baseline.coverage.missingMarquee.ratePercent, 0);
assert.equal(baseline.coverage.missingMarqueeTrend.status, "insufficient_history", "one zero-rate snapshot must not be labelled as a downward trend");
assert.equal(baseline.coverage.candidatePublish.status, "insufficient_reviewed_candidates");
assert.equal(baseline.coverage.candidatePublish.ratePercent, null, "zero reviewed candidates must not produce a misleading 0% publish rate");
assert.equal(baseline.behaviour.status, "instrumentation_pending");
assert.equal(baseline.tuning.autoApplied, false);
assert(baseline.tuning.recommendations.every(item => item.decision === "hold"));
assert.equal(baseline.acceptance.missingMarqueeRateTrendingDown, "unproven");
assert.equal(baseline.acceptance.positiveDiscoveryWithoutDisproportionateNegatives, "unproven");
assert.equal(baseline.coverage.commercialSourceOptions.length, 8, "paid-source research must remain visible in the Phase 6 report");

const missingFeed = {
  events: feed.events.filter(event => ![event.eventId, event.id].includes(marqueePolicy.events[0].id)),
};
assert.equal(MEASUREMENT.missingMarqueeMetric(marqueePolicy, missingFeed).missingCount, 1);

const fallingTrend = MEASUREMENT.marqueeTrend([
  { observedAt: "2026-08-01T00:00:00.000Z", ratePercent: 20 },
  { observedAt: "2026-08-13T00:00:00.000Z", ratePercent: 0 },
]);
assert.equal(fallingTrend.direction, "down");
assert.equal(fallingTrend.changePercentagePoints, -20);

const positiveBehaviour = MEASUREMENT.behaviouralMetric([{
  cohort: "all",
  instrumentation_status: "active",
  discovery_exposures: 25,
  discovery_opens: 6,
  discovery_saves: 2,
  discovery_reminders: 2,
  discovery_watch_throughs: 1,
  discovery_negative_actions: 2,
  cold_start_exposures: 10,
  cold_start_distinct_sports: 4,
  negative_feedback_by_sport: [{ sport: "golf", negativeActions: 2, ratePercent: 20 }],
  negative_feedback_by_competition: [],
}]);
assert.equal(positiveBehaviour.status, "measured");
assert.equal(positiveBehaviour.discovery.positiveActionRatePercent, 44);
assert.equal(positiveBehaviour.discovery.negativeActionRatePercent, 8);
assert.equal(positiveBehaviour.satisfactionProxy.ratePercent, 20);
assert.equal(positiveBehaviour.coldStartDiversity.ratePercent, 40);

const broadening = MEASUREMENT.tuningState(positiveBehaviour, {
  status: "measured",
  reviewedCount: 10,
  publishCount: 2,
});
assert.equal(broadening.recommendations[0].decision, "review_broadening");
assert.equal(broadening.recommendations[2].decision, "review_against_labelled_outcomes");
assert.equal(broadening.autoApplied, false);

const noisyBehaviour = MEASUREMENT.behaviouralMetric([{
  cohort: "all",
  instrumentation_status: "active",
  discovery_exposures: 20,
  discovery_opens: 1,
  discovery_saves: 0,
  discovery_reminders: 0,
  discovery_watch_throughs: 0,
  discovery_negative_actions: 5,
  cold_start_exposures: 10,
  cold_start_distinct_sports: 2,
  negative_feedback_by_sport: [],
  negative_feedback_by_competition: [],
}]);
assert.equal(MEASUREMENT.tuningState(noisyBehaviour, { status: "measured", reviewedCount: 1 }).recommendations[0].decision, "review_tightening");

assert.equal(FEED_CONTROLS.DEFAULT_CONTROLS.froth, "balanced");
assert.equal(FEED_CONTROLS.MIX_TARGETS.balanced.discovery, 0.05);
assert.equal(FEED_CONTROLS.FIRST_IMPRESSION_DISCOVERY_CAP, 1);
assert.equal(FEED_CONTROLS.FIRST_IMPRESSION_DEPTH, 10);
assert.equal(DISCOVERY.MATCH_CONFIDENCE_THRESHOLD, 0.65);
assert.equal(DISCOVERY.AUTO_PUBLISH_CONFIDENCE_THRESHOLD, 0.92);
assert.equal(DISCOVERY.AMBIGUITY_CONFIDENCE_MARGIN, 0.08);

const checkedIn = readJson("data/measurement/discovery-dashboard.json");
assert.deepEqual(checkedIn, DASHBOARD.build(DASHBOARD.DEFAULTS));
const html = fs.readFileSync("data/measurement/discovery-dashboard.html", "utf8");
assert.match(html, /Discovery success/);
assert.match(html, /Discovery annoyance/);
assert.match(html, /Paid-source options/);
assert.match(html, /instrumentation pending/i);
assert.doesNotMatch(html, /downward trend/i, "the baseline dashboard must not claim a trend");

const sql = fs.readFileSync("supabase/nothingsports-pilot-readout.sql", "utf8");
assert.match(sql, /'pending_approval'::text as instrumentation_status/i);
assert.match(sql, /negative_feedback_by_sport/i);
assert.match(sql, /negative_feedback_by_competition/i);
assert.doesNotMatch(sql, /create\s+(?:or replace\s+)?view/i);
assert.doesNotMatch(sql, /grant\s+select[\s\S]+to authenticated/i);
const productSql = fs.readFileSync("supabase/nothingsports-product-events.sql", "utf8");
assert.doesNotMatch(productSql, /'feed_action'|'preference_change'|'feed_control_change'/i, "Phase 6 must not silently widen the event contract while approval is pending");

console.log("Discovery measurement valid: marquee and coverage baselines, aggregate dashboard, paid sources and evidence-gated tuning are deterministic; unapproved behavioural metrics remain pending.");
