#!/usr/bin/env node

const { spawnSync } = require("child_process");
const fs = require("node:fs");
const path = require("node:path");

function discoverCanonicalFixtureBundles() {
  const canonicalDir = path.resolve(__dirname, "../data/canonical");
  const fallback = ["data/canonical/afl-nrl-2026.json"];
  try {
    const files = fs.readdirSync(canonicalDir)
      .filter(name => name.endsWith(".json"))
      .map(name => path.join("data/canonical", name))
      .filter(filePath => {
        try {
          const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
          return payload?.schemaVersion === "canonical-sports.v1"
            && Array.isArray(payload?.events)
            && Array.isArray(payload?.participants)
            && payload.events.length > 0;
        } catch {
          return false;
        }
      });
    return files.length ? files : fallback;
  } catch {
    return fallback;
  }
}

function canonicalStepSet(stepBuilder, canonicalBundlePaths) {
  const list = canonicalBundlePaths.length ? canonicalBundlePaths : ["data/canonical/afl-nrl-2026.json"];
  return list.flatMap(canonicalBundle => stepBuilder(canonicalBundle));
}

function runStep(args) {
  const command = args[0];
  const isNodeScript = command.endsWith(".js");
  const runner = isNodeScript ? process.execPath : command;
  const commandArgs = isNodeScript ? args : args.slice(1);
  const commandLabel = isNodeScript ? `node ${args.join(" ")}` : args.join(" ");
  const display = commandLabel || command;

  console.log(`\n> ${display}`);
  const result = spawnSync(runner, commandArgs, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}

function parseOptions(argv = process.argv.slice(2)) {
  return {
    localOnly: argv.includes("--local-only"),
  };
}

function buildSteps({ localOnly = false } = {}) {
  const steps = [
  ["scripts/refresh-canonical-sports.js"],
  ["scripts/validate-canonical-sports.js"],
  ["scripts/validate-f1-context.js"],
  ["scripts/validate-tennis-context.js"],
  ["scripts/validate-nba-context.js"],
  ["scripts/validate-cycling-context.js"],
  ["scripts/refresh-results-2026-07-30.js", "feeds/incoming/events.json"],
  ["scripts/reconcile-australian-marquee-events.js", "data/canonical/australian-marquee-events-2026.json", "feeds/incoming/events.json", "feeds/incoming/events.json"],
  ...canonicalStepSet(canonicalBundlePath => (
    [["scripts/sync-canonical-fixtures-to-feed.js", canonicalBundlePath, "feeds/incoming/events.json", "feeds/incoming/events.json"]]
  ), discoverCanonicalFixtureBundles()),
  ["scripts/verify-marquee-coverage.js", "data/canonical/australian-marquee-events-2026.json", "feeds/incoming/events.json"],
  ...canonicalStepSet(canonicalBundlePath => (
    [["scripts/sync-canonical-fixtures-to-feed.js", canonicalBundlePath, "data/events.json", "data/events.json"]]
  ), discoverCanonicalFixtureBundles()),
  ["scripts/publish-feed.js", "feeds/incoming/events.json", "data/events.json", "data/feed-meta.json", "data/events.js", "--replace"],
  ["scripts/apply-editorial-previews.js"],
  ["scripts/enrich-storyline-cards.js", "--write"],
  ["scripts/validate-cwg-context.js"],
  ["scripts/audit-editorial-previews.js", "data/events.json", "data/editorial-preview-audit.json"],
  ["scripts/audit-storyline-cards.js", "data/events.json", "data/card-audit.json"],
  ["scripts/qa-storyline-spoilers.js", "feeds/incoming/events.json"],
  ["scripts/qa-storyline-spoilers.js", "data/events.json"],
  ["scripts/validate-feed.js", "feeds/incoming/events.json"],
  ["scripts/validate-feed.js", "data/events.json"],
  ...canonicalStepSet(canonicalBundlePath => (
    [
      ["scripts/validate-canonical-feed-coverage.js", canonicalBundlePath, "feeds/incoming/events.json"],
      ["scripts/validate-canonical-feed-coverage.js", canonicalBundlePath, "data/events.json"],
    ]
  ), discoverCanonicalFixtureBundles()),
  ["scripts/verify-marquee-coverage.js", "data/canonical/australian-marquee-events-2026.json", "data/events.json"],
  ["scripts/verify-result-completeness.js", "feeds/incoming/events.json"],
  ["scripts/verify-result-completeness.js", "data/events.json"],
  ];
  if (!localOnly) steps.push(["scripts/redeploy-and-release.sh"]);
  return steps;
}

function main() {
  const options = parseOptions();
  const steps = buildSteps(options);
  if (options.localOnly) {
    console.log("Local-only update selected: refresh and validation will run without commit, push, or deployment.");
  }
  for (const args of steps) {
    runStep(args);
  }

  console.log(`\nCards, ladders and standings update complete${options.localOnly ? " (local only)" : ""}: canonical ranking data refreshed and validated, curated previews applied, future high-stakes cards queued, and both feeds passed editorial, spoiler and schema QA.`);
}

if (require.main === module) main();

module.exports = {
  buildSteps,
  discoverCanonicalFixtureBundles,
  parseOptions,
};
