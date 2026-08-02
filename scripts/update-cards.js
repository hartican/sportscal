#!/usr/bin/env node

const { spawnSync } = require("child_process");

const steps = [
  ["scripts/refresh-canonical-sports.js"],
  ["scripts/validate-canonical-sports.js"],
  ["scripts/validate-f1-context.js"],
  ["scripts/validate-tennis-context.js"],
  ["scripts/validate-nba-context.js"],
  ["scripts/validate-cwg-context.js"],
  ["scripts/validate-cycling-context.js"],
  ["scripts/sync-canonical-fixtures-to-feed.js", "data/canonical/afl-nrl-2026.json", "feeds/incoming/events.json", "feeds/incoming/events.json"],
  ["scripts/sync-canonical-fixtures-to-feed.js", "data/canonical/afl-nrl-2026.json", "data/events.json", "data/events.json"],
  ["scripts/publish-feed.js", "feeds/incoming/events.json", "data/events.json", "data/feed-meta.json", "data/events.js", "--replace"],
  ["scripts/apply-editorial-previews.js"],
  ["scripts/enrich-storyline-cards.js", "--write"],
  ["scripts/audit-editorial-previews.js", "data/events.json", "data/editorial-preview-audit.json"],
  ["scripts/audit-storyline-cards.js", "data/events.json", "data/card-audit.json"],
  ["scripts/qa-storyline-spoilers.js", "feeds/incoming/events.json"],
  ["scripts/qa-storyline-spoilers.js", "data/events.json"],
  ["scripts/validate-feed.js", "feeds/incoming/events.json"],
  ["scripts/validate-feed.js", "data/events.json"],
  ["scripts/verify-result-completeness.js", "feeds/incoming/events.json"],
  ["scripts/verify-result-completeness.js", "data/events.json"],
];

for (const args of steps) {
  console.log(`\n> node ${args.join(" ")}`);
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log("\nCards, ladders and standings update complete: canonical ranking data refreshed and validated, curated previews applied, future high-stakes cards queued, and both feeds passed editorial, spoiler and schema QA.");
