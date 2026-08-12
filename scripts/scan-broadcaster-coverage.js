#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const discovery = require("../config/broadcaster-discovery.js");
const eventCompat = require("../config/event-taxonomy-compat.js");

const ROOT = path.resolve(__dirname, "..");
const EXPORT_DIR = path.join(ROOT, "feeds/provider-exports/broadcasters");
const OUTPUT_DIR = path.join(ROOT, "data/coverage");
const JSON_OUTPUT = path.join(OUTPUT_DIR, "latest.json");
const MARKDOWN_OUTPUT = path.join(OUTPUT_DIR, "latest.md");
const HTML_OUTPUT = path.join(OUTPUT_DIR, "latest.html");
const MAXIMUM_SNAPSHOT_AGE_DAYS = 9;

function readJson(filePath){
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sydneyDate(value = new Date()){
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function parseOptions(argv = process.argv.slice(2)){
  const referenceArgument = argv.find(argument => argument.startsWith("--reference-date="));
  return {
    check: argv.includes("--check"),
    enforceFreshness: argv.includes("--enforce-freshness"),
    referenceDate: referenceArgument ? referenceArgument.split("=").slice(1).join("=") : sydneyDate(),
  };
}

function isoDate(value, label){
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(Date.parse(`${text}T00:00:00Z`))) throw new Error(`${label} must be YYYY-MM-DD`);
  return text;
}

function exportFiles(){
  if (!fs.existsSync(EXPORT_DIR)) return [];
  return fs.readdirSync(EXPORT_DIR)
    .filter(name => name.endsWith(".json"))
    .sort()
    .map(name => path.join(EXPORT_DIR, name));
}

function loadSnapshots(){
  const latestBySource = new Map();
  exportFiles().forEach(filePath => {
    const snapshot = discovery.normalizeSnapshot(readJson(filePath));
    const previous = latestBySource.get(snapshot.sourceId);
    if (!previous || previous.observedAt < snapshot.observedAt) {
      latestBySource.set(snapshot.sourceId, { ...snapshot, fixturePath: path.relative(ROOT, filePath) });
    }
  });
  return latestBySource;
}

function snapshotAgeDays(snapshot, referenceDate){
  const reference = Date.parse(`${referenceDate}T23:59:59Z`);
  return Math.max(0, Math.floor((reference - Date.parse(snapshot.observedAt)) / 86400000));
}

function assertFreshSnapshots(snapshots, referenceDate){
  if (!snapshots.size) throw new Error("Broadcaster discovery fails closed unless at least one approved source snapshot is present");
  snapshots.forEach(snapshot => {
    const ageDays = snapshotAgeDays(snapshot, referenceDate);
    if (ageDays > MAXIMUM_SNAPSHOT_AGE_DAYS) throw new Error(`${snapshot.sourceId} snapshot is ${ageDays} days old; review or replace it before publishing`);
  });
}

function canonicalCatalogue(){
  const payload = readJson(path.join(ROOT, "data/events.json"));
  return (payload.events || []).map(event => ({
    ...eventCompat.toCatalogEvent(event),
    sourceLocalDate: event.date || null,
  })).filter(event => event.id && event.sportId);
}

function scopeFor(date, referenceDate){
  const deltaDays = Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${referenceDate}T00:00:00Z`)) / 86400000);
  return deltaDays >= 0 && deltaDays <= 7 ? "daily_next_seven_days" : "weekly_breadth";
}

function buildReport({ referenceDate, snapshots = loadSnapshots(), catalogue = canonicalCatalogue() }){
  isoDate(referenceDate, "referenceDate");
  const reportId = `coverage-report:${referenceDate}`;
  const sourceStatuses = discovery.sourceProfiles.map(profile => {
    const snapshot = snapshots.get(profile.id);
    return snapshot ? {
      sourceId: profile.id,
      sourceLabel: profile.label,
      priorityAu: profile.priorityAu,
      territory: snapshot.territory,
      status: "loaded",
      sourceMode: snapshot.sourceMode,
      observedAt: snapshot.observedAt,
      ageDays: snapshotAgeDays(snapshot, referenceDate),
      windowStart: snapshot.windowStart,
      windowEnd: snapshot.windowEnd,
      itemCount: snapshot.itemCount,
      fixturePath: snapshot.fixturePath,
      reason: null,
    } : {
      sourceId: profile.id,
      sourceLabel: profile.label,
      priorityAu: profile.priorityAu,
      territory: profile.territory,
      status: "no_approved_input",
      sourceMode: "unavailable",
      observedAt: null,
      ageDays: null,
      windowStart: null,
      windowEnd: null,
      itemCount: 0,
      fixturePath: null,
      reason: "No licensed API, reviewed export or manual fixture is present; the adapter emitted no candidates.",
    };
  });
  const eligibleListings = Array.from(snapshots.values())
    .flatMap(snapshot => snapshot.items)
    .filter(listing => ["live", "delayed"].includes(listing.liveOrReplay));
  const candidates = eligibleListings.map(listing => ({
    ...discovery.candidateForListing(listing, catalogue, reportId),
    scanScope: scopeFor(listing.localDate, referenceDate),
  })).sort((left, right) => (
    left.eventTiming.localDate.localeCompare(right.eventTiming.localDate)
    || left.title.localeCompare(right.title)
    || left.candidateId.localeCompare(right.candidateId)
  ));
  const counts = value => candidates.filter(candidate => candidate[value[0]] === value[1]).length;
  const generatedAt = Array.from(snapshots.values()).flatMap(snapshot => [snapshot.observedAt, snapshot.reviewedAt]).filter(Boolean).sort().at(-1)
    || `${referenceDate}T00:00:00.000Z`;
  return {
    schemaVersion: "coverage-report.v1",
    reportId,
    referenceDate,
    generatedAt,
    refreshPolicy: {
      weeklyBreadth: true,
      dailyWindowDays: 7,
      maximumSnapshotAgeDays: MAXIMUM_SNAPSHOT_AGE_DAYS,
      failureMode: "retain_last_good_and_fail_closed",
      canonicalRefreshPath: "node scripts/update-cards.js",
    },
    commercialSourceOptions: discovery.commercialSourceOptions,
    sources: sourceStatuses,
    summary: {
      canonicalEventsCompared: catalogue.length,
      priorityAuSources: sourceStatuses.filter(source => source.priorityAu).length,
      priorityAuSourcesLoaded: sourceStatuses.filter(source => source.priorityAu && source.status === "loaded").length,
      sourceListingsLoaded: Array.from(snapshots.values()).reduce((total, snapshot) => total + snapshot.itemCount, 0),
      liveOrDelayedListingsEvaluated: eligibleListings.length,
      nonEventProgrammesExcluded: Array.from(snapshots.values()).reduce((total, snapshot) => total + snapshot.items.filter(item => !["live", "delayed"].includes(item.liveOrReplay)).length, 0),
      matched: counts(["matchStatus", "matched"]),
      newCatalogueGaps: counts(["matchStatus", "new"]),
      ambiguous: counts(["matchStatus", "ambiguous"]),
      publish: counts(["suggestedAction", "publish"]),
      review: counts(["suggestedAction", "review"]),
      ignore: counts(["suggestedAction", "ignore"]),
      highPriorityRecommendations: candidates.filter(candidate => candidate.priority === "high").length,
      auAvailabilityChanges: candidates.filter(candidate => candidate.availabilityChange).length,
    },
    candidates,
  };
}

function escapeHtml(value){
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sourceSummary(source){
  return source.status === "loaded"
    ? `${source.sourceMode}; ${source.itemCount} listing${source.itemCount === 1 ? "" : "s"}; ${source.ageDays}d old`
    : source.reason;
}

function renderMarkdown(report){
  const prioritySources = report.sources.filter(source => source.priorityAu);
  const lines = [
    "# nothingSport weekly coverage discovery",
    "",
    `Reference date: ${report.referenceDate}`,
    "",
    `Compared ${report.summary.liveOrDelayedListingsEvaluated} live/delayed listings with ${report.summary.canonicalEventsCompared} canonical events. Found ${report.summary.newCatalogueGaps} catalogue gaps, ${report.summary.ambiguous} ambiguous listings, ${report.summary.auAvailabilityChanges} possible AU availability changes and ${report.summary.highPriorityRecommendations} high-priority recommendations.`,
    "",
    "## Australian source health",
    "",
    "| Source | Status | Mode and freshness |",
    "|---|---|---|",
    ...prioritySources.map(source => `| ${source.sourceLabel} | ${source.status} | ${sourceSummary(source)} |`),
    "",
    "Missing inputs are explicit. They do not erase canonical events or silently imply that a broadcaster has no coverage.",
    "",
    "## Editorial queue",
    "",
    "| Date | Candidate | Match | Confidence | Priority | Suggested action | AU option | Blockers |",
    "|---|---|---|---:|---|---|---|---|",
    ...report.candidates.map(candidate => `| ${candidate.eventTiming.localDate} | ${candidate.title} | ${candidate.matchStatus}${candidate.match.canonicalEventId ? ` → ${candidate.match.canonicalEventId}` : ""} | ${candidate.match.confidence.toFixed(2)} | ${candidate.priority} | ${candidate.suggestedAction} | ${candidate.broadcastsAu.map(option => `${option.serviceLabel} (${option.accessType})`).join(", ") || "unproven"} | ${candidate.blockers.join(", ") || "none"} |`),
    "",
    "## Decision boundary",
    "",
    "A broadcaster listing is evidence, not fixture truth. New and ambiguous events remain in review. Publication is permitted only for an existing canonical identity at confidence 0.92 or higher with an unambiguous Australian option and no blockers. Use `node scripts/review-coverage-candidates.js --list` to inspect the queue; the queue never mutates the event feed directly, and only its approved artifact enters the canonical update path.",
    "",
    "## Licensed-source path",
    "",
    "The report generator accepts `licensed_api` snapshots using the same provider-neutral contract. These are the verified commercial possibilities; pricing is marked contact-sales unless a supplier publishes it.",
    "",
    "| Supplier | Possible role | AU evidence | Evaluation | Recommendation |",
    "|---|---|---|---|---|",
    ...report.commercialSourceOptions.map(option => `| [${option.label}](${option.sourceUrl}) | ${option.role} | ${option.auFit.replaceAll("_", " ")} | ${option.evaluation.replaceAll("_", " ")} | ${option.recommendation.replaceAll("_", " ")} |`),
    "",
    "The smallest serious procurement test is YuVu for Australian free-to-air EPG, Gracenote and JustWatch for event-level availability, and Sportradar for fixture identity. Stats Perform is a targeted second quote for NRL, Rugby Australia and A-Leagues. Require an actual 30-day AU inventory/sample before committing; a vendor's global coverage claim is not proof that Kayo, Foxtel, Stan, 9Now, 7plus or Paramount+ are included.",
    "",
    "Full capabilities, caveats, source links and contract questions are recorded in `docs/research/nothingsport-phase-3-broadcaster-source-research.md`.",
  ];
  return `${lines.join("\n")}\n`;
}

function renderHtml(report){
  const sourceRows = report.sources.filter(source => source.priorityAu).map(source => `
          <tr><td><strong>${escapeHtml(source.sourceLabel)}</strong></td><td><span class="status ${escapeHtml(source.status)}">${escapeHtml(source.status.replaceAll("_", " "))}</span></td><td>${escapeHtml(sourceSummary(source))}</td></tr>`).join("");
  const candidateRows = report.candidates.map(candidate => `
          <tr>
            <td>${escapeHtml(candidate.eventTiming.localDate)}</td>
            <td><strong>${escapeHtml(candidate.title)}</strong><small>${escapeHtml(candidate.candidateId)}</small></td>
            <td><span class="status ${escapeHtml(candidate.matchStatus)}">${escapeHtml(candidate.matchStatus)}</span>${candidate.match.canonicalEventId ? `<small>${escapeHtml(candidate.match.canonicalEventId)}</small>` : ""}</td>
            <td class="number">${candidate.match.confidence.toFixed(2)}</td>
            <td>${escapeHtml(candidate.priority)}</td><td><span class="action ${escapeHtml(candidate.suggestedAction)}">${escapeHtml(candidate.suggestedAction)}</span></td>
            <td>${escapeHtml(candidate.broadcastsAu.map(option => `${option.serviceLabel} · ${option.accessType}`).join(", ") || "Unproven")}</td>
            <td>${escapeHtml(candidate.blockers.join(", ") || "None")}</td>
          </tr>`).join("");
  const commercialRows = report.commercialSourceOptions.map(option => `
          <tr><td><strong><a href="${escapeHtml(option.sourceUrl)}">${escapeHtml(option.label)}</a></strong></td><td>${escapeHtml(option.role)}</td><td>${escapeHtml(option.auFit.replaceAll("_", " "))}</td><td>${escapeHtml(option.evaluation.replaceAll("_", " "))}</td><td>${escapeHtml(option.recommendation.replaceAll("_", " "))}<small>${escapeHtml(option.limitations)}</small></td></tr>`).join("");
  return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>nothingSport coverage discovery · ${escapeHtml(report.referenceDate)}</title>
  <style>
    :root { color-scheme: dark; --ink:#f5f4ef; --muted:#a9a9a3; --line:#30302d; --panel:#171715; --lime:#d8ff56; --amber:#ffc857; --rose:#ff7a90; }
    * { box-sizing:border-box; } body { margin:0; font:15px/1.45 ui-sans-serif,system-ui,-apple-system,sans-serif; color:var(--ink); background:#0c0c0b; }
    main { width:min(1180px,calc(100% - 32px)); margin:0 auto; padding:48px 0 72px; }
    header { display:grid; gap:10px; margin-bottom:32px; } h1 { margin:0; font-size:clamp(2rem,6vw,4.5rem); line-height:.95; letter-spacing:-.06em; max-width:820px; }
    .eyebrow { color:var(--lime); text-transform:uppercase; letter-spacing:.16em; font-size:.76rem; font-weight:800; } p { color:var(--muted); max-width:760px; margin:0; }
    .metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin:28px 0 40px; } .metric { background:var(--panel); border:1px solid var(--line); border-radius:16px; padding:18px; }
    .metric strong { display:block; font-size:2rem; letter-spacing:-.04em; } .metric span, small { display:block; color:var(--muted); font-size:.78rem; margin-top:4px; }
    section { margin-top:40px; } h2 { font-size:1.35rem; margin:0 0 14px; } .table-wrap { overflow:auto; border:1px solid var(--line); border-radius:16px; background:var(--panel); }
    table { width:100%; border-collapse:collapse; min-width:780px; } th,td { text-align:left; padding:13px 14px; border-bottom:1px solid var(--line); vertical-align:top; } th { color:var(--muted); font-size:.72rem; text-transform:uppercase; letter-spacing:.08em; } tr:last-child td { border-bottom:0; }
    .number { font-variant-numeric:tabular-nums; } .status,.action { display:inline-block; border-radius:999px; padding:3px 8px; background:#292926; font-size:.72rem; font-weight:750; text-transform:uppercase; letter-spacing:.04em; }
    .loaded,.matched,.publish { color:var(--lime); } .new,.review { color:var(--amber); } .ambiguous,.no_approved_input,.ignore { color:var(--rose); }
    .note { border-left:3px solid var(--lime); padding:4px 0 4px 16px; }
    code,a { color:var(--ink); } a:hover { color:var(--lime); } footer { margin-top:42px; color:var(--muted); font-size:.78rem; }
    @media (max-width:720px) { main { width:min(100% - 24px,1180px); padding-top:28px; } .metrics { grid-template-columns:repeat(2,minmax(0,1fr)); } }
  </style>
</head>
<body><main>
  <header><span class="eyebrow">Weekly source reconciliation · ${escapeHtml(report.referenceDate)}</span><h1>Coverage gaps, without false certainty.</h1><p>${report.summary.liveOrDelayedListingsEvaluated} broadcaster listings were compared with ${report.summary.canonicalEventsCompared} canonical events. Missing source inputs remain visible and fail closed.</p></header>
  <div class="metrics"><div class="metric"><strong>${report.summary.newCatalogueGaps}</strong><span>new catalogue gaps</span></div><div class="metric"><strong>${report.summary.ambiguous}</strong><span>ambiguous matches</span></div><div class="metric"><strong>${report.summary.auAvailabilityChanges}</strong><span>AU option changes</span></div><div class="metric"><strong>${report.summary.highPriorityRecommendations}</strong><span>high-priority recommendations</span></div></div>
  <section><h2>Australian source health</h2><div class="table-wrap"><table><thead><tr><th>Source</th><th>Status</th><th>Mode and freshness</th></tr></thead><tbody>${sourceRows}</tbody></table></div></section>
  <section><h2>Editorial queue</h2><div class="table-wrap"><table><thead><tr><th>Date</th><th>Candidate</th><th>Match</th><th>Confidence</th><th>Priority</th><th>Action</th><th>AU option</th><th>Blockers</th></tr></thead><tbody>${candidateRows}</tbody></table></div></section>
  <section class="note"><h2>Decision boundary</h2><p>New and ambiguous events always remain under review. Publish requires an existing canonical match at 0.92 or higher, a named Australian service, known access type and no blockers. Approved decisions are exported separately; this queue never mutates the event feed.</p></section>
  <section><h2>Paid and licensed possibilities</h2><p>The adapter contract accepts licensed API snapshots without changing the editorial model. Global claims are not treated as proof of Australian inventory.</p><div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Supplier</th><th>Possible role</th><th>AU evidence</th><th>Evaluation</th><th>Recommendation</th></tr></thead><tbody>${commercialRows}</tbody></table></div></section>
  <section class="note"><h2>Recommended procurement test</h2><p>Test YuVu for Australian free-to-air EPG, Gracenote and JustWatch for event-level availability, and Sportradar for fixture identity against one 30-day canonical sample. Add Stats Perform where official NRL, Rugby Australia or A-Leagues provenance matters.</p></section>
  <footer>Generated from approved source snapshots through the canonical <code>node scripts/update-cards.js</code> path.</footer>
</main></body></html>\n`;
}

function renderJson(report){
  return `${JSON.stringify(report, null, 2)}\n`;
}

function outputSet(report){
  return new Map([
    [JSON_OUTPUT, renderJson(report)],
    [MARKDOWN_OUTPUT, renderMarkdown(report)],
    [HTML_OUTPUT, renderHtml(report)],
  ]);
}

function main(argv = process.argv.slice(2)){
  const options = parseOptions(argv);
  const snapshots = loadSnapshots();
  if (options.enforceFreshness) assertFreshSnapshots(snapshots, options.referenceDate);
  const report = buildReport({ referenceDate: options.referenceDate, snapshots });
  const outputs = outputSet(report);
  if (options.check){
    const stale = Array.from(outputs).filter(([filePath, expected]) => !fs.existsSync(filePath) || fs.readFileSync(filePath, "utf8") !== expected);
    if (stale.length){
      console.error(`Coverage discovery outputs are stale: ${stale.map(([filePath]) => path.relative(ROOT, filePath)).join(", ")}`);
      process.exit(1);
    }
    console.log(`Coverage discovery current: ${report.candidates.length} candidates, ${report.summary.newCatalogueGaps} catalogue gaps, ${report.summary.priorityAuSourcesLoaded}/${report.summary.priorityAuSources} AU sources loaded.`);
    return;
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  outputs.forEach((content, filePath) => fs.writeFileSync(filePath, content));
  console.log(`Coverage discovery written: ${report.candidates.length} candidates, ${report.summary.newCatalogueGaps} catalogue gaps, ${report.summary.priorityAuSourcesLoaded}/${report.summary.priorityAuSources} AU sources loaded.`);
}

if (require.main === module) main();

module.exports = {
  ROOT,
  EXPORT_DIR,
  JSON_OUTPUT,
  MARKDOWN_OUTPUT,
  HTML_OUTPUT,
  MAXIMUM_SNAPSHOT_AGE_DAYS,
  assertFreshSnapshots,
  buildReport,
  canonicalCatalogue,
  loadSnapshots,
  outputSet,
  parseOptions,
  renderHtml,
  renderJson,
  renderMarkdown,
  sydneyDate,
  snapshotAgeDays,
};
