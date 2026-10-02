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

function resumeSteps(steps, argv){
  const flag=argv.indexOf('--resume-from');if(flag<0)return steps;
  const target=argv[flag+1],matches=steps.map((step,index)=>step[0]===target?index:-1).filter(index=>index>=0);
  if(!matches.length)throw new Error('Unknown canonical resume step');
  const occurrenceFlag=argv.indexOf('--resume-occurrence');
  if(matches.length>1&&occurrenceFlag<0)throw new Error(`Ambiguous resume step ${target}: ${matches.length} occurrences; specify --resume-occurrence N. No steps ran.`);
  const occurrence=occurrenceFlag<0?1:Number(argv[occurrenceFlag+1]);
  if(!Number.isInteger(occurrence)||occurrence<1||occurrence>matches.length)throw new Error('Invalid resume occurrence');
  const index=matches[occurrence-1];
  return [...steps.slice(0,index).filter(step=>step[0]==='scripts/snapshot-active-follows.js'),...steps.slice(index)];
}

function runStep(args) {
  const command = args[0];
  // Canonical standings changed before this first shell-backed validator.
  if(["scripts/validate-country-flags.js","scripts/validate-card-polish.js"].includes(command))runStep(["scripts/build-app-shell-runtime.js"]);
  const isNodeScript = command.endsWith(".js");
  const runner = isNodeScript ? process.execPath : command;
  const commandArgs = isNodeScript ? args : args.slice(1);
  const commandLabel = isNodeScript ? `node ${args.join(" ")}` : args.join(" ");
  const display = commandLabel || command;

  console.log(`\n> ${display}`);
  const env={...process.env};if(/^scripts\/(?:validate-|audit-|qa-|verify-)/.test(command))for(const key of ["FOOTBALL_DATA_API_TOKEN","FOOTBALL_DATA_RUN_DIR","FOOTBALL_DATA_REPORT","GOLF_SOURCE_RUN_ID","GOLF_SOURCE_REPORT"])delete env[key];
  const result = spawnSync(runner, commandArgs, { stdio: "inherit",env });
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

function buildQuickSteps(argv = process.argv.slice(2)) {
  return [["scripts/quick-results.js", ...argv.filter(arg => ["--offline", "--rebuild"].includes(arg))]];
}

function buildSteps({ localOnly = false } = {}) {
  const steps = [
  ...((process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.FOLLOW_SNAPSHOT_PRELOADED_JSON_PATH || process.env.FOLLOW_SNAPSHOT_PRELOADED_PATH)
    ? [["scripts/snapshot-active-follows.js"]]
    : []),
  ["scripts/refresh-pga-schedule.js"],
  ["scripts/refresh-source-coverage.js"],
  ["scripts/apply-reviewed-fixture-timing.js", "--ids=rugby-australia-new-zealand-2026-10-17"],
  ["scripts/refresh-openligadb-football.js"],
  ["scripts/validate-european-football-continuity.js"],
  ["scripts/validate-football-data-backup.js"],
  ["scripts/validate-feed-card-presentation.js"],
  ["scripts/refresh-discovery.js"],
  ["scripts/build-athlete-participation.js"],
  ["scripts/refresh-canonical-sports.js"],
  ["scripts/apply-current-card-evidence.js"],
  ["scripts/refresh-wrc-context.js"],
  ["scripts/refresh-wrc-context.js", "--check"],
  ["scripts/validate-wrc-context.js"],
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
  ["scripts/refresh-f1-standings.js"],
  ["scripts/refresh-f1-sessions.js"],
  ["scripts/refresh-motogp-sessions.js"],
  ["scripts/refresh-sailgp-calendar.js"],
  ["scripts/refresh-wsl-calendar.js"],
  ["scripts/refresh-grand-tour-calendars.js"],
  ["scripts/refresh-dakar-calendars.js"],
  ["scripts/refresh-golf-major-calendars.js"],
  ["scripts/refresh-nbl-schedule.js"],
  ["scripts/refresh-athlete-profiles.js"],
  ["scripts/refresh-athlete-profiles.js", "--check"],
  ["scripts/validate-athlete-profiles.js"],
  ["scripts/refresh-nfl-ice-hockey.js"],
  ["scripts/refresh-nfl-ice-hockey.js", "--check"],
  ["scripts/validate-refresh-resilience.js"],
  ["scripts/refresh-official-follow-fixtures.js"],
  ["scripts/refresh-official-follow-fixtures.js", "--check"],
  ["scripts/refresh-swimming-directory.js"],
  ["scripts/refresh-swimming-directory.js", "--check"],
  ["scripts/refresh-tournament-hydration.js", "--full"],
  ["scripts/build-follow-directories.js"],
  ["scripts/build-follow-directories.js", "--check"],
  ["scripts/validate-follow-directories.js"],
  ["scripts/validate-tennis-catalogue.js"],
  ["scripts/build-tennis-journeys.js"],
  ["scripts/validate-tennis-journeys.js"],
  ["scripts/validate-canonical-sports.js"],
  ["scripts/validate-gws-aflw-editorial.js"],
  ["scripts/validate-restored-feed-chat-contract.js"],
  ["scripts/validate-chat-bulk-receipts.js"],
  ["scripts/validate-card-identities.js"],
  ["scripts/validate-rugby-reviewed-identity.js", "--published"],
  ["scripts/validate-rugby-identity-api.js"],
  ["scripts/validate-rugby-identity-database.js"],
  ["scripts/validate-bledisloe-reviewed-identity.js", "--published"],
  ["scripts/validate-bledisloe-identity-api.js"],
  ["scripts/validate-bledisloe-identity-database.js"],
  ["scripts/validate-identity-fallback-lifecycle.js"],
  ["scripts/validate-card-polish.js"],
  ["scripts/validate-events-stakes-giphy-startup-release.js"],
  ["scripts/validate-gif-proxy.js"],
  ["scripts/validate-major-event-duplicates.js"],
  ["scripts/validate-discovery-catalogue.js"],
  ["scripts/validate-preference-taxonomy.js"],
  ["scripts/validate-preference-system.js"],
  ["scripts/validate-card-dismissal-learning.js"],
  ["scripts/validate-feed-controls.js"],
  ["scripts/validate-loading-progress.js"],
  ["scripts/validate-fixtures-contract.js"],
  ["scripts/build-canonical-context-bundle.js"],
  ["scripts/build-canonical-context-bundle.js", "--check"],
  ["scripts/sync-wrc-to-feed.js", "data/canonical/wrc-context-2026.json", "feeds/incoming/events.json", "feeds/incoming/events.json"],
  ["scripts/refresh-results-2026-07-30.js", "feeds/incoming/events.json"],
  ["scripts/reconcile-australian-marquee-events.js", "data/canonical/australian-marquee-events-2026.json", "feeds/incoming/events.json", "feeds/incoming/events.json"],
  ["scripts/sync-tennis-tournaments-to-feed.js", "--from-exports", "feeds/incoming/events.json", "feeds/incoming/events.json"],
  ...canonicalStepSet(canonicalBundlePath => (
    [["scripts/sync-canonical-fixtures-to-feed.js", canonicalBundlePath, "feeds/incoming/events.json", "feeds/incoming/events.json"]]
  ), discoverCanonicalFixtureBundles()),
  ["scripts/apply-current-card-evidence.js"],
  ["scripts/sync-requested-sports-to-feed.js", "feeds/incoming/events.json", "feeds/incoming/events.json"],
  ["scripts/sync-official-card-results.js", "feeds/incoming/events.json", "feeds/incoming/events.json"],
  ["scripts/refresh-premier-league-cards.js", "feeds/incoming/events.json", "feeds/incoming/events.json"],
  ["scripts/build-canonical-context-bundle.js"],
  ["scripts/enrich-legacy-cards.js", "feeds/incoming/events.json", "feeds/incoming/events.json"],
  ["scripts/apply-representative-metadata.js", "feeds/incoming/events.json"],
  ["scripts/apply-national-team-identities.js", "feeds/incoming/events.json"],
  ["scripts/apply-approved-coverage.js", "--write"],
  ["scripts/apply-approved-coverage.js", "--check"],
  ["scripts/verify-marquee-coverage.js", "data/canonical/australian-marquee-events-2026.json", "feeds/incoming/events.json"],
  ["scripts/refresh-f1-results.js"],
  ["scripts/refresh-f1-editorial.js", "feeds/incoming/events.json"],
  ["scripts/sync-programme-fixtures-to-feed.js", "feeds/incoming/events.json"],
  ["scripts/apply-editorial-previews.js"],
  ["scripts/enrich-storyline-cards.js", "--write"],
  ["scripts/apply-coverage-pauses.js"],
  ["scripts/apply-fixture-research.js"],
  ["scripts/validate-catalogue-editorial.js"],
  ["scripts/validate-pwa-schedule-editorial.js"],
  ["scripts/snapshot-editorial-nothingscore.js", "--write"],
  ["scripts/snapshot-editorial-nothingscore.js", "--check"],
  ["scripts/update-rolling-editorial-projections.js", "--write"],
  ["scripts/update-sport-editorial-depth.js", "--write"],
  ["scripts/enrich-editorial-consequences.js", "--write"],
  ["scripts/update-editorial-audience-memory.js", "--write"],
  ["scripts/apply-editorial-narratives.js", "--write"],
  ["scripts/prepare-result-editorial.js"],
  ["scripts/validate-major-events.js"],
  ["scripts/build-editorial-research-queue.js", "--write"],
  // Canonical fixture reconciliation can resolve placeholder identities after
  // the first editorial pass. Reconcile inherited parent/child projections
  // once more before publication so the resolved card keeps its research.
  ["scripts/update-rolling-editorial-projections.js", "--write"],
  ["scripts/apply-editorial-narratives.js", "--write"],
  ...canonicalStepSet(canonicalBundlePath => (
    [["scripts/sync-canonical-fixtures-to-feed.js", canonicalBundlePath, "data/events.json", "data/events.json"]]
  ), discoverCanonicalFixtureBundles()),
  ["scripts/publish-feed.js", "feeds/incoming/events.json", "data/events.json", "data/feed-meta.json", "data/events.js", "--preserve-known"],
  ["scripts/apply-representative-metadata.js", "data/events.json", "data/events.js"],
  ["scripts/apply-national-team-identities.js", "data/events.json", "data/events.js"],
  ["scripts/sync-finals-code-phase.js"],
  ["scripts/sync-finals-code-phase.js", "--check"],
  ["scripts/apply-coverage-pauses.js"],
  ["scripts/validate-editorial-locks.js", "--published"],
  ["scripts/validate-card-coverage-corrections.js"],
  ["scripts/validate-editorial-narratives.js"],
  ["scripts/build-app-shell-runtime.js"],
  ["scripts/build-app-shell-runtime.js", "--check"],
  ["scripts/validate-sport-hierarchy.js"],
  ["scripts/validate-ui-reliability.js"],
  ["scripts/validate-submission-state.js"],
  ["scripts/validate-nsc-client-flow.js"],
  ["scripts/validate-peer-results.js"],
  ["scripts/validate-editorial-consequences.js"],
  ["scripts/validate-editorial-render-coverage.js"],
  ["scripts/validate-editorial-sport-depth.js"],
  ["scripts/validate-editorial-provenance.js"],
  ["scripts/validate-editorial-interactions.js"],
  ["scripts/validate-editorial-audience-memory.js"],
  ["scripts/validate-nsc-demo-panel.js"],
  ["scripts/validate-crowd-editorial-coverage.js"],
  ["scripts/validate-mixed-feed-navigation.js"],
  ["scripts/build-follow-fixtures.js"],
  ["scripts/build-follow-fixtures.js", "--check"],
  ["scripts/build-paged-feed.js"],
  ["scripts/prepare-nsc-forecasts.js"],
  ["scripts/build-code-inspector.js"],
  ["scripts/validate-football-classification.js","--published"],
  ["scripts/build-tennis-feed-parents.js"],
  ["scripts/build-tournament-horizon.js"],
  ["scripts/validate-feed-follow-repairs.js"],
  ["scripts/validate-experience-reliability.js"],
  ["scripts/validate-golf-source-observations.js"],
  ["scripts/validate-canonical-source-readout.js"],
  ["scripts/validate-worker-fallback.js"],
  ["scripts/validate-feed-filter-pagination.js"],
  ["scripts/validate-feed-page-concurrency.js"],
  ["scripts/apply-coverage-pauses.js"],
  ["scripts/validate-coverage-pauses.js"],
  ["scripts/validate-coverage-repairs.js"],
  ["scripts/validate-australia-international-editorial.js"],
  ["scripts/validate-f1-context.js"],
  ["scripts/validate-bahrain-relocation.js"],
  ["scripts/validate-current-card-evidence-provenance.js"],
  ["scripts/validate-tennis-context.js"],
  ["scripts/validate-nba-context.js"],
  ["scripts/validate-cycling-context.js"],
  ["scripts/validate-competition-classification.js"],
  ["scripts/validate-feed-coverage-resilience.js"],
  ["scripts/validate-fixture-snapshot.js"],
  ["scripts/validate-fixture-visibility.js"],
  ["scripts/validate-all-sport-visibility.js"],
  ["scripts/validate-requested-sports.js"],
  ["scripts/validate-sailgp-quality.js", "--published"],
  ["scripts/validate-sailgp-calendar.js", "--published"],
  ["scripts/validate-wsl-calendar.js", "--published"],
  ["scripts/validate-grand-tour-calendars.js", "--published"],
  ["scripts/validate-dakar-calendars.js", "--published"],
  ["scripts/validate-golf-major-calendars.js", "--published"],
  ["scripts/validate-adaptive-follow-grid.js"],
  ["scripts/validate-fixture-editorial-resolution.js"],
  ["scripts/validate-national-team-identities.js"],
  ["scripts/build-marquee-candidates.js"],
  ["scripts/validate-marquee-candidates.js"],
  ["scripts/validate-marquee-communications.js"],
  ["scripts/validate-owner-content-workspace.js"],
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
  ["scripts/apply-current-card-evidence.js", "--check"],
  ["scripts/validate-current-card-coverage.js"],
  ["scripts/verify-result-completeness.js", "feeds/incoming/events.json"],
  ["scripts/verify-result-completeness.js", "data/events.json"],
  ["scripts/verify-pilot-readiness.js"],
  ["scripts/validate-nrl-finals-readiness.js"],
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
  ["scripts/validate-f1-parent-feed.js"],
  ["scripts/validate-authenticated-feed-startup.js"],
  ["scripts/validate-follow-fixture-resolver.js"],
  ["scripts/validate-update-cards.js"],
  ["scripts/validate-source-and-venues.js"],
  ["scripts/validate-feed-performance.js"],
  ["scripts/validate-code-inspector-ui.js"],
  ["scripts/validate-events-fixture-ux.js"],
  ["scripts/validate-ui-foundation.js"],
  ["scripts/validate-interaction-card-reliability.js"],
  ["scripts/validate-crowd-foresight.js"],
  ["scripts/validate-quick-results-cadence.js"],
  ["scripts/validate-nothingscore.js"],
  ["scripts/validate-nsc-alert-editorial-ui.js"],
  ["scripts/validate-calendar-rework.js"],
  ["scripts/validate-calendar-api.js"],
  ["scripts/validate-card-chat-viewport-release.js"],
  ["scripts/validate-optimistic-actions.js"],
  ["scripts/validate-event-now-follow-affinity.js"],
  ["scripts/validate-mobile-reliability-pass.js"],
  ["scripts/validate-header-loader-overlay.js"],
  ["scripts/validate-australian-viewing-rights.js"],
  ["scripts/validate-reviewed-au-viewing.js", "--published"],
  ["scripts/validate-reviewed-au-viewing-api.js"],
  ["scripts/validate-seeded-surf-correction.js"],
  ["scripts/validate-cricket-viewing.js"],
  ["scripts/validate-feed-ui-geometry.js"],
  ["scripts/validate-follow-first.js"],
  ["scripts/validate-follow-policy-parity.js"],
  ["scripts/validate-follow-decisions.js"],
  ["scripts/validate-cricket-coverage.js"],
  ["scripts/validate-asia-cup-source.js", "--published"],
  ["scripts/validate-cricket-current-results.js"],
  ["scripts/validate-cricket-provider-identities.js", "--published"],
  ["scripts/validate-coverage-repair.js"],
  ["scripts/validate-card-timing.js"],
  ["scripts/validate-football-status-display.js"],
  ["scripts/validate-nbl-match-context.js", "--published"],
  ["scripts/validate-match-centre.js"],
  ["scripts/validate-tennis-feed-normalisation.js"],
  ["scripts/validate-tournament-hydration.js"],
  ["scripts/validate-odi-display.js"],
  ["scripts/validate-laver-cup.js"],
  ["scripts/validate-participant-unfollow.js"],
  ["scripts/validate-australian-presentation.js"],
  ["scripts/validate-feed-repair-reconciliation.js"],
  ["scripts/validate-nrl-preliminary-finals.js", "--published"],
  ["scripts/validate-nrl-grand-final.js", "--published"],
  ["scripts/validate-refresh-resume.js"],
  ["scripts/validate-promoted-replay.js"],
  ["scripts/validate-ratings-empty-batch.js"],
  ["scripts/validate-user-follows.js"],
  ["scripts/validate-source-coverage.js"],
  ["scripts/validate-discovery-coverage.js"],
  ["scripts/validate-discovery-refresh.js"],
  ["scripts/validate-discovery-evidence.js"],
  ["scripts/validate-discovery-transport.js"],
  ["scripts/validate-autonomous-discovery.js"],
  ["scripts/validate-live-fixtures.js"],
  ["scripts/validate-live-afl-adapter.js"],
  ["scripts/validate-live-fixture-api.js"],
  ["scripts/validate-calendar-selection.js"],
  ["scripts/validate-fixture-timing.js"],
  ["scripts/validate-us-open-fail-soft.js"],
  ["scripts/validate-mobile-feed-events-brand-pass.js"],
  ["scripts/validate-feed-sport-reliability-pass.js"],
  ["scripts/audit-followed-fixture-coverage.js"],
  ];
  if (!localOnly) steps.push(["scripts/redeploy-and-release.sh"]);
  return steps;
}

async function runMain() {
  const options = parseOptions();
  if(process.argv.includes('--european-football')){
    const result=await require('./refresh-openligadb-football').refresh();
    console.log(JSON.stringify({source:'OpenLigaDB',fixtures:result.payload.events.length,failures:result.failures,primaryFailures:result.primaryFailures}));
    for(const args of [['scripts/build-code-inspector.js','--codes=football,champions-league'],['scripts/build-follow-directories.js','--codes=football'],['scripts/validate-openligadb-football.js'],['scripts/validate-european-football-continuity.js'],['scripts/validate-european-football-standings.js']])runStep(args);
    if(result.failures.length)process.exitCode=1;
    return;
  }
  if(process.argv.some(arg=>arg.startsWith('--source='))){
    const sources=process.argv.filter(arg=>arg.startsWith('--source='));
    if(sources.length!==1||!['--source=nbl','--source=football'].includes(sources[0])||!process.argv.includes('--quick')||process.argv.includes('--offline'))throw new Error('Scoped refresh requires --quick with a reviewed NBL/Football source and live source access');
    runStep(['scripts/quick-results.js',sources[0]]);
    return;
  }
  if(process.argv.includes('--code-projections')){
    const scope=process.argv.find(arg=>arg.startsWith('--codes='));
    if(!scope||!scope.slice(8).split(',').every(slug=>/^[a-z][a-z0-9-]*$/.test(slug)))throw new Error('--code-projections requires --codes=<existing slug,...>');
    const known=new Set(require('../data/code-inspector/manifest.json').codes.map(code=>code.slug));
    if(scope.slice(8).split(',').some(slug=>!known.has(slug)))throw new Error('Unknown Code projection slug');
    runStep(['scripts/build-code-inspector.js',scope]);
    runStep(['scripts/validate-football-classification.js','--published']);
    console.log('Selected Code projections rebuilt from existing canonical data; no source or standings refresh.');
    return;
  }
  if(process.argv.includes('--programme-reconciliation')){
    for(const args of [
      ['scripts/build-code-inspector.js','--codes=nrl,tennis'],
      ['scripts/build-tennis-feed-parents.js'],
      ['scripts/build-tournament-horizon.js'],
      ['scripts/validate-programme-reconciliation.js','--published'],
      ['scripts/validate-tennis-feed-normalisation.js'],
    ])runStep(args);
    if(!options.localOnly)runStep(['scripts/redeploy-and-release.sh']);
    return;
  }
  if(process.argv.includes('--lpga-results')){
    runStep(['scripts/validate-lpga-results.js']);
    runStep(['scripts/refresh-lpga-results.js']);
    runStep(['scripts/build-code-inspector.js','--codes=golf']);
    if(!options.localOnly)runStep(['scripts/redeploy-and-release.sh']);
    return;
  }
  if(process.argv.includes('--golf-quality')){
    for(const step of [
      ['scripts/build-code-inspector.js','--codes=golf'],
      ['scripts/build-app-shell-runtime.js'],['scripts/version-generated-shell.js'],
      ['scripts/validate-reviewed-au-viewing.js','--published'],
      ['scripts/validate-tournament-hydration.js'],['scripts/validate-canonical-source-readout.js'],
      ['scripts/validate-lpga-results.js'],['scripts/validate-experience-reliability.js'],
      ['scripts/validate-golf-source-observations.js']
    ])runStep(step);
    console.log('Golf quality projections rebuilt through canonical owner from retained facts; no sporting source refresh, scheduler or release performed.');return;
  }
  if(process.argv.includes('--dakar-venues')){
    for(const step of [["scripts/refresh-dakar-calendars.js"], ["scripts/sync-requested-sports-to-feed.js", "feeds/incoming/events.json", "feeds/incoming/events.json", "--dakar-only"], ["scripts/sync-requested-sports-to-feed.js", "data/events.json", "data/events.json", "--dakar-only"], ["scripts/publish-feed.js", "data/events.json", "data/events.json", "data/feed-meta.json", "data/events.js", "--preserve-known"], ["scripts/build-follow-fixtures.js"], ["scripts/build-paged-feed.js"], ["scripts/build-code-inspector.js", "--codes=dakar,motorsport"], ["scripts/build-app-shell-runtime.js"], ["scripts/validate-dakar-calendars.js", "--published"], ["scripts/validate-follow-policy-parity.js"], ["scripts/validate-feed.js", "feeds/incoming/events.json"], ["scripts/validate-feed.js", "data/events.json"], ["scripts/qa-storyline-spoilers.js", "data/events.json"]])runStep(step);
    return;
  }
  if(process.argv.includes('--golf-major-venues')){
    for(const step of [["scripts/refresh-golf-major-calendars.js"], ["scripts/sync-requested-sports-to-feed.js", "feeds/incoming/events.json", "feeds/incoming/events.json", "--golf-majors-only"], ["scripts/sync-requested-sports-to-feed.js", "data/events.json", "data/events.json", "--golf-majors-only"], ["scripts/publish-feed.js", "data/events.json", "data/events.json", "data/feed-meta.json", "data/events.js", "--preserve-known"], ["scripts/build-follow-fixtures.js"], ["scripts/build-paged-feed.js"], ["scripts/build-code-inspector.js", "--codes=golf"], ["scripts/build-app-shell-runtime.js"], ["scripts/validate-golf-major-calendars.js", "--published"], ["scripts/validate-follow-policy-parity.js"], ["scripts/validate-feed.js", "feeds/incoming/events.json"], ["scripts/validate-feed.js", "data/events.json"], ["scripts/qa-storyline-spoilers.js", "data/events.json"]])runStep(step);
    console.log('Reviewed men’s major rounds and venue publication complete through the canonical owner.');return;
  }
  if(process.argv.includes('--grand-tours-venues')){
    for(const step of [["scripts/refresh-grand-tour-calendars.js"], ["scripts/sync-requested-sports-to-feed.js", "feeds/incoming/events.json", "feeds/incoming/events.json", "--grand-tours-only"], ["scripts/sync-requested-sports-to-feed.js", "data/events.json", "data/events.json", "--grand-tours-only"], ["scripts/publish-feed.js", "data/events.json", "data/events.json", "data/feed-meta.json", "data/events.js", "--preserve-known"], ["scripts/build-follow-fixtures.js"], ["scripts/build-paged-feed.js"], ["scripts/build-code-inspector.js", "--codes=tour-de-france,giro-ditalia,vuelta-a-espana,cycling"], ["scripts/build-app-shell-runtime.js"], ["scripts/validate-grand-tour-calendars.js", "--published"], ["scripts/validate-cycling-context.js"], ["scripts/validate-follow-policy-parity.js"], ["scripts/validate-feed.js", "feeds/incoming/events.json"], ["scripts/validate-feed.js", "data/events.json"], ["scripts/qa-storyline-spoilers.js", "data/events.json"]])runStep(step);
    if(!options.localOnly)runStep(['scripts/redeploy-and-release.sh']);
    console.log('Grand Tour calendar and route publication complete through canonical owner.');return;
  }
  if(process.argv.includes('--wsl-venues')){
    for(const step of [["scripts/refresh-wsl-calendar.js"], ["scripts/sync-requested-sports-to-feed.js", "feeds/incoming/events.json", "feeds/incoming/events.json", "--wsl-only"], ["scripts/sync-requested-sports-to-feed.js", "data/events.json", "data/events.json", "--wsl-only"], ["scripts/publish-feed.js", "data/events.json", "data/events.json", "data/feed-meta.json", "data/events.js", "--preserve-known"], ["scripts/build-follow-fixtures.js"], ["scripts/build-paged-feed.js"], ["scripts/build-code-inspector.js", "--codes=wsl"], ["scripts/build-app-shell-runtime.js"], ["scripts/validate-wsl-calendar.js", "--published"], ["scripts/validate-seeded-surf-correction.js"], ["scripts/validate-follow-policy-parity.js"], ["scripts/validate-feed.js", "feeds/incoming/events.json"], ["scripts/validate-feed.js", "data/events.json"], ["scripts/qa-storyline-spoilers.js", "data/events.json"]])runStep(step);
    if(!options.localOnly)runStep(['scripts/redeploy-and-release.sh']);
    console.log('WSL published event windows and venue publication complete through canonical owner.');return;
  }
  if(process.argv.includes('--sailgp-venues')){
    for(const step of [
      ['scripts/refresh-sailgp-calendar.js'],
      ['scripts/sync-requested-sports-to-feed.js','feeds/incoming/events.json','feeds/incoming/events.json','--sailgp-only'],
      ['scripts/sync-requested-sports-to-feed.js','data/events.json','data/events.json','--sailgp-only'],
      ['scripts/publish-feed.js','data/events.json','data/events.json','data/feed-meta.json','data/events.js','--preserve-known'],
      ['scripts/build-follow-fixtures.js'],['scripts/build-paged-feed.js'],
      ['scripts/build-code-inspector.js','--codes=sailgp'],
      ['scripts/build-app-shell-runtime.js'],
      ['scripts/validate-sailgp-calendar.js','--published'],
      ['scripts/validate-sailgp-quality.js','--published'],
      ['scripts/validate-requested-sports.js'],['scripts/validate-follow-policy-parity.js'],
      ['scripts/validate-feed.js','feeds/incoming/events.json'],['scripts/validate-feed.js','data/events.json'],
      ['scripts/qa-storyline-spoilers.js','data/events.json']
    ])runStep(step);
    if(!options.localOnly)runStep(['scripts/redeploy-and-release.sh']);
    console.log('SailGP reviewed calendar and venue publication complete through canonical owner; no sporting source requests.');return;
  }
  if(process.argv.includes('--sailgp-quality')){
    for(const step of [
      ['scripts/apply-current-card-evidence.js','--timing-only'],
      ['scripts/publish-feed.js','data/events.json','data/events.json','data/feed-meta.json','data/events.js','--preserve-known'],
      ['scripts/build-follow-fixtures.js'],['scripts/build-paged-feed.js'],
      ['scripts/build-code-inspector.js','--codes=sailgp'],
      ['scripts/build-app-shell-runtime.js'],
      ['scripts/validate-sailgp-quality.js','--published'],
      ['scripts/validate-requested-sports.js'],['scripts/validate-follow-policy-parity.js'],
      ['scripts/validate-feed.js','feeds/incoming/events.json'],['scripts/validate-feed.js','data/events.json'],
      ['scripts/qa-storyline-spoilers.js','data/events.json']
    ])runStep(step);
    if(!options.localOnly)runStep(['scripts/redeploy-and-release.sh']);
    console.log('Reviewed SailGP timing and partial-window publication complete through canonical owner; no source refresh.');return;
  }
  if(process.argv.includes('--wrc-artwork')){
    for(const step of [
      ['scripts/apply-wrc-venue-artwork.js'],
      ['scripts/publish-feed.js','data/events.json','data/events.json','data/feed-meta.json','data/events.js','--preserve-known'],
      ['scripts/build-follow-fixtures.js'],['scripts/build-paged-feed.js'],
      ['scripts/build-code-inspector.js','--codes=wrc,motorsport'],
      ['scripts/build-canonical-context-bundle.js'],['scripts/build-canonical-context-bundle.js','--check'],
      ['scripts/build-app-shell-runtime.js'],['scripts/validate-wrc-venue-coverage.js'],
      ['scripts/validate-follow-policy-parity.js'],['scripts/validate-feed-card-presentation.js'],
      ['scripts/validate-feed.js','data/events.json'],['scripts/qa-storyline-spoilers.js','data/events.json']
    ])runStep(step);
    if(!options.localOnly)runStep(['scripts/redeploy-and-release.sh']);
    return;
  }
  if(process.argv.includes('--wrc')){
    const refresh=['scripts/refresh-wrc-context.js','--calendar-only'];
    for(const flag of ['--calendar-file','--revision-file','--future-file','--checked-at']){const i=process.argv.indexOf(flag);if(i>=0)refresh.push(flag,process.argv[i+1]);}
    for(const step of [refresh,
      ['scripts/sync-wrc-to-feed.js','data/canonical/wrc-context-2026.json','feeds/incoming/events.json'],
      ['scripts/sync-wrc-to-feed.js','data/canonical/wrc-context-2026.json','data/events.json'],
      ['scripts/publish-feed.js','data/events.json','data/events.json','data/feed-meta.json','data/events.js','--preserve-known'],
      ['scripts/build-follow-fixtures.js'],['scripts/build-paged-feed.js'],
      ['scripts/build-code-inspector.js','--codes=wrc,motorsport'],['scripts/build-canonical-context-bundle.js'],['scripts/build-canonical-context-bundle.js','--check'],['scripts/build-app-shell-runtime.js'],
      ['scripts/validate-wrc-venue-coverage.js'],['scripts/validate-follow-policy-parity.js'],
      ['scripts/validate-feed-card-presentation.js'],['scripts/validate-feed.js','feeds/incoming/events.json'],['scripts/validate-feed.js','data/events.json'],
      ['scripts/qa-storyline-spoilers.js','data/events.json']
    ])runStep(step);
    if(!options.localOnly)runStep(['scripts/redeploy-and-release.sh']);
    return;
  }
  if(process.argv.includes('--motogp')){
    for(const step of [
      ['scripts/refresh-motogp-sessions.js'],
      ['scripts/sync-requested-sports-to-feed.js','feeds/incoming/events.json','feeds/incoming/events.json','--motogp-only'],
      ['scripts/sync-requested-sports-to-feed.js','data/events.json','data/events.json','--motogp-only'],
      ['scripts/publish-feed.js','data/events.json','data/events.json','data/feed-meta.json','data/events.js','--preserve-known'],
      ['scripts/build-follow-fixtures.js'],['scripts/build-paged-feed.js'],
      ['scripts/build-code-inspector.js','--codes=motogp,motorsport'],
      ['scripts/build-app-shell-runtime.js'],
      ['scripts/validate-motogp-venue-pilot.js'],['scripts/validate-requested-sports.js'],
      ['scripts/validate-follow-policy-parity.js'],['scripts/validate-feed-card-presentation.js'],
      ['scripts/validate-feed.js','feeds/incoming/events.json'],['scripts/validate-feed.js','data/events.json'],
      ['scripts/qa-storyline-spoilers.js','feeds/incoming/events.json'],['scripts/qa-storyline-spoilers.js','data/events.json']
    ])runStep(step);
    if(!options.localOnly)runStep(['scripts/redeploy-and-release.sh']);
    return;
  }
  if(process.argv.includes('--f1-results')){
    for(const args of [
      ['scripts/validate-f1-session-results.js'],
      ['scripts/refresh-f1-results.js'],
      ['scripts/publish-feed.js','feeds/incoming/events.json','data/events.json','data/feed-meta.json','data/events.js','--preserve-known'],
      ['scripts/build-paged-feed.js'],
      ['scripts/build-code-inspector.js','--codes=f1,motorsport'],
    ])runStep(args);
    if(!options.localOnly)runStep(['scripts/redeploy-and-release.sh']);
    return;
  }
  if(process.argv.includes('--reviewed-fixtures')){
    const baseline=process.argv.find(arg=>arg.startsWith('--restore-published='));
    const ids=process.argv.find(arg=>arg.startsWith('--ids='));
    if(baseline&&!ids)throw new Error('Published editorial repair requires --ids=');
    let codes=[];
    if(baseline){
      const known=new Set(JSON.parse(fs.readFileSync('data/code-inspector/manifest.json')).codes.map(code=>code.slug));
      const events=JSON.parse(fs.readFileSync('data/events.json')).events;
      codes=[...new Set(ids.slice(6).split(',').flatMap(id=>{
        const event=events.find(event=>event.id===id);if(!event)throw new Error('Unknown editorial repair fixture '+id);
        return [event.key,event.sportDomainId?.replace(/^sport:/,'')].filter(code=>known.has(code));
      }))];
      if(!codes.length)throw new Error('Editorial repair requires existing Code projections');
    }
    for(const args of [
      ['scripts/apply-current-card-evidence.js',...(baseline?[baseline,ids]:[])],
      ['scripts/apply-national-team-identities.js','feeds/incoming/events.json'],
      ['scripts/publish-feed.js','feeds/incoming/events.json','data/events.json','data/feed-meta.json','data/events.js','--preserve-known'],
      ['scripts/build-paged-feed.js'],
      ['scripts/build-code-inspector.js',...(baseline?[`--codes=${codes.join(',')}`]:[])],
      ['scripts/build-app-shell-runtime.js'],
      ['scripts/validate-current-evidence-editorial-retention.js'],
      ['scripts/validate-editorial-locks.js','--published'],
      ['scripts/validate-feed.js','data/events.json'],
      ['scripts/qa-storyline-spoilers.js','data/events.json'],
    ]) runStep(args);
    if(!options.localOnly) runStep(['scripts/redeploy-and-release.sh']);
    console.log('Reviewed fixture publication complete; no unrelated source refresh performed.');
    return;
  }
  if(process.argv.includes('--adaptive-editorial')){
    await require('./adaptive-editorial').main(process.argv.slice(2));
    return;
  }
  if(process.argv.includes('--weekend-editorial')){
    require('./weekend-editorial').main(process.argv.slice(2));
    return;
  }
  if(process.argv.includes('--discovery')){
    await require('./refresh-discovery').refreshDiscovery();
    runStep(['scripts/build-athlete-participation.js']);
    runStep(['scripts/build-code-inspector.js']);
    runStep(['scripts/build-tournament-horizon.js']);
    for(const test of ['discovery-evidence','discovery-transport','autonomous-discovery'])runStep([`scripts/validate-${test}.js`]);
    return;
  }
  if(process.argv.includes("--live")){
    const {refreshDueSources}=require("../lib/live-fixtures");
    const {liveSources}=require("../lib/live-source-adapters");
    const result=await refreshDueSources({sources:liveSources()});
    console.log(JSON.stringify({mode:"live",...result}));
    if(result.failed.length)process.exitCode=1;
    return;
  }
  if(process.argv.includes("--tennis-feed")){
    runStep(['scripts/build-code-inspector.js','--codes=tennis']);
    runStep(['scripts/build-follow-directories.js','--codes=tennis']);
    for(const script of ['build-tennis-feed-parents','build-tournament-horizon','build-tennis-journeys','validate-tennis-journeys','build-app-shell-runtime','validate-tennis-feed-normalisation'])runStep([`scripts/${script}.js`]);
    return;
  }
  if(process.argv.includes("--follow-ui")){
    for(const script of ["build-follow-directories","build-code-inspector","build-tournament-horizon","build-tennis-feed-parents","build-app-shell-runtime","validate-curated-follow-directories","validate-live-fixture-api"])runStep([`scripts/${script}.js`]);
    console.log("Follow UI projections rebuilt from retained canonical sources; no source refresh or release performed.");return;
  }
  if(process.argv.includes('--rugby-identities')){
    for(const step of [
      ['scripts/apply-reviewed-fixture-timing.js','--ids=rugby-australia-new-zealand-2026-10-17'],
      ['scripts/publish-feed.js','data/events.json','data/events.json','data/feed-meta.json','data/events.js','--preserve-known'],
      ['scripts/build-follow-fixtures.js'],['scripts/build-paged-feed.js'],['scripts/build-code-inspector.js','--codes=rugby-union'],
      ['scripts/build-app-shell-runtime.js'],['scripts/version-generated-shell.js'],
      ['scripts/validate-bledisloe-reviewed-identity.js','--published'],['scripts/validate-bledisloe-identity-api.js'],['scripts/validate-bledisloe-identity-database.js'],
      ['scripts/validate-rugby-reviewed-identity.js','--published'],['scripts/validate-rugby-identity-api.js'],['scripts/validate-reviewed-au-viewing.js','--published']
    ])runStep(step);
    console.log('Reviewed future Rugby identity/timing rebuilt through canonical owner; no source refresh or database cutover performed.');return;
  }
  if(process.argv.includes('--viewing-reconciliation')){
    for(const step of [
      ['scripts/apply-current-card-evidence.js','--ids=calendar-nothingsport-manual-seed-wsl-margaret-river-pro-2026'],
      ['scripts/publish-feed.js','data/events.json','data/events.json','data/feed-meta.json','data/events.js','--preserve-known'],
      ['scripts/build-follow-fixtures.js'],['scripts/build-paged-feed.js'],['scripts/build-code-inspector.js','--codes=rugby-union,cricket'],
      ['scripts/build-app-shell-runtime.js'],['scripts/version-generated-shell.js'],
      ['scripts/validate-reviewed-au-viewing.js','--published'],['scripts/validate-australian-viewing-rights.js'],['scripts/validate-cricket-viewing.js'],
      ['scripts/validate-seeded-surf-correction.js'],
      ['scripts/validate-feed-follow-repairs.js'],['scripts/validate-current-card-coverage.js']
    ])runStep(step);
    console.log('Reviewed viewing projections rebuilt through canonical owner; sporting sources and their observation times retained.');return;
  }
  if(process.argv.includes('--cricket-identities')){
    runStep(['scripts/build-code-inspector.js','--codes=cricket']);
    runStep(['scripts/validate-cricket-provider-identities.js','--published']);
    runStep(['scripts/build-app-shell-runtime.js']);return;
  }
  if(process.argv.includes('--coverage-live')){
    const snapshot=process.argv.find(arg=>arg.startsWith('--live-coverage-snapshot='));
    const rows=snapshot?JSON.parse(fs.readFileSync(snapshot.slice('--live-coverage-snapshot='.length),'utf8')):undefined;
    const report=await require('./sync-live-coverage').sync({rows});
    if(report.codes.length)runStep(['scripts/build-code-inspector.js',`--codes=${report.codes.join(',')}`]);
    runStep(['scripts/validate-source-coverage.js']);
    console.log(JSON.stringify(report));return;
  }
  if(process.argv.includes("--coverage")){
    const coverageScope=process.argv.find(arg=>arg.startsWith('--coverage-source='));
    if(coverageScope){
      if(!['--coverage-source=cricket-ca-4710','--coverage-source=cricket-ca-current'].includes(coverageScope))throw new Error('Unsupported coverage source');
      const sources=require('../lib/source-coverage').coverageSources().filter(source=>source.id===coverageScope.split('=')[1]);
      await require('./refresh-source-coverage').refreshCoverage({sources,scoped:true});
      runStep(['scripts/build-code-inspector.js','--codes=cricket']);
      runStep(['scripts/validate-source-coverage.js']);
      runStep(['scripts/validate-asia-cup-source.js','--published']);
      return;
    }
    await require("./refresh-source-coverage").refreshCoverage();
    runStep(["scripts/apply-reviewed-fixture-timing.js", "--ids=rugby-australia-new-zealand-2026-10-17"]);
    runStep(["scripts/refresh-us-open-events.js"]);
    runStep(["scripts/refresh-us-open-events.js","--check"]);
    runStep(["scripts/build-athlete-participation.js"]);
    runStep(["scripts/build-code-inspector.js","--codes=cricket,rugby-union,motorsport,f1,tennis"]);
    runStep(["scripts/build-follow-directories.js"]);
    runStep(["scripts/validate-source-coverage.js"]);
    runStep(["scripts/validate-discovery-coverage.js"]);
    runStep(["scripts/validate-discovery-refresh.js"]);
    return;
  }
  const quick=process.argv.includes("--quick");
  let steps = quick ? buildQuickSteps() : buildSteps(options);
  steps=resumeSteps(steps,process.argv);
  const needsFollowSnapshot = steps.some(step => step[0] === "scripts/snapshot-active-follows.js");
  const snapshotDirectory = needsFollowSnapshot ? fs.mkdtempSync(path.join(os.tmpdir(), "nothingsport-follow-snapshot-")) : null;
  if (snapshotDirectory) {
    fs.chmodSync(snapshotDirectory, 0o700);
    process.env.FOLLOW_SNAPSHOT_PATH = path.join(snapshotDirectory, "active-follows.enc.json");
    process.env.FOLLOW_SNAPSHOT_KEY = crypto.randomBytes(32).toString("base64");
  }
  if (options.localOnly) {
    console.log("Local-only update selected: refresh and validation will run without commit, push, or deployment.");
  }
  try {
    for (const args of steps) {
      runStep(args);
    }

    if(quick){console.log("Quick results refresh complete.");return;}
    console.log(`\nCards, ladders and standings update complete${options.localOnly ? " (local only)" : ""}: canonical ranking data refreshed and validated, followed fixtures recomputed from the current server snapshot, curated previews applied, fixture research queued, and both feeds passed editorial, spoiler and schema QA.`);
  } finally {
    delete process.env.FOLLOW_SNAPSHOT_PATH;
    delete process.env.FOLLOW_SNAPSHOT_KEY;
    if (snapshotDirectory) fs.rmSync(snapshotDirectory, { recursive:true, force:true });
  }
}

async function main(){
  const prior=process.env.FOOTBALL_DATA_RUN_DIR;
  const directory=prior||fs.mkdtempSync(path.join(os.tmpdir(),'ns-football-backup-'));
  process.env.FOOTBALL_DATA_RUN_DIR=directory;
  const priorGolf={file:process.env.GOLF_SOURCE_REPORT,runId:process.env.GOLF_SOURCE_RUN_ID};
  process.env.GOLF_SOURCE_REPORT ||= path.join(directory,'golf-source-report.json');
  process.env.GOLF_SOURCE_RUN_ID=crypto.randomUUID();
  try{
    require('../lib/golf-source-observations').create({mode:process.argv.includes('--offline')?'offline':process.argv.includes('--quick')?'quick':'full'}).save();
    if(!process.argv.includes('--offline'))require('./lib/football-data-backup').record({state:'invocation',mode:process.argv.includes('--quick')?'quick':process.argv.includes('--european-football')?'european-football':'full'},{directory});
    return await runMain();
  }finally{
    try{if(!process.argv.includes('--offline')){const file=path.join(directory,'budget.json');require('./lib/football-data-backup').record({state:'budget',calls:fs.existsSync(file)?JSON.parse(fs.readFileSync(file)).calls:0},{directory});}}
    finally{
      if(!prior){fs.rmSync(directory,{recursive:true,force:true});delete process.env.FOOTBALL_DATA_RUN_DIR;}
      for(const [key,value] of [['GOLF_SOURCE_REPORT',priorGolf.file],['GOLF_SOURCE_RUN_ID',priorGolf.runId]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}
    }
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = error.exitCode || 1;
  });
}

module.exports = {
  resumeSteps,
  buildSteps,
  buildQuickSteps,
  discoverCanonicalFixtureBundles,
  parseOptions,
};
