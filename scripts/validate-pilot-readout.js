#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const READOUT = require("../config/pilot-readout");
const { buildReadinessReport } = require("./verify-pilot-readiness");
const { inputFromReadout } = require("./evaluate-pilot-readout");

const canonical = JSON.parse(fs.readFileSync("data/canonical/afl-nrl-2026.json", "utf8"));
const feedMeta = JSON.parse(fs.readFileSync("data/feed-meta.json", "utf8"));
const readiness = buildReadinessReport({ canonical, feedMeta, now: new Date(feedMeta.publishedAt) });
const weeklyTsdr = [{ weekStart: "2026-08-10", denominator: 2, numerator: 1, tsdrPercent: 50 }];
const input = inputFromReadout([{
  cohort: "all",
  measurement_started_at: "2026-08-01T00:00:00.000Z",
  measurement_generated_at: "2026-08-12T00:00:00.000Z",
  survey_version: "weekly-pulse.v1",
  exposed_users: 2,
  pulse_users: 1,
  weekly_tsdr: weeklyTsdr,
  tsdr_percent: 50,
  full_fixture_adoption_percent: 50,
  multiple_cross_check_percent: 0,
  missed_fixture_percent: 0,
  about_right_feed_percent: 100,
  positive_trust_percent: 100,
  meaningful_action_rate_percent: 25,
  prompt_dismissal_percent: 0,
  spectacle_rating_completion_percent: 50,
}], readiness);

const report = READOUT.buildMeasurementReport(input);
assert.equal(READOUT.SCHEMA_VERSION, "measurement-readout.v2");
assert.equal(report.status, "report_ready");
assert.equal(report.recommendation, null, "measurement must not automatically recommend social or another investment");
assert.equal(report.sample.distinctUsers, 2, "sample sizes must remain descriptive even when small");
assert.match(report.sample.description, /2 exposed users/);
assert.deepEqual(report.metrics.weeklyTsdr, weeklyTsdr);
assert(!("daysObserved" in report.sample), "elapsed-day requirements must not remain in the readout schema");
assert.equal(READOUT.buildMeasurementReport({ sample: {}, readiness: {}, metrics: {} }).status, "report_ready", "zero or small samples must not block MVP completion");

const sql = fs.readFileSync("supabase/nothingsports-pilot-readout.sql", "utf8");
assert.match(sql, /product_events has no authenticated SELECT grant/i);
assert.doesNotMatch(sql, /interval '14 days'|pilot_complete|days_observed/i);
assert.match(sql, /properties ->> 'surveyVersion'/i);
assert.match(sql, /date_trunc\('week', event\.occurred_at at time zone 'Australia\/Sydney'\)/i);
assert.doesNotMatch(sql, /create\s+(?:or replace\s+)?view/i, "the administrator readout must not create an exposed view");
const runbook = fs.readFileSync("docs/pilot/phase6-runbook.md", "utf8");
assert.match(runbook, /ongoing measurement and operational readiness/i);
assert.doesNotMatch(runbook, /Fourteen full elapsed days|fourteen-day evidence gate/i);
assert.match(runbook, /sample size is descriptive/i);

console.log("Measurement readout valid: weekly TSDR, versioned pulses, cohort metrics and descriptive samples have no fixed-duration decision gate.");
