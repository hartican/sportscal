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
  if (payload?.pilot && payload?.metrics && payload?.readiness) return payload;
  const row = overallRow(payload);
  if (!row) throw new TypeError("The readout export must contain an overall row.");
  return {
    pilot: {
      startedAt: row.pilot_started_at || null,
      endedAt: row.pilot_ended_at || null,
      daysObserved: numberFrom(row, "days_observed"),
      distinctPilotUsers: numberFrom(row, "exposed_users"),
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
  const evaluation = PILOT_READOUT.evaluatePilotDecision(inputFromReadout(readout, readiness));
  process.stdout.write(`${JSON.stringify(evaluation, null, 2)}\n`);
  if (!evaluation.evidenceComplete){
    process.stdout.write("Decision deferred: the fourteen-day evidence gate is not complete.\n");
  }else{
    process.stdout.write(`Next investment: ${evaluation.recommendation}.\n`);
  }
}

if (require.main === module) main();

module.exports = {
  inputFromReadout,
  localReadiness,
  numberFrom,
  overallRow,
  parseOptions,
};
