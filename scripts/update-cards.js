#!/usr/bin/env node

const { spawnSync } = require("child_process");

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

const steps = [
  ["scripts/refresh-canonical-sports.js"],
  ["scripts/validate-canonical-sports.js"],
  ["scripts/validate-f1-context.js"],
  ["scripts/validate-tennis-context.js"],
  ["scripts/validate-nba-context.js"],
  ["scripts/validate-cycling-context.js"],
  ["scripts/refresh-results-2026-07-30.js", "feeds/incoming/events.json"],
  ["scripts/reconcile-australian-marquee-events.js", "data/canonical/australian-marquee-events-2026.json", "feeds/incoming/events.json", "feeds/incoming/events.json"],
  ["scripts/sync-canonical-fixtures-to-feed.js", "data/canonical/afl-nrl-2026.json", "feeds/incoming/events.json", "feeds/incoming/events.json"],
  ["scripts/verify-marquee-coverage.js", "data/canonical/australian-marquee-events-2026.json", "feeds/incoming/events.json"],
  ["scripts/sync-canonical-fixtures-to-feed.js", "data/canonical/afl-nrl-2026.json", "data/events.json", "data/events.json"],
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
  ["scripts/validate-canonical-feed-coverage.js", "data/canonical/afl-nrl-2026.json", "feeds/incoming/events.json"],
  ["scripts/validate-canonical-feed-coverage.js", "data/canonical/afl-nrl-2026.json", "data/events.json"],
  ["scripts/verify-marquee-coverage.js", "data/canonical/australian-marquee-events-2026.json", "data/events.json"],
  ["scripts/verify-result-completeness.js", "feeds/incoming/events.json"],
  ["scripts/verify-result-completeness.js", "data/events.json"],
  ["scripts/redeploy-and-release.sh"],
];

for (const args of steps) {
  runStep(args);
}

console.log("\nCards, ladders and standings update complete: canonical ranking data refreshed and validated, curated previews applied, future high-stakes cards queued, and both feeds passed editorial, spoiler and schema QA.");
