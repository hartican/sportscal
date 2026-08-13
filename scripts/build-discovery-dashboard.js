#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const MEASUREMENT = require("../config/discovery-measurement.js");

const ROOT = path.resolve(__dirname, "..");
const DEFAULTS = Object.freeze({
  feedPath: "data/events.json",
  marqueePath: "data/canonical/australian-marquee-events-2026.json",
  coveragePath: "data/coverage/latest.json",
  approvedPath: "data/coverage/approved-coverage.json",
  readoutPath: "data/measurement/discovery-aggregate.template.json",
  historyPath: "data/measurement/coverage-history.json",
  outputJsonPath: "data/measurement/discovery-dashboard.json",
  outputHtmlPath: "data/measurement/discovery-dashboard.html",
});

function readJson(filePath){
  return JSON.parse(fs.readFileSync(path.resolve(ROOT, filePath), "utf8"));
}

function parseOptions(argv = process.argv.slice(2)){
  const options = { ...DEFAULTS, check: false };
  argv.forEach(argument => {
    if (argument === "--check") options.check = true;
    else if (argument.startsWith("--readout=")) options.readoutPath = argument.slice("--readout=".length);
    else if (argument.startsWith("--history=")) options.historyPath = argument.slice("--history=".length);
    else if (argument.startsWith("--output-json=")) options.outputJsonPath = argument.slice("--output-json=".length);
    else if (argument.startsWith("--output-html=")) options.outputHtmlPath = argument.slice("--output-html=".length);
    else throw new Error(`Unknown option: ${argument}`);
  });
  return options;
}

function escapeHtml(value){
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function displayPercent(value){
  return value === null || value === undefined ? "Not measurable" : `${Number(value).toFixed(2).replace(/\.00$/, "")}%`;
}

function statusLabel(value){
  return String(value || "unknown").replace(/_/g, " ");
}

function metricCard(label, value, note, status){
  return `<article class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small><em data-status="${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</em></article>`;
}

function breakdownRows(items, empty){
  if (!Array.isArray(items) || !items.length) return `<tr><td colspan="3">${escapeHtml(empty)}</td></tr>`;
  return items.map(item => `<tr><td>${escapeHtml(item.sport || item.competitionId || item.competition || "Unknown")}</td><td>${escapeHtml(item.negativeActions ?? item.count ?? 0)}</td><td>${escapeHtml(displayPercent(item.ratePercent))}</td></tr>`).join("");
}

function renderHtml(report){
  const missing = report.coverage.missingMarquee;
  const trend = report.coverage.missingMarqueeTrend;
  const candidates = report.coverage.candidatePublish;
  const discovery = report.behaviour.discovery;
  const satisfaction = report.behaviour.satisfactionProxy;
  const coldStart = report.behaviour.coldStartDiversity;
  const current = report.tuning.current;
  const recommendations = report.tuning.recommendations;
  const paidSources = report.coverage.commercialSourceOptions || [];
  const acceptanceRows = Object.entries(report.acceptance).map(([key, value]) => `<tr><td>${escapeHtml(statusLabel(key))}</td><td><em data-status="${escapeHtml(value)}">${escapeHtml(statusLabel(value))}</em></td></tr>`).join("");
  const recommendationRows = recommendations.map(item => `<tr><td>${escapeHtml(statusLabel(item.area))}</td><td><strong>${escapeHtml(statusLabel(item.decision))}</strong></td><td>${escapeHtml(statusLabel(item.evidenceStatus))}</td><td>${escapeHtml(item.rationale)}</td></tr>`).join("");
  const paidSourceRows = paidSources.map(source => `<tr><td><a href="${escapeHtml(source.sourceUrl)}">${escapeHtml(source.label)}</a></td><td>${escapeHtml(source.role)}</td><td>${escapeHtml(statusLabel(source.auFit))}</td><td>${escapeHtml(statusLabel(source.evaluation))}</td><td>${escapeHtml(statusLabel(source.pricing))}</td><td>${escapeHtml(source.limitations)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>nothingSport discovery measurement</title>
  <style>
    :root{color-scheme:dark;--ink:#f5f4ec;--muted:#aaa99f;--line:#35372f;--panel:#181a17;--accent:#d7ff47;--warn:#ffcb69;--good:#83f2b4;--bg:#0e100e}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 ui-sans-serif,system-ui,-apple-system,sans-serif}main{width:min(1180px,calc(100% - 32px));margin:0 auto;padding:48px 0 72px}header{display:grid;gap:10px;margin-bottom:32px}header p{max-width:760px;color:var(--muted);margin:0}.eyebrow{text-transform:uppercase;letter-spacing:.14em;color:var(--accent);font-size:12px}h1{font-size:clamp(32px,6vw,68px);line-height:.95;letter-spacing:-.055em;margin:0}h2{font-size:24px;margin:0 0 16px}section{margin-top:34px}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.metric{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:18px;display:flex;flex-direction:column;min-height:172px}.metric span,.metric small{color:var(--muted)}.metric strong{font-size:30px;line-height:1.1;margin:10px 0}.metric em,td em{font-style:normal;margin-top:auto;width:max-content;border:1px solid var(--line);border-radius:999px;padding:3px 8px;font-size:11px;text-transform:uppercase;letter-spacing:.06em}.metric em[data-status=measured],td em[data-status=supported]{color:var(--good)}.metric em[data-status=instrumentation_pending],.metric em[data-status=insufficient_history],td em[data-status=unproven],td em[data-status=requires_pilot_review]{color:var(--warn)}.panel{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:18px;overflow:auto}.split{display:grid;grid-template-columns:1fr 1fr;gap:12px}table{width:100%;border-collapse:collapse;min-width:620px}th,td{text-align:left;padding:11px 10px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.06em}a{color:var(--accent)}code{color:var(--accent)}.callout{border-left:3px solid var(--warn);padding:2px 0 2px 14px;color:var(--muted)}.policy{display:flex;flex-wrap:wrap;gap:8px}.policy span{border:1px solid var(--line);border-radius:999px;padding:7px 10px;color:var(--muted)}footer{color:var(--muted);margin-top:32px;font-size:13px}@media(max-width:820px){main{width:min(100% - 20px,1180px);padding-top:28px}.metrics{grid-template-columns:1fr 1fr}.split{grid-template-columns:1fr}}@media(max-width:480px){.metrics{grid-template-columns:1fr}.metric{min-height:142px}h1{font-size:42px}}
  </style>
</head>
<body><main>
  <header><span class="eyebrow">Phase 6 · ${escapeHtml(statusLabel(report.evidenceState))}</span><h1>Discovery<br>signal check</h1><p>Observed breadth, engagement and annoyance—kept separate from assumptions. Generated ${escapeHtml(report.generatedAt)}.</p></header>
  <section class="metrics">
    ${metricCard("Missing marquee rate", displayPercent(missing.ratePercent), `${missing.presentCount}/${missing.expectedCount} policy events present`, missing.status)}
    ${metricCard("Missing-rate trend", trend.direction ? statusLabel(trend.direction) : "Not established", `${trend.observationCount} independent snapshot${trend.observationCount === 1 ? "" : "s"}`, trend.status)}
    ${metricCard("Candidate publish rate", displayPercent(candidates.ratePercent), `${candidates.publishCount}/${candidates.reviewedCount} reviewed candidates published`, candidates.status)}
    ${metricCard("Discovery positive rate", displayPercent(discovery.positiveActionRatePercent), `${discovery.exposures} discovery exposures`, report.behaviour.status)}
    ${metricCard("Discovery negative rate", displayPercent(discovery.negativeActionRatePercent), "Hide, unfollow and left-swipe signals", report.behaviour.status)}
    ${metricCard("Satisfaction proxy", displayPercent(satisfaction.ratePercent), `${satisfaction.totalActions} saves + reminders + watch-throughs`, satisfaction.status)}
    ${metricCard("Cold-start diversity", displayPercent(coldStart.ratePercent), `${coldStart.distinctSportCount} sports across ${coldStart.exposureCount} early opportunities`, coldStart.status)}
    ${metricCard("Current balanced mix", `${Math.round((current.balancedMix?.discovery || 0) * 100)}% discovery`, `Cap ${current.firstImpressionDiscoveryCap} in first ${current.firstImpressionDepth}`, "baseline_hold")}
  </section>
  <section class="split">
    <div class="panel"><h2>Discovery success</h2><table><tbody><tr><td>Opens</td><td>${discovery.opens}</td><td>${displayPercent(discovery.openRatePercent)}</td></tr><tr><td>Saves</td><td>${discovery.saves}</td><td>${displayPercent(discovery.saveRatePercent)}</td></tr><tr><td>Reminders</td><td>${discovery.reminders}</td><td>${displayPercent(discovery.reminderRatePercent)}</td></tr><tr><td>Watch-throughs</td><td>${discovery.watchThroughs}</td><td>${displayPercent(discovery.watchThroughRatePercent)}</td></tr></tbody></table></div>
    <div class="panel"><h2>Discovery annoyance</h2><p class="callout">${escapeHtml(report.behaviour.negativeFeedback.note)}</p><table><thead><tr><th>Sport</th><th>Negative actions</th><th>Rate</th></tr></thead><tbody>${breakdownRows(report.behaviour.negativeFeedback.bySport,"No aggregate sport breakdown available yet.")}</tbody></table><table><thead><tr><th>Competition</th><th>Negative actions</th><th>Rate</th></tr></thead><tbody>${breakdownRows(report.behaviour.negativeFeedback.byCompetition,"No aggregate competition breakdown available yet.")}</tbody></table></div>
  </section>
  <section class="panel"><h2>Tuning decision</h2><div class="policy"><span>Default: ${escapeHtml(current.frothDefault)}</span><span>Discovery cap: ${current.firstImpressionDiscoveryCap}/${current.firstImpressionDepth}</span><span>Coverage match: ${current.coverageMatchConfidenceThreshold}</span><span>Auto-publish: ${current.coverageAutoPublishConfidenceThreshold}</span><span>Never auto-apply</span></div><table><thead><tr><th>Area</th><th>Decision</th><th>Evidence</th><th>Why</th></tr></thead><tbody>${recommendationRows}</tbody></table></section>
  <section class="panel"><h2>Acceptance evidence</h2><table><tbody>${acceptanceRows}</tbody></table></section>
  <section class="panel"><h2>Paid-source options</h2><p>Commercial sources already researched for the broadcaster discovery layer. Inventory, rights and AU competition coverage must be confirmed during evaluation.</p><table><thead><tr><th>Source</th><th>Possible role</th><th>AU fit</th><th>Evaluation path</th><th>Pricing</th><th>Boundary</th></tr></thead><tbody>${paidSourceRows || '<tr><td colspan="6">No commercial source options in this coverage report.</td></tr>'}</tbody></table></section>
  <footer>Operator-only aggregate readout. No browser role receives product-event SELECT access, and no raw user-event export is stored in this repository.</footer>
</main></body></html>\n`;
}

function build(options){
  const coverageReport = readJson(options.coveragePath);
  return MEASUREMENT.buildReport({
    feed: readJson(options.feedPath),
    marqueePolicy: readJson(options.marqueePath),
    coverageReport,
    approvedCoverage: readJson(options.approvedPath),
    behaviouralReadout: readJson(options.readoutPath),
    coverageHistory: readJson(options.historyPath),
    generatedAt: null,
  });
}

function checkOrWrite(filePath, output, check){
  const absolute = path.resolve(ROOT, filePath);
  if (check){
    if (!fs.existsSync(absolute) || fs.readFileSync(absolute, "utf8") !== output){
      throw new Error(`${path.relative(ROOT, absolute)} is stale; rebuild the discovery dashboard.`);
    }
    return;
  }
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, output);
}

function historyOutput(report){
  return `${JSON.stringify({
    schemaVersion: "coverage-measurement-history.v1",
    snapshots: report.coverage.snapshots,
  }, null, 2)}\n`;
}

function main(){
  const options = parseOptions();
  const report = build(options);
  checkOrWrite(options.historyPath, historyOutput(report), options.check);
  checkOrWrite(options.outputJsonPath, `${JSON.stringify(report, null, 2)}\n`, options.check);
  checkOrWrite(options.outputHtmlPath, renderHtml(report), options.check);
  console.log(`Discovery dashboard ${options.check ? "current" : "built"}: ${report.coverage.missingMarquee.missingCount}/${report.coverage.missingMarquee.expectedCount} marquee events missing; behavioural evidence ${report.behaviour.status}; tuning ${report.tuning.recommendations.map(item => `${item.area}:${item.decision}`).join(", ")}.`);
}

if (require.main === module) main();

module.exports = { DEFAULTS, build, escapeHtml, historyOutput, parseOptions, renderHtml };
