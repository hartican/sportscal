#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const PILOT_READOUT = require("../config/pilot-readout");
const { buildReadinessReport } = require("./verify-pilot-readiness");

function readJson(filePath){
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
}

function numberFrom(row, key){
  const value = Number(row?.[key]);
  return Number.isFinite(value) ? value : 0;
}

function overallRow(payload){
  const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
  return rows.find(row => row?.cohort === "all") || rows.find(row => row?.cohort === "overall") || rows[0] || null;
}

function inputFromReadout(payload, readiness){
  if (payload?.sample && payload?.metrics && payload?.readiness) return payload;
  const row = overallRow(payload);
  if (!row) throw new TypeError("The readout export must contain an overall row.");
  return {
    sample: {
      firstObservedAt: row.measurement_started_at || null,
      generatedAt: row.measurement_generated_at || null,
      surveyVersion: row.survey_version || null,
      distinctUsers: numberFrom(row, "exposed_users"),
      weeklyPulseUsers: numberFrom(row, "pulse_users"),
    },
    readiness: {
      supportedFixtureCoveragePercent: Number(readiness?.supportedFixtureCoveragePercent || 0),
      overdueResults: Number(readiness?.overdueResultCount || readiness?.overdueResults || 0),
    },
    metrics: {
      tsdrPercent: numberFrom(row, "tsdr_percent"),
      fullFixtureAdoptionPercent: numberFrom(row, "full_fixture_adoption_percent"),
      multipleCrossCheckPercent: numberFrom(row, "multiple_cross_check_percent"),
      missedFixturePercent: numberFrom(row, "missed_fixture_percent"),
      aboutRightFeedPercent: numberFrom(row, "about_right_feed_percent"),
      positiveTrustPercent: numberFrom(row, "positive_trust_percent"),
      meaningfulActionRatePercent: numberFrom(row, "meaningful_action_rate_percent"),
      promptDismissalPercent: numberFrom(row, "prompt_dismissal_percent"),
      spectacleRatingCompletionPercent: numberFrom(row, "spectacle_rating_completion_percent"),
      weeklyTsdr: Array.isArray(row.weekly_tsdr) ? row.weekly_tsdr : [],
    },
  };
}

function localReadiness(now = new Date()){
  return buildReadinessReport({
    canonical: readJson("data/canonical/afl-nrl-2026.json"),
    feedMeta: readJson("data/feed-meta.json"),
    now,
  });
}

function parseOptions(argv = process.argv.slice(2)){
  const options = { readoutPath: null, readinessPath: null, now: new Date() };
  argv.forEach(argument => {
    if (argument.startsWith("--readiness=")) options.readinessPath = argument.slice("--readiness=".length);
    else if (argument.startsWith("--now=")) options.now = new Date(argument.slice("--now=".length));
    else if (!options.readoutPath) options.readoutPath = argument;
    else throw new Error(`Unknown option: ${argument}`);
  });
  if (!options.readoutPath) throw new Error("Usage: node scripts/evaluate-pilot-readout.js <readout.json> [--readiness=<readiness.json>]");
  if (!Number.isFinite(options.now.getTime())) throw new Error("--now must be a valid timestamp.");
  return options;
}

function main(){
  const options = parseOptions();
  const readout = readJson(options.readoutPath);
  const readiness = options.readinessPath ? readJson(options.readinessPath) : localReadiness(options.now);
  const report = PILOT_READOUT.buildMeasurementReport(inputFromReadout(readout, readiness));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`Measurement report ready. Operational readiness: ${report.operationalReady ? "ready" : "attention required"}.\n`);
}

if (require.main === module) main();

module.exports = {
  inputFromReadout,
  localReadiness,
  numberFrom,
  overallRow,
  parseOptions,
};
