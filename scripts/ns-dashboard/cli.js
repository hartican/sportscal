#!/usr/bin/env node
"use strict";

const path = require("node:path"), fs = require("node:fs");
const { collect, replayCapture } = require("./github");
const local = require("./local");
const core = require("./core");
const { writeBundle } = require("./bundle");
const { projectBriefing } = require("./briefing");
function argumentsOf(args) {
  const command = args.shift(), options = {};
  if (!["collect", "project", "replay", "overview", "dashboard"].includes(command)) core.fail("use_collect_project_replay_overview_or_dashboard");
  while (args.length) {
    const key = args.shift(), value = args.shift();
    if (!["--output", "--records", "--input", "--cutoffs", "--as-of", "--max-requests", "--max-ms", "--max-bytes"].includes(key) || !value || options[key]) core.fail("invalid_cli_option");
    options[key] = value;
  }
  if (!options["--output"]) core.fail("output_required");
  const allowed = { collect: ["--output", "--max-requests", "--max-ms", "--max-bytes"], replay: ["--output", "--input"], project: ["--output", "--records", "--cutoffs", "--as-of"], overview: ["--output", "--records", "--cutoffs", "--as-of"], dashboard: ["--input", "--output", "--records", "--cutoffs", "--as-of"] };
  if (Object.keys(options).some(key => !allowed[command].includes(key))) core.fail("option_not_supported_for_command");
  return { command, options };
}
async function main(args = process.argv.slice(2)) {
  const { command, options: o } = argumentsOf(args);
  const directory = local.privateDirectory(o["--output"]);
  if (command === "replay") {
    if (!o["--input"] || local.latest(directory)) core.fail("replay_requires_input_and_empty_output");
    const result = await local.refresh(directory, () => replayCapture(local.readJson(path.resolve(o["--input"]))));
    console.log(JSON.stringify({ status: result.status.state, complete: result.attempt.complete, error: result.status.error, networkRequests: 0 }));
    if (!result.attempt.complete) process.exitCode = 1;
    return;
  }
  if (command === "collect") {
    const budget = {};
    for (const [flag, name] of [["--max-requests", "maxRequests"], ["--max-ms", "maxMs"], ["--max-bytes", "maxBytes"]]) {
      if (o[flag]) budget[name] = Number(o[flag]);
    }
    const result = await local.refresh(directory, previous => collect({ previous, ...budget }));
    console.log(JSON.stringify({ status: result.status.state, complete: result.attempt.complete,
      coverage: result.attempt.coverage, error: result.status.error, lastGoodAvailable: Boolean(result.data) }));
    if (!result.attempt.complete) process.exitCode = 1;
    return;
  }
  const asOf = o["--as-of"] || new Date().toISOString();
  if (command === "dashboard" && !o["--input"]) core.fail("dashboard_input_required");
  const view = local.readView(command === "dashboard" ? o["--input"] : directory, asOf);
  if (!view.data) {
    if (!["overview", "dashboard"].includes(command)) core.fail("no_last_good_export");
    const empty = { schemaVersion: core.VERSION, generatedAt: asOf, freshness: view.freshness };
    const bundle = writeBundle(directory, empty, { asOf });
    if (command === "overview") local.atomicText(directory, "overview.html", fs.readFileSync(bundle.entry, "utf8"));
    console.log(JSON.stringify({ status: view.freshness.state, ...bundle, sourceAvailable: false }));
    return;
  }
  const records = o["--records"] ? local.readJson(path.resolve(o["--records"]), 1_000_000) : null;
  if (records && (typeof records !== "object" || Array.isArray(records) || Object.keys(records).some(key => !["queue", "release", "briefing"].includes(key)))) core.fail("unknown_operator_field");
  const cutoffs = o["--cutoffs"] ? o["--cutoffs"].split(",").map(date => core.sydneyInstant(date)) : [];
  const historical = cutoffs.map(at => core.snapshot(view.data, at));
  const windows = core.completeWindows(view.data.asOf).map(window => ({
    ...window, flow: core.flow(view.data, window.start, window.end, false, true),
  }));
  const result = {
    schemaVersion: core.VERSION, definitionVersion: "1.0.0", generatedAt: asOf,
    repository: core.REPOSITORY, sourceExportHash: core.hash(view.data), freshness: view.freshness,
    currentBacklogAtCollection: core.snapshot(view.data, view.data.asOf), windows, historical,
    historicalFlow: cutoffs.length > 1 ? core.flow(view.data, cutoffs[0], cutoffs.at(-1)) : null,
    queue: records?.queue ? core.groupQueue(view.data, records.queue, asOf) : null,
    queueCoverage: records?.queue ? { complete: records.queue.complete === true, source: records.queue.source, observedAt: records.queue.observedAt } : { status: "not_measured" },
    release: core.releaseProjection(records?.release, asOf),
    dora: { status: "not_measured", reason: "Complete application deployment/commit mapping and incident observation are not ingested in this slice." },
  };
  result.briefing = projectBriefing(records?.briefing, result.release, asOf);
  const isDashboard = command === "overview" || command === "dashboard";
  let bundle;
  if (isDashboard) bundle = writeBundle(directory, result, { asOf });
  if (command !== "dashboard") local.atomic(directory, command === "overview" ? "overview-projection.json" : "projection.json", result);
  if (command === "overview") local.atomicText(directory, "overview.html", fs.readFileSync(bundle.entry, "utf8"));
  console.log(JSON.stringify({ status: view.freshness.state, output: isDashboard ? "index.html" : "projection.json", ...bundle,
    openPrsAtCollection: result.currentBacklogAtCollection.open, historicalSnapshots: historical.map(s => ({ cutoff: s.cutoff, open: s.open, drafts: s.drafts })),
    groupedDeliverables: result.queue?.length ?? null }));
}
if (require.main === module) main().catch(error => { console.error(JSON.stringify({ error: error.code || "dashboard_failed" })); process.exitCode = 1; });
module.exports = { main, argumentsOf };
