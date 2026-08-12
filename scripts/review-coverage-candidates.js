#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const discovery = require("../config/broadcaster-discovery.js");
const eventCompat = require("../config/event-taxonomy-compat.js");
const { normalizeFeed, validateFeed } = require("./lib/feed-utils.js");

const ROOT = path.resolve(__dirname, "..");
const REPORT_PATH = path.join(ROOT, "data/coverage/latest.json");
const DECISIONS_PATH = path.join(ROOT, "data/coverage/review-decisions.json");
const APPROVED_PATH = path.join(ROOT, "data/coverage/approved-coverage.json");

function readJson(filePath){
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function canonicalAddition(candidate, decision){
  if (candidate?.matchStatus !== "new") throw new Error(`${candidate?.candidateId} cannot publish as a new event because its identity is not new`);
  const rawEvent = decision?.canonicalEvent;
  if (!rawEvent || typeof rawEvent !== "object" || Array.isArray(rawEvent)) {
    throw new Error(`${candidate.candidateId} needs a fully reviewed canonicalEvent to publish a new event`);
  }
  if (rawEvent.sourceType !== "official" || !/^https:\/\//.test(rawEvent.sourceUrl || "")) {
    throw new Error(`${candidate.candidateId} canonicalEvent must use an official HTTPS fixture source`);
  }
  if (!rawEvent.startTimeUtc || !Number.isFinite(Date.parse(rawEvent.startTimeUtc))) {
    throw new Error(`${candidate.candidateId} canonicalEvent needs an authoritative UTC start time`);
  }
  const resolved = eventCompat.resolveEvent(rawEvent);
  if (!resolved.sportId || !resolved.disciplineId || !resolved.competitionId) {
    throw new Error(`${candidate.candidateId} canonicalEvent must resolve through sport, discipline and competition taxonomy before publication`);
  }
  if (candidate.taxonomy?.sportId && candidate.taxonomy.sportId !== resolved.sportId) {
    throw new Error(`${candidate.candidateId} canonicalEvent conflicts with the broadcaster listing sport`);
  }
  const normalized = normalizeFeed({
    schemaVersion: "events.v1",
    version: "phase3-editorial-review",
    publishedAt: decision.reviewedAt,
    events: [{
      ...rawEvent,
      taxonomyVersion: resolved.taxonomyVersion,
      taxonomyNodeId: resolved.taxonomyNodeId,
      taxonomySportId: resolved.sportId,
      disciplineId: resolved.disciplineId,
      taxonomyCompetitionId: resolved.competitionId,
      ...(resolved.eventSeriesId ? { eventSeriesId: resolved.eventSeriesId } : {}),
    }],
  });
  const issues = validateFeed(normalized);
  if (issues.length) throw new Error(`${candidate.candidateId} canonicalEvent is invalid: ${issues.join("; ")}`);
  return normalized.events[0];
}

function applyDecisions(report, decisionBundle){
  if (report?.schemaVersion !== "coverage-report.v1") throw new Error("Unsupported coverage report");
  if (decisionBundle?.schemaVersion !== "coverage-review-decisions.v1") throw new Error("Unsupported coverage decisions");
  if (decisionBundle.reportId !== report.reportId) throw new Error(`Decision report ${decisionBundle.reportId} does not match ${report.reportId}`);
  const candidatesById = new Map(report.candidates.map(candidate => [candidate.candidateId, candidate]));
  const seen = new Set();
  const decisions = (decisionBundle.decisions || []).map(decision => {
    if (!candidatesById.has(decision.candidateId)) throw new Error(`Unknown coverage candidate: ${decision.candidateId}`);
    if (seen.has(decision.candidateId)) throw new Error(`Duplicate coverage decision: ${decision.candidateId}`);
    seen.add(decision.candidateId);
    if (!["publish", "review", "ignore"].includes(decision.decision)) throw new Error(`${decision.candidateId} has an unsupported decision`);
    if (!String(decision.reviewedBy || "").trim()) throw new Error(`${decision.candidateId} needs a reviewer`);
    const reviewedAt = Date.parse(decision.reviewedAt || "");
    if (!Number.isFinite(reviewedAt)) throw new Error(`${decision.candidateId} needs a valid review time`);
    const candidate = candidatesById.get(decision.candidateId);
    const reviewedCanonicalEvent = decision.decision === "publish" && candidate.matchStatus === "new"
      ? canonicalAddition(candidate, decision)
      : null;
    if (decision.decision === "publish" && !reviewedCanonicalEvent && !discovery.canPublishCandidate(candidate)) {
      throw new Error(`${decision.candidateId} cannot publish: existing matches need confidence 0.92+ and a clear AU option; new events need a fully reviewed official canonicalEvent`);
    }
    return {
      candidateId: decision.candidateId,
      decision: decision.decision,
      reviewedBy: String(decision.reviewedBy).trim(),
      reviewedAt: new Date(reviewedAt).toISOString(),
      note: String(decision.note || "").trim() || null,
      canonicalEvent: reviewedCanonicalEvent,
      candidate,
    };
  });
  const published = decisions.filter(item => item.decision === "publish").map(item => ({
    candidateId: item.candidateId,
    canonicalEventId: item.candidate.match.canonicalEventId,
    publicationType: item.canonicalEvent ? "canonical_addition" : "availability_update",
    ...(item.canonicalEvent ? { canonicalEvent: item.canonicalEvent } : {}),
    broadcastsAu: item.candidate.broadcastsAu,
    sourceEvidence: item.candidate.sourceEvidence,
    reviewedBy: item.reviewedBy,
    reviewedAt: item.reviewedAt,
    note: item.note,
  }));
  const generatedAt = decisions.map(item => item.reviewedAt).sort().at(-1) || report.generatedAt;
  return {
    schemaVersion: "approved-coverage.v1",
    reportId: report.reportId,
    generatedAt,
    summary: {
      decisionCount: decisions.length,
      publish: decisions.filter(item => item.decision === "publish").length,
      review: decisions.filter(item => item.decision === "review").length,
      ignore: decisions.filter(item => item.decision === "ignore").length,
      pending: report.candidates.length - decisions.length,
    },
    published,
  };
}

function render(payload){
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function main(argv = process.argv.slice(2)){
  const report = readJson(REPORT_PATH);
  if (argv.includes("--list")){
    report.candidates.forEach(candidate => {
      console.log([
        candidate.candidateId,
        candidate.eventTiming.localDate,
        candidate.matchStatus,
        candidate.match.confidence.toFixed(2),
        candidate.suggestedAction,
        candidate.title,
        candidate.blockers.join(",") || "clear",
      ].join("\t"));
    });
    return;
  }
  const approved = applyDecisions(report, readJson(DECISIONS_PATH));
  const output = render(approved);
  if (argv.includes("--check")){
    if (!fs.existsSync(APPROVED_PATH) || fs.readFileSync(APPROVED_PATH, "utf8") !== output){
      console.error("Approved coverage output is stale. Run node scripts/review-coverage-candidates.js --apply after reviewing decisions.");
      process.exit(1);
    }
    console.log(`Coverage decisions valid: ${approved.summary.publish} publish, ${approved.summary.review} review, ${approved.summary.ignore} ignore, ${approved.summary.pending} pending.`);
    return;
  }
  if (!argv.includes("--apply")){
    console.error("Use --list, --check or --apply. Edit data/coverage/review-decisions.json before applying editorial decisions.");
    process.exit(2);
  }
  fs.writeFileSync(APPROVED_PATH, output);
  console.log(`Approved coverage written: ${approved.summary.publish} publish, ${approved.summary.review} review, ${approved.summary.ignore} ignore, ${approved.summary.pending} pending.`);
}

if (require.main === module) main();

module.exports = { APPROVED_PATH, DECISIONS_PATH, REPORT_PATH, applyDecisions, canonicalAddition, render };
