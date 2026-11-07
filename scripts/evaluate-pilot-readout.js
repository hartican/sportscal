#!/usr/bin/env node
const { readFinalsEvidence } = require("./lib/pilot-finals-readiness");

const fs = require("node:fs");
const path = require("node:path");
const PILOT_READOUT = require("../config/pilot-readout");
const { buildReadinessReport } = require("./verify-pilot-readiness");
const COHORT = require("./lib/pilot-cohort-selection");

function readJson(filePath){
  try { return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8")); }
  catch (_) { throw new Error("Cannot read a valid JSON input file."); }
}

function numberFrom(row, key){
  const raw = row?.[key];
  if (raw == null || !["number", "string"].includes(typeof raw) || (typeof raw === "string" && !raw.trim())) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function overallRow(payload){
  const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
  return rows.find(row => row?.cohort === "all") || rows.find(row => row?.cohort === "overall") || null;
}

function inputFromReadout(payload, readiness){
  if (payload?.sample && payload?.metrics && payload?.readiness) return payload;
  const row = overallRow(payload);
  if (!row) throw new TypeError("The readout export must contain an overall row.");
  return {
    sample: {
      windowStartedAt: row.measurement_window_started_at || null,
      firstObservedAt: row.measurement_started_at || null,
      generatedAt: row.measurement_generated_at || null,
      surveyVersion: row.survey_version || null,
      distinctUsers: numberFrom(row, "exposed_users"),
      weeklyPulseUsers: numberFrom(row, "pulse_users"),
    },
    readiness: {
      verified: readiness?.ready === true,
      supportedFixtureCoveragePercent: readiness?.supportedFixtureCoveragePercent ?? null,
      overdueResults: readiness?.overdueResultCount ?? readiness?.overdueResults ?? null,
    },
    metrics: {
      usefulActionUsers: numberFrom(row, "useful_action_users"),
      returningUsefulUsers: numberFrom(row, "returning_useful_users"),
      usefulReturnPercent: numberFrom(row, "useful_return_percent"),
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
    finals: readFinalsEvidence(),
    feedMeta: readJson("data/feed-meta.json"),
    now,
  });
}

function parseOptions(argv = process.argv.slice(2)){
  const options = { readoutPath: null, readinessPath: null, now: new Date(), selectionPath:null, outputPath:null, requireCohort:false };
  argv.forEach(argument => {
    if (argument.startsWith("--readiness=")) options.readinessPath = argument.slice("--readiness=".length);
    else if (argument.startsWith("--now=")) options.now = new Date(argument.slice("--now=".length));
    else if (argument.startsWith("--prepare-cohort-sql=")) options.selectionPath = argument.slice("--prepare-cohort-sql=".length);
    else if (argument.startsWith("--output=")) options.outputPath = argument.slice("--output=".length);
    else if (argument === "--require-invited-cohort") options.requireCohort = true;
    else if (argument.startsWith("--")) throw new Error("Unknown reporting option.");
    else if (!options.readoutPath) options.readoutPath = argument;
    else throw new Error("Only one aggregate input path is allowed.");
  });
  if (options.selectionPath){
    if (!options.outputPath || options.readoutPath || options.readinessPath || options.requireCohort) throw new Error("Prepare private SQL with --prepare-cohort-sql=<absolute-selection.json> --output=<new-absolute.sql> only.");
  } else if (!options.readoutPath) throw new Error("Usage: node scripts/evaluate-pilot-readout.js <readout.json> [--readiness=<readiness.json>] [--require-invited-cohort] [--output=<new-absolute.json>]");
  if (!Number.isFinite(options.now.getTime())) throw new Error("--now must be a valid timestamp.");
  return options;
}

function reportFromReadout(payload, readiness, {requireCohort=false} = {}){
  const scope = COHORT.scopeFromReadout(payload);
  if (requireCohort && !scope) throw new Error("Invited-cohort reporting requires a scoped aggregate export; the all-account export is unqualified.");
  const report = PILOT_READOUT.buildMeasurementReport(inputFromReadout(payload, readiness));
  if (scope){
    report.measurementScope = scope;
    report.weeklyTsdrScope = "Configured invited-account selection after each joining date and owner/QA exclusions; partial calendar weeks may appear at window edges.";
    report.notes = report.notes.map(note => note.includes("owner activity may be included")
      ? "Useful return counts fixture_check or watch_decision on at least two Sydney dates in the rolling 28-day window, after configured joining dates and owner/QA exclusions. Counts describe measured accounts, not independently verified people, residence, invitation evidence, D7 retention or playback. Signed-out and opted-out activity remains unmeasured."
      : note);
  }
  return report;
}

function main(){
  const options = parseOptions();
  if (options.selectionPath){
    const source = fs.readFileSync(path.join(__dirname,"../supabase/nothingsports-pilot-readout.sql"),"utf8");
    const {sql,selection} = COHORT.buildCohortSql(COHORT.readSelection(options.selectionPath),source,options.now);
    COHORT.writePrivate(options.outputPath,sql);
    process.stdout.write(`Private read-only SQL prepared for ${selection.eligibleAccounts} configured accounts. No query executed; no membership or demand verified.\n`);
    return;
  }
  const readout = readJson(options.readoutPath);
  const readiness = options.readinessPath ? readJson(options.readinessPath) : localReadiness(options.now);
  const report = reportFromReadout(readout, readiness, {requireCohort:options.requireCohort});
  if (options.outputPath){
    COHORT.writePrivate(options.outputPath,`${JSON.stringify(report,null,2)}\n`);
    process.stdout.write("Private aggregate report saved.\n");
    return;
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`Measurement report ready. Operational readiness: ${report.operationalReady ? "ready" : "attention required"}.\n`);
}

if (require.main === module){
  try { main(); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}

module.exports = {
  inputFromReadout,
  localReadiness,
  numberFrom,
  overallRow,
  parseOptions,
  reportFromReadout,
};
