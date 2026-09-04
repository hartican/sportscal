#!/usr/bin/env node

const { spawnSync } = require("child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
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
  if (result.status !== 0) {
    const error = new Error(`${display} failed with exit code ${result.status || 1}`);
    error.exitCode = result.status || 1;
    throw error;
  }
}

function parseOptions(argv = process.argv.slice(2), env = process.env) {
  return {
    localOnly: argv.includes("--local-only") || argv.includes("-p") || env.SKIP_RELEASE === "1",
  };
}

function buildSteps({ localOnly = false } = {}) {
  const steps = [
  ["scripts/snapshot-active-follows.js"],
  ["scripts/refresh-canonical-sports.js"],
  ["scripts/refresh-premier-league-context.js"],
  ["scripts/refresh-premier-league-context.js", "--check"],
  ["scripts/validate-premier-league-context.js"],
  ["scripts/migrate-competition-codes.js"],
  ["scripts/refresh-major-events-from-canonical.js"],
  ["scripts/migrate-competition-codes.js", "--check"],
  ["scripts/refresh-us-open-events.js"],
  ["scripts/refresh-us-open-events.js", "--check"],
  ["scripts/apply-national-team-identities.js", "data/major-events.v1.json"],
  ["scripts/refresh-tennis-ranking-exports.js"],
  ["scripts/validate-tennis-ranking-refresh.js"],
  ["scripts/refresh-tennis-catalogue.js", "--enforce-freshness"],
  ["scripts/refresh-tennis-catalogue.js", "--check", "--enforce-freshness"],
  ["scripts/validate-joint-tennis-tournament.js"],
  ["scripts/build-tennis-context.js"],
  ["scripts/build-tennis-context.js", "--check"],
  ["scripts/validate-country-flags.js"],
  ["scripts/validate-national-team-identities.js", "--assets-only"],
  ["scripts/refresh-football-directory.js", "--prune-removed"],
  ["scripts/refresh-football-directory.js", "--check"],
  ["scripts/validate-football-directory.js"],
  ["scripts/build-team-player-directories.js"],
  ["scripts/build-team-player-directories.js", "--check"],
  ["scripts/validate-team-player-directories.js"],
  ["scripts/refresh-nfl-ice-hockey.js"],
  ["scripts/refresh-nfl-ice-hockey.js", "--check"],
  ["scripts/validate-refresh-resilience.js"],
  ["scripts/refresh-official-follow-fixtures.js"],
  ["scripts/refresh-official-follow-fixtures.js", "--check"],
  ["scripts/refresh-swimming-directory.js"],
  ["scripts/refresh-swimming-directory.js", "--check"],
  ["scripts/build-follow-directories.js"],
  ["scripts/build-follow-directories.js", "--check"],
  ["scripts/validate-follow-directories.js"],
  ["scripts/validate-tennis-catalogue.js"],
  ["scripts/validate-canonical-sports.js"],
  ["scripts/validate-card-identities.js"],
  ["scripts/validate-identity-fallback-lifecycle.js"],
  ["scripts/validate-card-polish.js"],
  ["scripts/validate-competition-classification.js"],
  ["scripts/validate-events-stakes-giphy-startup-release.js"],
  ["scripts/validate-gif-proxy.js"],
  ["scripts/validate-major-event-duplicates.js"],
  ["scripts/validate-sport-hierarchy.js"],
  ["scripts/validate-discovery-catalogue.js"],
  ["scripts/validate-preference-taxonomy.js"],
  ["scripts/validate-preference-system.js"],
  ["scripts/validate-card-dismissal-learning.js"],
  ["scripts/validate-feed-controls.js"],
  ["scripts/validate-loading-progress.js"],
  ["scripts/validate-fixtures-contract.js"],
  ["scripts/validate-f1-context.js"],
  ["scripts/validate-tennis-context.js"],
  ["scripts/validate-nba-context.js"],
  ["scripts/validate-cycling-context.js"],
  ["scripts/build-canonical-context-bundle.js"],
  ["scripts/build-canonical-context-bundle.js", "--check"],
  ["scripts/refresh-results-2026-07-30.js", "feeds/incoming/events.json"],
  ["scripts/reconcile-australian-marquee-events.js", "data/canonical/australian-marquee-events-2026.json", "feeds/incoming/events.json", "feeds/incoming/events.json"],
  ["scripts/sync-tennis-tournaments-to-feed.js", "--from-exports", "feeds/incoming/events.json", "feeds/incoming/events.json"],
  ...canonicalStepSet(canonicalBundlePath => (
    [["scripts/sync-canonical-fixtures-to-feed.js", canonicalBundlePath, "feeds/incoming/events.json", "feeds/incoming/events.json"]]
  ), discoverCanonicalFixtureBundles()),
  ["scripts/refresh-premier-league-cards.js", "feeds/incoming/events.json", "feeds/incoming/events.json"],
  ["scripts/enrich-legacy-cards.js", "feeds/incoming/events.json", "feeds/incoming/events.json"],
  ["scripts/apply-representative-metadata.js", "feeds/incoming/events.json"],
  ["scripts/apply-national-team-identities.js", "feeds/incoming/events.json"],
  ["scripts/apply-approved-coverage.js", "--write"],
  ["scripts/apply-approved-coverage.js", "--check"],
  ["scripts/verify-marquee-coverage.js", "data/canonical/australian-marquee-events-2026.json", "feeds/incoming/events.json"],
  ["scripts/refresh-f1-editorial.js", "feeds/incoming/events.json"],
  ["scripts/apply-editorial-previews.js"],
  ["scripts/enrich-storyline-cards.js", "--write"],
  ["scripts/snapshot-editorial-nothingscore.js", "--write"],
  ["scripts/snapshot-editorial-nothingscore.js", "--check"],
  ["scripts/update-rolling-editorial-projections.js", "--write"],
  ["scripts/update-sport-editorial-depth.js", "--write"],
  ["scripts/enrich-editorial-consequences.js", "--write"],
  ["scripts/update-editorial-audience-memory.js", "--write"],
  ["scripts/apply-editorial-narratives.js", "--write"],
  ["scripts/validate-major-events.js"],
  ["scripts/build-editorial-research-queue.js", "--write"],
  ...canonicalStepSet(canonicalBundlePath => (
    [["scripts/sync-canonical-fixtures-to-feed.js", canonicalBundlePath, "data/events.json", "data/events.json"]]
  ), discoverCanonicalFixtureBundles()),
  ["scripts/publish-feed.js", "feeds/incoming/events.json", "data/events.json", "data/feed-meta.json", "data/events.js", "--replace"],
  ["scripts/apply-representative-metadata.js", "data/events.json", "data/events.js"],
  ["scripts/apply-national-team-identities.js", "data/events.json", "data/events.js"],
  ["scripts/validate-editorial-narratives.js"],
  ["scripts/validate-editorial-consequences.js"],
  ["scripts/validate-editorial-render-coverage.js"],
  ["scripts/validate-editorial-sport-depth.js"],
  ["scripts/validate-editorial-interactions.js"],
  ["scripts/validate-editorial-audience-memory.js"],
  ["scripts/validate-nsc-demo-panel.js"],
  ["scripts/validate-crowd-editorial-coverage.js"],
  ["scripts/validate-mixed-feed-navigation.js"],
  ["scripts/build-follow-fixtures.js"],
  ["scripts/build-follow-fixtures.js", "--check"],
  ["scripts/build-paged-feed.js"],
  ["scripts/build-code-inspector.js"],
  ["scripts/validate-fixture-editorial-resolution.js"],
  ["scripts/validate-national-team-identities.js"],
  ["scripts/build-marquee-candidates.js"],
  ["scripts/validate-marquee-candidates.js"],
  ["scripts/validate-marquee-communications.js"],
  ["scripts/validate-admin-console.js"],
  ["scripts/validate-admin-api.js"],
  ["scripts/validate-phase5-premium-ranking.js"],
  ["scripts/scan-broadcaster-coverage.js", "--enforce-freshness"],
  ["scripts/scan-broadcaster-coverage.js", "--check", "--enforce-freshness"],
  ["scripts/validate-broadcaster-discovery.js"],
  ["scripts/validate-editorial-preview-standings.js"],
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
  ["scripts/validate-result-completeness-timing.js"],
  ["scripts/verify-result-completeness.js", "feeds/incoming/events.json"],
  ["scripts/verify-result-completeness.js", "data/events.json"],
  ["scripts/verify-pilot-readiness.js"],
  ["scripts/validate-pilot-readout.js"],
  ["scripts/build-discovery-dashboard.js"],
  ["scripts/build-discovery-dashboard.js", "--check"],
  ["scripts/validate-discovery-measurement.js"],
  ["scripts/validate-swipe-learning.js"],
  ["scripts/validate-tuning-ratings.js"],
  ["scripts/validate-product-events.js"],
  ["scripts/validate-cross-device-sync.js"],
  ["scripts/validate-server-persistence.js"],
  ["scripts/validate-preference-reset-recovery.js"],
  ["scripts/validate-server-feed.js"],
  ["scripts/validate-followed-fixture-surfacing.js"],
  ["scripts/validate-authenticated-feed-startup.js"],
  ["scripts/validate-follow-fixture-resolver.js"],
  ["scripts/validate-update-cards.js"],
  ["scripts/validate-source-and-venues.js"],
  ["scripts/validate-feed-performance.js"],
  ["scripts/validate-code-inspector-ui.js"],
  ["scripts/validate-events-fixture-ux.js"],
  ["scripts/validate-interaction-card-reliability.js"],
  ["scripts/validate-card-chat-viewport-release.js"],
  ["scripts/validate-optimistic-actions.js"],
  ["scripts/validate-event-now-follow-affinity.js"],
  ["scripts/validate-mobile-reliability-pass.js"],
  ["scripts/validate-header-loader-overlay.js"],
  ["scripts/validate-australian-viewing-rights.js"],
  ["scripts/validate-feed-ui-geometry.js"],
  ["scripts/validate-follow-first.js"],
  ["scripts/validate-mobile-feed-events-brand-pass.js"],
  ["scripts/validate-feed-sport-reliability-pass.js"],
  ["scripts/audit-followed-fixture-coverage.js"],
  ];
  if (!localOnly) steps.push(["scripts/redeploy-and-release.sh"]);
  return steps;
}

function main() {
  const options = parseOptions();
  const steps = buildSteps(options);
  const snapshotDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "nothingsport-follow-snapshot-"));
  fs.chmodSync(snapshotDirectory, 0o700);
  process.env.FOLLOW_SNAPSHOT_PATH = path.join(snapshotDirectory, "active-follows.enc.json");
  process.env.FOLLOW_SNAPSHOT_KEY = crypto.randomBytes(32).toString("base64");
  if (options.localOnly) {
    console.log("Local-only update selected: refresh and validation will run without commit, push, or deployment.");
  }
  try {
    for (const args of steps) {
      runStep(args);
    }

    console.log(`\nCards, ladders and standings update complete${options.localOnly ? " (local only)" : ""}: canonical ranking data refreshed and validated, followed fixtures recomputed from the current server snapshot, curated previews applied, future high-stakes cards queued, and both feeds passed editorial, spoiler and schema QA.`);
  } finally {
    delete process.env.FOLLOW_SNAPSHOT_PATH;
    delete process.env.FOLLOW_SNAPSHOT_KEY;
    fs.rmSync(snapshotDirectory, { recursive:true, force:true });
  }
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    console.error(error.message);
    process.exitCode = error.exitCode || 1;
  }
}

module.exports = {
  buildSteps,
  discoverCanonicalFixtureBundles,
  parseOptions,
};
