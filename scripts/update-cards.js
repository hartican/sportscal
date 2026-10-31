#!/usr/bin/env node

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
  require('./lib/refresh-report').update({lastStep:command,stage:'refresh'});
  // Canonical standings changed before this first shell-backed validator.
  if(["scripts/validate-country-flags.js","scripts/validate-card-polish.js"].includes(command))runStep(["scripts/build-app-shell-runtime.js"]);
  const isNodeScript = command.endsWith(".js");
  const runner = isNodeScript ? process.execPath : command;
  const commandArgs = isNodeScript ? args : args.slice(1);
  const commandLabel = isNodeScript ? `node ${args.join(" ")}` : args.join(" ");
  const display = commandLabel || command;

  console.log(`\n> ${display}`);
  const env={...process.env};if(/^scripts\/(?:validate-|audit-|qa-|verify-)/.test(command))for(const key of ["FOOTBALL_DATA_API_TOKEN","FOOTBALL_DATA_RUN_DIR","FOOTBALL_DATA_REPORT","GOLF_SOURCE_RUN_ID","GOLF_SOURCE_REPORT","WRC_SOURCE_FAILURE_REPORT"])delete env[key];
  if(/^scripts\/validate-/.test(command))delete env.REFRESH_REPORT;
  const result = require('./lib/refresh-child').run(runner, commandArgs, {env});
  if(result.stderr?.length)process.stderr.write(result.stderr);
  if (result.status !== 0) {
    const error = new Error(`${display} failed with exit code ${result.status || 1}`);
    error.exitCode = result.status || 1;
    error.refreshFailure={step:command,detail:require('./lib/refresh-report').diagnosticTail(result.error?.message||result.stderr?.toString()||error.message)};
    throw error;
  }
}

function parseOptions(argv = process.argv.slice(2), env = process.env) {
  require('./lib/live-coverage-scope').parseArgs(argv);
  if(argv.includes('--source=epl')||argv.some(arg=>arg==='--epl-updated-ids'||arg.startsWith('--epl-updated-ids=')))require('./lib/epl-publication-scope').rebuildOptions(argv);
  const reviewedEditorial = argv.filter(arg => arg.startsWith('--reviewed-editorial='));
  if (reviewedEditorial.length) {
    const allowed = new Set(['--reviewed-fixtures', '--editorial-projections', '--local-only', '-p']);
    const ids = argv.filter(arg => arg.startsWith('--ids='));
    if (reviewedEditorial.length !== 1 || !reviewedEditorial[0].slice(21) || ids.length !== 1 || !ids[0].slice(6) || !argv.includes('--local-only') || !argv.includes('--reviewed-fixtures') || !argv.includes('--editorial-projections') || new Set(argv).size !== argv.length || argv.some(arg => !allowed.has(arg) && !arg.startsWith('--ids=') && !arg.startsWith('--reviewed-editorial='))) throw Error('Reviewed editorial research requires exact IDs, one reviewed input and the local-only reviewed-fixtures/editorial-projections route. No source steps ran.');
    return {localOnly:true, reviewedEditorial:{ids:ids[0].slice(6).split(','), file:reviewedEditorial[0].slice(21)}};
  }
  if(argv.includes('--retained-coverage')){
    const codeArgs=argv.filter(arg=>arg.startsWith('--codes=')),captures=argv.filter(arg=>arg.startsWith('--capture=')),allowed=new Set(['--retained-coverage','--local-only','-p']);
    if(!argv.includes('--local-only')||codeArgs.length!==1||new Set(argv).size!==argv.length||argv.some(arg=>!allowed.has(arg)&&!arg.startsWith('--codes=')&&!arg.startsWith('--capture=')))throw Error('Retained coverage requires only declared codes, optional Football capture and local-only; no source steps ran');
    const codeSlugs=codeArgs[0].slice(8).split(',');
    if(!codeSlugs.length||new Set(codeSlugs).size!==codeSlugs.length||codeSlugs.some(code=>!['football','netball'].includes(code)))throw Error('Retained coverage supports only explicit Football/Netball targets');
    if(env.REFRESH_REPORT)throw Error('Retained coverage cannot inherit REFRESH_REPORT before writes');
    const football=codeSlugs.includes('football');
    if(football?(captures.length!==1||!captures[0].slice(10)):captures.length!==0)throw Error('Retained Football requires one capture; Netball-only accepts no capture');
    const captureFolder=football?path.resolve(captures[0].slice(10)):null;
    if(football){const adapter=require('./lib/australian-championship');adapter.validate(adapter.loadCapture(captureFolder));}
    require('./build-code-inspector').preflightRetainedCoverage();
    if(codeSlugs.includes('netball'))require('./validate-diamonds-retained-schedule').validate();
    return {localOnly:true,retainedCoverage:{codeSlugs,captureFolder}};
  }
  if(argv.includes('--australian-championship')){
    const captures=argv.filter(arg=>arg.startsWith('--capture='));
    const allowed=new Set(['--australian-championship','--local-only','-p']);
    if(!argv.includes('--local-only')||captures.length!==1||!captures[0].slice(10)||new Set(argv).size!==argv.length||argv.some(arg=>!allowed.has(arg)&&!arg.startsWith('--capture=')))throw Error('Australian Championship requires only --australian-championship --capture=<retained-directory> --local-only with optional -p. No writes or source steps ran.');
    if(env.REFRESH_REPORT)throw Error('Australian Championship retained route cannot inherit REFRESH_REPORT. No diagnostic or source writes ran.');
    const captureFolder=path.resolve(captures[0].slice(10));
    const championship=require('./lib/australian-championship');championship.validate(championship.loadCapture(captureFolder));
    require('./build-code-inspector').preflightRetainedFootballOnly();
    return {localOnly:true,australianChampionship:{captureFolder}};
  }
  for (const route of ['--a-league', '--broadcaster-review', '--venue-review', '--nations-finals', '--canonical-readiness']) {
    if (!argv.includes(route)) continue;
    const allowed = new Set([route, '--local-only', '-p']);
    if(route==='--nations-finals')allowed.add('--rebuild');
    if (argv.some(arg => !allowed.has(arg))) throw new Error(`${route === '--broadcaster-review' ? 'Broadcaster' : route==='--nations-finals'?'Nations finals':'Venue'} review cannot be combined with other refresh routes. No source steps ran.`);
  }
  if (argv.includes('--editorial-projections')) {
    const allowed = new Set(['--reviewed-fixtures','--editorial-projections','--local-only','-p','--rebuild']);
    if (!argv.includes('--reviewed-fixtures') || argv.filter(arg=>arg.startsWith('--ids=')).length!==1 || argv.some(arg=>!allowed.has(arg)&&!arg.startsWith('--ids='))) throw new Error('Editorial projection repair requires only --reviewed-fixtures --editorial-projections --ids= with optional local-only/rebuild flags. No source steps ran.');
  }
  if (argv.includes('--result-observations') && (!argv.includes('--reviewed-fixtures') || !argv.some(arg=>arg.startsWith('--ids=')) || argv.some(arg=>arg.startsWith('--restore-published=')))) {
    throw new Error('Result observations require --reviewed-fixtures with retained --ids= and no editorial restoration. No source steps ran.');
  }
  const liveScopes=argv.filter(arg=>arg==='--live-source'||arg.startsWith('--live-source='));
  if(liveScopes.length){
    const supported=new Set(['--live-source=tennis','--live-source=cricket-ca-current']);
    const allowed=new Set(['--live','--local-only','-p',...supported]);
    if(!argv.includes('--live')||liveScopes.length!==1||!supported.has(liveScopes[0])||new Set(argv).size!==argv.length||argv.some(arg=>!allowed.has(arg)))throw Error('Scoped live refresh requires only --live with --live-source=tennis or --live-source=cricket-ca-current and optional -p/--local-only. No source steps ran.');
  }
  if (argv.includes("--offline")) {
    const quickOfflineArgs = new Set(["--offline", "--quick", "--rebuild", "--local-only", "-p"]);
    if (!argv.includes("--quick") || argv.some(arg => !quickOfflineArgs.has(arg))) {
      throw new Error("Only the quick refresh supports --offline. Use --quick --offline without a scoped, resumed or other route. No source steps ran.");
    }
  }
  if(argv.includes('--f1-results')){const allowed=new Set(['--f1-results','--local-only','-p']);if(new Set(argv).size!==argv.length||argv.filter(arg=>arg==='--local-only'||arg==='-p').length>1||argv.some(arg=>!allowed.has(arg)))throw Error('F1 results cannot be combined with offline or other routes; use only the existing F1 route and optional local-only flag. No source steps ran.');}
  return {
    localOnly: argv.includes("--local-only") || argv.includes("-p") || env.SKIP_RELEASE === "1",
  };
}

function buildQuickSteps(argv = process.argv.slice(2)) {
  return [["scripts/validate-fixture-history-retention.js"], ["scripts/quick-results.js", ...argv.filter(arg => ["--offline", "--rebuild"].includes(arg))]];
}

function buildBroadcasterReviewSteps() {
  return [
    ['scripts/scan-broadcaster-coverage.js', '--enforce-freshness'],
    ['scripts/scan-broadcaster-coverage.js', '--check', '--enforce-freshness'],
    ['scripts/validate-broadcaster-discovery.js'],
    ['scripts/build-discovery-dashboard.js'],
    ['scripts/build-discovery-dashboard.js','--check'],
    ['scripts/validate-discovery-measurement.js'],
  ];
}

function buildVenueReviewSteps() {
  return [
    ['scripts/build-app-shell-runtime.js'],
    ['scripts/version-generated-shell.js'],
    ['scripts/build-app-shell-runtime.js', '--check'],
    ['scripts/validate-source-and-venues.js'],
    ['scripts/validate-feed-performance.js'],
    ['scripts/validate-startup-budget.js'],
  ];
}

function buildSteps({ localOnly = false } = {}) {
  const steps = [
  ...((process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.FOLLOW_SNAPSHOT_PRELOADED_JSON_PATH || process.env.FOLLOW_SNAPSHOT_PRELOADED_PATH)
    ? [["scripts/snapshot-active-follows.js"]]
    : []),
  // Catch a broken card-action contract before paying for a provider pass;
  // retain its existing post-projection check against the generated output.
  ["scripts/validate-card-dismissal-learning.js"],
  ["scripts/validate-editorial-projection-identity.js"],
  ["scripts/refresh-pga-schedule.js"],
  ["scripts/refresh-source-coverage.js"],
  ["scripts/apply-reviewed-fixture-timing.js", "--ids=rugby-australia-new-zealand-2026-10-17"],
  ["scripts/refresh-openligadb-football.js"],
  ["scripts/validate-european-football-continuity.js"],
  ["scripts/validate-football-data-backup.js"],
  ["scripts/validate-epl-provider-identities.js"],
  ["scripts/validate-epl-provider-persistence.js"],
  ["scripts/validate-epl-identity-api.js"],
  ["scripts/validate-epl-local-ratings.js"],
  ["scripts/validate-epl-identity-database.js"],
  ["scripts/validate-feed-card-presentation.js"],
  ["scripts/refresh-discovery.js"],
  ["scripts/build-athlete-participation.js"],
  ["scripts/refresh-canonical-sports.js"],
  ["scripts/apply-current-card-evidence.js"],
  ["scripts/refresh-known-final-results.js", "--nrl-only"],
  ["scripts/validate-wrc-source-boundary.js"],
  ["scripts/refresh-wrc-context.js"],
  ["scripts/refresh-wrc-context.js", "--check"],
  ["scripts/validate-wrc-context.js"],
  ["scripts/refresh-premier-league-context.js"],
  ["scripts/refresh-premier-league-context.js", "--check"],
  ["scripts/validate-premier-league-context.js"],
  ["scripts/migrate-competition-codes.js"],
  ["scripts/refresh-major-events-from-canonical.js"],
  ["scripts/apply-reviewed-nations-finals.js"],
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
  ["scripts/apply-reviewed-participant-fixtures.js"],
  ["scripts/refresh-tennis-scoreboard.js"],
  ["scripts/validate-tennis-scoreboard.js"],
  ["scripts/validate-country-flags.js"],
  ["scripts/validate-national-team-identities.js", "--assets-only"],
  ["scripts/refresh-football-directory.js", "--refresh-due"],
  ["scripts/refresh-football-directory.js", "--refresh-a-league"],
  ["scripts/refresh-football-directory.js", "--prune-removed"],
  ["scripts/refresh-football-directory.js", "--check"],
  ["scripts/validate-football-directory.js"],
  ["scripts/validate-release-maintenance.js"],
  ["scripts/build-team-player-directories.js"],
  ["scripts/build-team-player-directories.js", "--check"],
  ["scripts/validate-team-player-directories.js"],
  ["scripts/refresh-f1-standings.js"],
  ["scripts/refresh-f1-sessions.js"],
  ["scripts/refresh-motogp-sessions.js"],
  ["scripts/refresh-sailgp-calendar.js"],
  ["scripts/refresh-wsl-calendar.js"],
  ["scripts/refresh-grand-tour-calendars.js"],
  ["scripts/refresh-lemans-calendar.js"],
  ["scripts/refresh-dakar-calendars.js"],
  ["scripts/refresh-golf-major-calendars.js"],
  ["scripts/update-cards.js", "--horse-fields-only", "--local-only"],
  ["scripts/refresh-nbl-schedule.js"],
  ["scripts/refresh-athlete-profiles.js"],
  ["scripts/refresh-athlete-profiles.js", "--check"],
  ["scripts/validate-athlete-profiles.js"],
  ["scripts/refresh-nfl-ice-hockey.js"],
  ["scripts/refresh-mlb-postseason.js"],
  ["scripts/validate-mlb-postseason.js"],
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
  ["scripts/epic-editorial.js", "--apply"],
  ["scripts/build-epic-ui.js"],
  // The existing cold pin bootstrap depends on the just-published projection.
  // Refresh its owning bundle before offline/readiness validators consume it.
  ["scripts/build-app-shell-runtime.js"],
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
  ["scripts/lib/f1-source-provenance.js"],
  ["scripts/lib/skiing-calendar-review.js"],
  ["scripts/lib/reviewed-calendar-notes.js"],
  ["scripts/refresh-fixture-highlights.js"],
  ["scripts/epic-editorial.js", "--apply"],
  ["scripts/reconcile-fixture-results.js"],
  ["scripts/publish-feed.js", "feeds/incoming/events.json", "data/events.json", "data/feed-meta.json", "data/events.js", "--preserve-known"],
  ["scripts/apply-representative-metadata.js", "data/events.json", "data/events.js"],
  ["scripts/apply-national-team-identities.js", "data/events.json", "data/events.js"],
  ["scripts/sync-finals-code-phase.js"],
  ["scripts/sync-finals-code-phase.js", "--check"],
  ["scripts/apply-coverage-pauses.js"],
  ["scripts/validate-editorial-locks.js", "--published"],
  ["scripts/validate-card-coverage-corrections.js"],
  ["scripts/build-tennis-feed-parents.js"],
  ["scripts/build-app-shell-runtime.js"],
  ["scripts/validate-editorial-narratives.js"],
  ["scripts/validate-cricket-editorial-policy.js"],
  ["scripts/validate-cricket-editorial-inventory.js"],
  ["scripts/build-app-shell-runtime.js", "--check"],
  ["scripts/validate-sport-hierarchy.js"],
  ["scripts/validate-ui-reliability.js"],
  ["scripts/validate-startup-late-recovery.js"],
  ["scripts/validate-submission-state.js"],
  ["scripts/validate-nsc-client-flow.js"],
  ["scripts/validate-peer-results.js"],
  ["scripts/validate-requested-sport-editorial.js"],
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
  ["scripts/build-follow-directories.js"],
  ["scripts/build-follow-directories.js", "--check"],
  ["scripts/validate-football-classification.js","--published"],
  ["scripts/build-tennis-feed-parents.js"],
  ["scripts/build-tournament-horizon.js"],
  ["scripts/validate-feed-follow-repairs.js"],
  ["scripts/validate-experience-reliability.js"],
  ["scripts/validate-golf-source-observations.js"],
  ["scripts/validate-golf-tracked-scope.js"],
  ["scripts/validate-tennis-repair.js"],
  ["scripts/validate-football-round-repair.js"],
  ["scripts/validate-shallow-player-background.js"],
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
  ["scripts/validate-fixture-highlights.js"],
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
  ["scripts/validate-lemans-calendar.js", "--published"],
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
  ["scripts/validate-fixture-result-reconciliation.js"],
  ["scripts/validate-deployment-tracking.js"],
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
  ["scripts/validate-impact-feedback.js"],
  ["scripts/validate-impact-dispatch.js"],
  ["scripts/validate-reminder-dispatch-capacity.js"],
  ["scripts/validate-impact-inbox.js"],
  ["scripts/validate-accepted-result-projection.js"],
  ["scripts/validate-accepted-result-continuity.js"],
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
  ["scripts/validate-clean-feed-viewing.js"],
  ["scripts/validate-reviewed-au-viewing-api.js"],
  ["scripts/validate-seeded-surf-correction.js"],
  ["scripts/validate-cricket-viewing.js"],
  ["scripts/validate-feed-ui-geometry.js"],
  ["scripts/validate-follow-first.js"],
  ["scripts/validate-follow-policy-parity.js"],
  ["scripts/validate-follow-decisions.js"],
  ["scripts/validate-epic-classics.js"],
  ["scripts/validate-epic-api.js"],
  ["scripts/validate-year-review-alerts.js"],
  ["scripts/build-epic-ui.js", "--check"],
  ["scripts/validate-follow-with-confidence.js"],
  ["scripts/validate-ratings-recovery.js"],
  ["scripts/validate-cricket-coverage.js"],
  ["scripts/validate-asia-cup-source.js", "--published"],
  ["scripts/validate-cricket-current-results.js"],
  ["scripts/validate-cricket-provider-identities.js", "--published"],
  ["scripts/validate-coverage-repair.js"],
  ["scripts/validate-card-timing.js"],
  ["scripts/validate-football-status-display.js"],
  ["scripts/validate-nbl-match-context.js", "--published"],
  ["scripts/validate-match-centre.js"],
  ["scripts/validate-current-score-placement.js"],
  ["scripts/validate-full-scorecards.js"],
  ["scripts/validate-event-overviews.js"],
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
  ["scripts/validate-completed-source-recovery.js"],
  ["scripts/validate-profile-fixture-scope.js"],
  ["scripts/validate-canonical-context-batch.js"],
  ["scripts/validate-fixture-history-retention.js"],
  ["scripts/validate-global-read-budget.js"],
  ["scripts/validate-snapshot-read-diagnostics.js"],
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

async function runMain({f1StartedAt=require('node:perf_hooks').performance.now()}={}) {
  const options = parseOptions();
  if (options.reviewedEditorial) {
    const {ids, file} = options.reviewedEditorial;
    console.log(JSON.stringify(require('./lib/reviewed-editorial-research').applyScopedResearch(ids, file)));
    console.log('Reviewed source and selected copy staged locally; use the existing scoped editorial projection rebuild before release. No source requests or derived publication.');
    return;
  }
  const retained=options.retainedCoverage||(options.australianChampionship?{codeSlugs:['football'],...options.australianChampionship}:null);
  if(retained){
    const {codeSlugs,captureFolder}=retained,codes=codeSlugs.join(',');
    if(codeSlugs.includes('football')){console.log(JSON.stringify(require('./lib/australian-championship').apply({captureFolder})));runStep(['scripts/refresh-football-directory.js','--check']);}
    runStep(['scripts/build-code-inspector.js','--codes='+codes,options.australianChampionship?'--retained-football-only':'--retained-codes='+codes]);
    for(const args of [['scripts/build-follow-directories.js','--codes='+codes],['scripts/build-follow-directories.js','--codes='+codes,'--check']])runStep(args);
    if(codeSlugs.includes('football'))for(const name of ['validate-australian-championship','validate-australian-championship-integration'])runStep(['scripts/'+name+'.js']);
    if(codeSlugs.includes('netball'))runStep(['scripts/validate-diamonds-retained-schedule.js']);
    console.log('Declared retained coverage projected locally; no source, shell, account, database or publication operation.');return;
  }
  if(process.argv.includes('--a-league')){
    const result=await require('./lib/a-league-schedule').refresh();console.log(JSON.stringify(result));
    if(result.state==='deferred-retained')throw Error(result.error+'; retained last-good A-League schedule.');
    for(const args of [
      ['scripts/refresh-football-directory.js','--check'],
      ['scripts/build-code-inspector.js','--codes=football'],
      ['scripts/build-follow-directories.js','--codes=football'],
      ['scripts/build-follow-directories.js','--codes=football','--check'],
      ['scripts/build-app-shell-runtime.js'],['scripts/version-generated-shell.js'],
      ['scripts/validate-a-league-schedule.js'],['scripts/validate-fixtures-contract.js'],
      ['scripts/validate-follow-decisions.js'],['scripts/validate-follow-policy-parity.js'],
      ['scripts/validate-backend-efficiency.js'],['scripts/validate-feed-performance.js']
    ])runStep(args);
    if(!options.localOnly)runStep(['scripts/redeploy-and-release.sh']);
    return;
  }
  if(process.argv.includes('--nations-finals')){
    const result=require('./apply-reviewed-nations-finals').publish();console.log(JSON.stringify(result));
    if(!result.changed&&!process.argv.includes('--rebuild')){console.log('Nations finals unchanged; no publication or source check.');return;}
    for(const args of [
      ['scripts/build-code-inspector.js','--codes=rugby-union'],
      ['scripts/validate-major-events.js'],
      ['scripts/validate-follow-policy-parity.js'],['scripts/validate-fixture-timing.js']
    ])runStep(args);
    if(!options.localOnly)runStep(['scripts/redeploy-and-release.sh']);
    console.log('Six existing Rugby final times published through canonical owner; no provider requests.');return;
  }
  if (process.argv.includes('--venue-review')) {
    for (const args of buildVenueReviewSteps()) runStep(args);
    if (!options.localOnly) runStep(['scripts/redeploy-and-release.sh']);
    console.log('Venue review completed through the canonical owner; fixture facts and provider requests unchanged.');
    return;
  }
  if (process.argv.includes('--broadcaster-review')) {
    for (const args of buildBroadcasterReviewSteps()) runStep(args);
    if (!options.localOnly) runStep(['scripts/redeploy-and-release.sh']);
    console.log('Reviewed viewing evidence updated through the canonical owner; no provider requests or fixture changes.');
    return;
  }
  if(process.argv.includes('--canonical-readiness')){
    for(const args of [['scripts/refresh-canonical-sports.js'],['scripts/build-app-shell-runtime.js'],['scripts/version-generated-shell.js'],['scripts/validate-canonical-sports.js'],['scripts/verify-pilot-readiness.js']])runStep(args);
    if(!options.localOnly)runStep(['scripts/redeploy-and-release.sh']);
    console.log('Existing AFL/NRL fixture and standings owner checked readiness; no other source refresh ran.');
    return;
  }
  if(process.argv.includes('--calendar-notes')||process.argv.includes('--surf-calendar-notes')){
    const notes=require('./lib/reviewed-calendar-notes'),surfOnly=!process.argv.includes('--calendar-notes');
    const repaired=notes.applyRetained({selectedIds:surfOnly?notes.surfIds:notes.ids});console.log(JSON.stringify(repaired));
    if(!repaired.some(surface=>surface.changed.length)&&!process.argv.includes('--rebuild')){console.log('Calendar notes unchanged; no publication or source check.');return;}
    for(const args of [
      ['scripts/publish-feed.js','data/events.json','data/events.json','data/feed-meta.json','data/events.js','--preserve-known'],
      ['scripts/build-follow-fixtures.js'],['scripts/build-paged-feed.js'],
      ['scripts/build-code-inspector.js',surfOnly?'--codes=surf':'--codes=surf,motorsport,rugby-union'],['scripts/build-app-shell-runtime.js'],['scripts/version-generated-shell.js'],
      ['scripts/validate-surf-calendar-notes.js'],['scripts/validate-feed.js','feeds/incoming/events.json'],['scripts/validate-feed.js','data/events.json'],['scripts/validate-follow-policy-parity.js'],['scripts/validate-startup-budget.js']
    ])runStep(args);
    if(!options.localOnly)runStep(['scripts/redeploy-and-release.sh']);
    console.log('Reviewed retained calendar notes corrected through canonical owner; no provider request.');return;
  }
  if(process.argv.includes('--canonical-family-repair')){
    console.log(JSON.stringify(require('./lib/canonical-family-repair').apply()));
    for(const args of [
      ['scripts/build-app-shell-runtime.js'],['scripts/version-generated-shell.js'],
      ['scripts/validate-canonical-sports.js'],['scripts/validate-canonical-family-repair.js'],
      ['scripts/validate-startup-budget.js']
    ])runStep(args);
    if(!options.localOnly)runStep(['scripts/redeploy-and-release.sh']);
    console.log('Existing canonical family references repaired; fixture facts and source clocks unchanged, no provider requests.');return;
  }
  if(process.argv.includes('--skiing-calendar-review')){
    console.log(JSON.stringify(require('./lib/skiing-calendar-review').applyRetained()));
    for(const args of [
      ['scripts/publish-feed.js','data/events.json','data/events.json','data/feed-meta.json','data/events.js','--preserve-known'],
      ['scripts/build-follow-fixtures.js'],['scripts/build-paged-feed.js'],
      ['scripts/build-code-inspector.js','--codes=skiing'],['scripts/build-app-shell-runtime.js'],['scripts/version-generated-shell.js'],
      ['scripts/validate-skiing-calendar-review.js'],['scripts/validate-follow-policy-parity.js'],
      ['scripts/validate-feed.js','feeds/incoming/events.json'],['scripts/validate-feed.js','data/events.json'],['scripts/qa-storyline-spoilers.js','data/events.json'],['scripts/validate-startup-budget.js']
    ])runStep(args);
    if(!options.localOnly)runStep(['scripts/redeploy-and-release.sh']);
    console.log('Four reviewed Skiing calendar cards projected by the canonical owner; no provider requests.');return;
  }
  if(process.argv.includes('--f1-provenance-review')){
    const repaired=require('./lib/f1-source-provenance').applyRetained();
    console.log(JSON.stringify(repaired));
    if(!repaired.some(surface=>surface.changed.length)){
      console.log('F1 source tuples are unchanged; retained publication and fact dates preserved.');return;
    }
    for(const args of [
      ['scripts/publish-feed.js','data/events.json','data/events.json','data/feed-meta.json','data/events.js','--preserve-known'],
      ['scripts/build-follow-fixtures.js'],['scripts/build-paged-feed.js'],
      ['scripts/build-code-inspector.js','--codes=f1,motorsport'],['scripts/build-app-shell-runtime.js'],['scripts/version-generated-shell.js'],
      ['scripts/validate-f1-source-provenance.js'],['scripts/validate-follow-policy-parity.js'],
      ['scripts/validate-feed.js','feeds/incoming/events.json'],['scripts/validate-feed.js','data/events.json'],['scripts/qa-storyline-spoilers.js','data/events.json'],['scripts/validate-startup-budget.js']
    ])runStep(args);
    if(!options.localOnly)runStep(['scripts/redeploy-and-release.sh']);
    console.log('Retained F1 fixture source observations restored by the canonical owner; no provider requests.');return;
  }
  if(process.argv.includes('--epl-timing-review')){
    console.log(JSON.stringify(require('./lib/epl-kickoff-certainty').applyRetained()));
    for(const args of [
      ['scripts/publish-feed.js','data/events.json','data/events.json','data/feed-meta.json','data/events.js','--preserve-known'],
      ['scripts/build-follow-fixtures.js'],['scripts/build-paged-feed.js'],
      ['scripts/build-code-inspector.js','--codes=football'],['scripts/build-app-shell-runtime.js'],
      ['scripts/validate-football-schedule.js'],['scripts/validate-follow-policy-parity.js'],
      ['scripts/validate-feed.js','data/events.json'],['scripts/validate-startup-budget.js'],
    ])runStep(args);
    console.log('Reviewed EPL scheduling certainty projected by the canonical owner; no provider refresh performed.');return;
  }
  if(process.argv.includes('--european-football')){
    const result=await require('./refresh-openligadb-football').refresh();
    console.log(JSON.stringify({source:'OpenLigaDB',fixtures:result.payload.events.length,failures:result.failures,primaryFailures:result.primaryFailures}));
    for(const args of [['scripts/build-code-inspector.js','--codes=football,champions-league'],['scripts/build-follow-directories.js','--codes=football'],['scripts/validate-openligadb-football.js'],['scripts/validate-european-football-continuity.js'],['scripts/validate-european-football-standings.js']])runStep(args);
    if(result.failures.length)process.exitCode=1;
    return;
  }
  if(process.argv.some(arg=>arg.startsWith('--source='))){
    const sources=process.argv.filter(arg=>arg.startsWith('--source='));
    if(sources.length!==1||!['--source=live-coverage','--source=mlb','--source=nbl','--source=football','--source=epl','--source=nfl-standings','--source=nfl','--source=chl','--source=nhl','--source=known-finals'].includes(sources[0])||!process.argv.includes('--quick')||process.argv.includes('--offline'))throw new Error('Scoped refresh requires --quick with a reviewed shared coverage/NBL/EPL/Football/NFL/CHL/NHL/known-finals source and live source access');
    const coverageSport=require('./lib/live-coverage-scope').parseArgs(process.argv.slice(2));
    const eplRebuild=sources[0]==='--source=epl'&&process.argv.includes('--rebuild');
    runStep(['scripts/quick-results.js',sources[0],...(coverageSport?['--coverage-sport='+coverageSport]:[]),...(eplRebuild?['--rebuild','--local-only',process.argv.find(arg=>arg.startsWith('--epl-updated-ids='))]:[])]);
    return;
  }
  if(process.argv.includes('--aflw-final-date')){
    for(const args of [
      ['scripts/apply-reviewed-aflw-final-date.js'],
      ['scripts/build-canonical-context-bundle.js'],
      ['scripts/build-code-inspector.js','--codes=aflw'],
      ['scripts/build-app-shell-runtime.js'],
      ['scripts/version-generated-shell.js'],
      ['scripts/validate-aflw-final-date.js','--published'],
      ['scripts/validate-canonical-sports.js'],
    ])runStep(args);
    console.log('Existing AFLW final date projected through the canonical owner; no clock, finalist or provider refresh added.');return;
  }
  if(process.argv.includes('--highlights')){
    const allowed=new Set(['--highlights','--local-only','-p']);
    if(process.argv.slice(2).some(arg=>!allowed.has(arg)))throw Error('Highlights refresh cannot be combined with another route');
    const result=await require('./refresh-fixture-highlights').refresh();console.log(JSON.stringify(result));
    if(!result.changed&&!result.stanChanged){runStep(['scripts/build-app-shell-runtime.js']);runStep(['scripts/version-generated-shell.js']);runStep(['scripts/validate-fixture-highlights.js']);if(!options.localOnly)runStep(['scripts/redeploy-and-release.sh']);return;}
    if(result.stanChanged)runStep(['scripts/publish-feed.js','data/events.json','data/events.json','data/feed-meta.json','data/events.js','--preserve-known']);
    for(const step of [
      ['scripts/build-code-inspector.js',result.stanChanged?'--codes=tennis,football,champions-league':'--codes=tennis'],['scripts/build-follow-fixtures.js'],['scripts/build-paged-feed.js'],
      ['scripts/build-tennis-feed-parents.js'],['scripts/build-app-shell-runtime.js'],['scripts/version-generated-shell.js'],
      ['scripts/validate-fixture-highlights.js'],['scripts/validate-feed.js','data/events.json']
    ])runStep(step);
    if(!options.localOnly)runStep(['scripts/redeploy-and-release.sh']);return;
  }
  if(process.argv.includes('--shallow-directories')){
    runStep(['scripts/prune-retained-player-background.js']);
    runStep(['scripts/build-follow-directories.js','--codes=football,afl,aflw']);
    runStep(['scripts/validate-football-directory.js']);
    runStep(['scripts/validate-team-player-directories.js']);
    runStep(['scripts/validate-follow-directories.js']);
    return;
  }
  if(process.argv.includes('--code-projections')){
    const scope=process.argv.find(arg=>arg.startsWith('--codes='));
    if(!scope||!scope.slice(8).split(',').every(slug=>/^[a-z][a-z0-9-]*$/.test(slug)))throw new Error('--code-projections requires --codes=<existing slug,...>');
    const known=new Set(require('../data/code-inspector/manifest.json').codes.map(code=>code.slug));
    if(scope.slice(8).split(',').some(slug=>!known.has(slug)))throw new Error('Unknown Code projection slug');
    runStep(['scripts/build-code-inspector.js',scope]);
    runStep(['scripts/validate-football-classification.js','--published']);
    if(scope.slice(8).split(',').includes('champions-league'))runStep(['scripts/validate-ucl-stage-calendar.js','--published']);
    console.log('Selected Code projections rebuilt from existing canonical data; no source or standings refresh.');
    return;
  }
  if(process.argv.includes('--nrlw-ladder')){
    // A reviewed final regular-season table, not another source poll or scheduler.
    require('./lib/nrlw-ladder-review').readLadderReview();
    for(const args of [
      ['scripts/build-canonical-context-bundle.js'],
      ['scripts/build-code-inspector.js','--codes=nrlw'],
      ['scripts/build-app-shell-runtime.js'],
      ['scripts/validate-nrlw-ladder.js'],
    ])runStep(args);
    if(!options.localOnly)runStep(['scripts/redeploy-and-release.sh']);
    return;
  }
  if(process.argv.includes('--programme-reconciliation')||process.argv.includes('--tennis-quality')){
    for(const args of [
      ['scripts/refresh-tennis-catalogue.js'],
      ['scripts/build-code-inspector.js','--codes=nrl,tennis'],
      ['scripts/build-tennis-feed-parents.js'],
      ['scripts/build-tournament-horizon.js'],['scripts/build-tennis-journeys.js'],['scripts/build-app-shell-runtime.js'],['scripts/version-generated-shell.js'],
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
  if(process.argv.includes('--golf-scorecards')){
    await require('./refresh-pga-schedule').refreshCurrentScorecard();
    const review=require('./lib/golf-retained-review').apply();
    for(const step of [
      ...(review.feedChanged?[['scripts/publish-feed.js','data/events.json','data/events.json','data/feed-meta.json','data/events.js','--preserve-known'],['scripts/build-follow-fixtures.js'],['scripts/build-paged-feed.js']]:[]),
      ['scripts/build-code-inspector.js','--codes=golf'],['scripts/build-follow-directories.js','--codes=golf,golf-women'],['scripts/build-tournament-horizon.js'],['scripts/validate-tournament-hydration.js'],['scripts/validate-full-scorecards.js']
    ])runStep(step);
    if(!options.localOnly)runStep(['scripts/redeploy-and-release.sh']);return;
  }
  if(process.argv.includes('--golf-quality')){
    const review=require('./lib/golf-retained-review').apply();
    for(const step of [
      ...(review.feedChanged?[['scripts/publish-feed.js','data/events.json','data/events.json','data/feed-meta.json','data/events.js','--preserve-known'],['scripts/build-follow-fixtures.js'],['scripts/build-paged-feed.js']]:[]),
      ['scripts/build-code-inspector.js','--codes=golf'],['scripts/build-follow-directories.js','--codes=golf,golf-women,tennis,tennis-women'],['scripts/build-tournament-horizon.js'],
      ['scripts/build-app-shell-runtime.js'],['scripts/version-generated-shell.js'],
      ['scripts/validate-reviewed-au-viewing.js','--published'],
      ['scripts/validate-tournament-hydration.js'],['scripts/validate-canonical-source-readout.js'],
      ['scripts/validate-lpga-results.js'],['scripts/validate-experience-reliability.js'],
      ['scripts/validate-golf-source-observations.js']
    ])runStep(step);
    console.log('Golf quality projections rebuilt through canonical owner from retained facts; no sporting source refresh, scheduler or release performed.');return;
  }
  if(process.argv.includes('--lemans-venues')){
    for(const step of [["scripts/refresh-lemans-calendar.js"], ["scripts/sync-requested-sports-to-feed.js", "feeds/incoming/events.json", "feeds/incoming/events.json", "--lemans-only"], ["scripts/sync-requested-sports-to-feed.js", "data/events.json", "data/events.json", "--lemans-only"], ["scripts/apply-reviewed-wrc-withdrawal.js"], ["scripts/publish-feed.js", "data/events.json", "data/events.json", "data/feed-meta.json", "data/events.js", "--preserve-known"], ["scripts/build-follow-fixtures.js"], ["scripts/build-paged-feed.js"], ["scripts/build-code-inspector.js", "--codes=lemans,motorsport,wrc"], ["scripts/build-app-shell-runtime.js"], ["scripts/validate-lemans-calendar.js", "--published"], ["scripts/validate-follow-policy-parity.js"], ["scripts/validate-feed.js", "feeds/incoming/events.json"], ["scripts/validate-feed.js", "data/events.json"], ["scripts/qa-storyline-spoilers.js", "data/events.json"]])runStep(step);
    if(!options.localOnly)runStep(['scripts/redeploy-and-release.sh']);
    console.log('Published Le Mans programme and reviewed WRC withdrawal complete through canonical owner.');return;
  }
  if(process.argv.includes('--dakar-venues')){
    for(const step of [["scripts/refresh-dakar-calendars.js"], ["scripts/sync-requested-sports-to-feed.js", "feeds/incoming/events.json", "feeds/incoming/events.json", "--dakar-only"], ["scripts/sync-requested-sports-to-feed.js", "data/events.json", "data/events.json", "--dakar-only"], ["scripts/publish-feed.js", "data/events.json", "data/events.json", "data/feed-meta.json", "data/events.js", "--preserve-known"], ["scripts/build-follow-fixtures.js"], ["scripts/build-paged-feed.js"], ["scripts/build-code-inspector.js", "--codes=dakar,motorsport"], ["scripts/build-app-shell-runtime.js"], ["scripts/validate-dakar-calendars.js", "--published"], ["scripts/validate-follow-policy-parity.js"], ["scripts/validate-feed.js", "feeds/incoming/events.json"], ["scripts/validate-feed.js", "data/events.json"], ["scripts/qa-storyline-spoilers.js", "data/events.json"]])runStep(step);
    return;
  }
  if(process.argv.includes('--golf-major-venues')){
    for(const step of [["scripts/refresh-golf-major-calendars.js"], ["scripts/sync-requested-sports-to-feed.js", "feeds/incoming/events.json", "feeds/incoming/events.json", "--golf-majors-only"], ["scripts/sync-requested-sports-to-feed.js", "data/events.json", "data/events.json", "--golf-majors-only"], ["scripts/publish-feed.js", "data/events.json", "data/events.json", "data/feed-meta.json", "data/events.js", "--preserve-known"], ["scripts/build-follow-fixtures.js"], ["scripts/build-paged-feed.js"], ["scripts/build-code-inspector.js", "--codes=golf"], ["scripts/build-app-shell-runtime.js"], ["scripts/validate-golf-major-calendars.js", "--published"], ["scripts/validate-follow-policy-parity.js"], ["scripts/validate-feed.js", "feeds/incoming/events.json"], ["scripts/validate-feed.js", "data/events.json"], ["scripts/qa-storyline-spoilers.js", "data/events.json"]])runStep(step);
    console.log('Reviewed men’s major rounds and venue publication complete through the canonical owner.');return;
  }
  if(process.argv.includes('--horse-fields-only')||process.argv.includes('--horse-presentation-only')){
    console.log(JSON.stringify(await require('./refresh-horse-racing').refresh({presentationOnly:process.argv.includes('--horse-presentation-only')})));
    for(const step of [["scripts/sync-requested-sports-to-feed.js", "feeds/incoming/events.json", "feeds/incoming/events.json", "--horse-racing-only"], ["scripts/sync-requested-sports-to-feed.js", "data/events.json", "data/events.json", "--horse-racing-only"], ["scripts/apply-fixture-research.js", "--horse-only"], ["scripts/publish-feed.js", "data/events.json", "data/events.json", "data/feed-meta.json", "data/events.js", "--preserve-known"], ["scripts/build-follow-fixtures.js"], ["scripts/build-paged-feed.js"], ["scripts/build-code-inspector.js", "--codes=horse-racing"], ["scripts/build-fantasy-ui.js"], ["scripts/build-app-shell-runtime.js"], ["scripts/version-generated-shell.js"], ["scripts/validate-horse-racing.js"], ["scripts/validate-follow-policy-parity.js"], ["scripts/validate-feed.js", "data/events.json"]])runStep(step);
    if(!options.localOnly)runStep(['scripts/redeploy-and-release.sh']);return;
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
      ['scripts/build-code-inspector.js','--codes=wrc,motorsport'],
      ['scripts/build-follow-directories.js','--codes=wrc,motorsport'],['scripts/build-follow-directories.js','--check'],
      ['scripts/build-canonical-context-bundle.js'],['scripts/build-canonical-context-bundle.js','--check'],['scripts/build-app-shell-runtime.js'],
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
      ['scripts/build-follow-fixtures.js'],['scripts/build-follow-directories.js'],['scripts/build-follow-directories.js','--check'],['scripts/build-paged-feed.js'],
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
    const report=await require('./quick-results').refreshF1Results({began:f1StartedAt});
    console.log(JSON.stringify(report));
    if(!options.localOnly)runStep(['scripts/redeploy-and-release.sh']);
    return;
  }
  if(process.argv.includes('--reviewed-fixtures')){
    const baseline=process.argv.find(arg=>arg.startsWith('--restore-published='));
    const ids=process.argv.find(arg=>arg.startsWith('--ids='));
    if(baseline&&!ids)throw new Error('Published editorial repair requires --ids=');
    const scoped=Boolean(ids);
    const resultObservations=process.argv.includes('--result-observations');
    const editorialProjections=process.argv.includes('--editorial-projections');
    if(resultObservations && (!ids || baseline))throw new Error('Result observations require retained --ids= without editorial restoration');
    let codes=[];
    if(scoped){
      const manifest=JSON.parse(fs.readFileSync('data/code-inspector/manifest.json'));
      const events=JSON.parse(fs.readFileSync('data/events.json')).events;
      codes=require('./lib/reviewed-fixture-projection-codes').codesForReviewedFixtures(events,ids.slice(6).split(','),manifest,file=>JSON.parse(fs.readFileSync(file)));
    }
    if(editorialProjections){
      const repaired=require('./apply-editorial-narratives').applyScopedFeed(ids.slice(6).split(','));
      console.log(JSON.stringify(repaired));
      if(!repaired.changed&&!process.argv.includes('--rebuild')){console.log('Declared editorial projections already agree; no publication or rebuild needed.');return;}
    }
    if(resultObservations){
      const repaired=require('./sync-canonical-fixtures-to-feed').applyRetainedResultObservations(ids.slice(6).split(','));
      console.log(JSON.stringify(repaired));
      if(!repaired.changed){console.log('Retained result observations already agree; no publication or rebuild needed.');return;}
    }
    for(const args of [
      ...(!resultObservations&&!editorialProjections?[['scripts/apply-current-card-evidence.js',...(baseline?[baseline,ids]:scoped?[ids]:[])]]:[]),
      ...(!scoped?[['scripts/apply-national-team-identities.js','feeds/incoming/events.json']]:[]),
      ['scripts/publish-feed.js',scoped?'data/events.json':'feeds/incoming/events.json','data/events.json','data/feed-meta.json','data/events.js','--preserve-known'],
      ...(scoped?[['scripts/build-follow-fixtures.js']]:[]),
      ['scripts/build-paged-feed.js'],
      ['scripts/build-code-inspector.js',...(scoped?[`--codes=${codes.join(',')}`]:[])],
      ...(scoped&&codes.includes('tennis')?['build-tennis-feed-parents','build-tournament-horizon','build-tennis-journeys'].map(script=>[`scripts/${script}.js`]):[]),
      ['scripts/build-app-shell-runtime.js'],
      ['scripts/version-generated-shell.js'],
      ['scripts/validate-current-evidence-editorial-retention.js'],
      ['scripts/validate-editorial-locks.js','--published'],
      ['scripts/validate-feed.js','data/events.json'],
      ['scripts/qa-storyline-spoilers.js','data/events.json'],
    ]) runStep(args);
    if(!options.localOnly) runStep(['scripts/redeploy-and-release.sh']);
    console.log('Reviewed fixture publication complete; no unrelated source refresh performed.');
    return;
  }
  if(process.argv.includes('--epic-editorial')){
    await require('./epic-editorial').main(process.argv.slice(2));return;
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
    const scope=process.argv.find(arg=>arg.startsWith('--live-source='));
    const sources=liveSources().filter(source=>!scope||(scope==='--live-source=tennis'?/^live-tennis-(?:atp|wta)$/.test(source.id):source.id==='cricket-ca-current'));
    const result=await refreshDueSources({sources});
    console.log(JSON.stringify({mode:"live",...result}));
    if(result.failed.length)process.exitCode=1;
    return;
  }
  if(process.argv.includes('--tennis-current')){
    for(const args of [["scripts/apply-reviewed-participant-fixtures.js"],["scripts/refresh-tennis-scoreboard.js"],["scripts/publish-feed.js","data/events.json","data/events.json","data/feed-meta.json","data/events.js","--preserve-known"],["scripts/build-follow-fixtures.js"],["scripts/build-paged-feed.js"],["scripts/build-code-inspector.js","--codes=tennis"],["scripts/build-follow-directories.js","--codes=tennis,tennis-women"],["scripts/build-follow-directories.js","--codes=tennis,tennis-women","--check"],["scripts/build-tennis-feed-parents.js"],["scripts/build-tournament-horizon.js"],["scripts/build-tennis-journeys.js"],["scripts/build-app-shell-runtime.js"],["scripts/version-generated-shell.js"],["scripts/validate-tennis-scoreboard.js"],["scripts/validate-athletes.js"]])runStep(args);
    if(!options.localOnly)runStep(['scripts/redeploy-and-release.sh']);return;
  }
  if(process.argv.includes('--release-maintenance')){
    for(const args of [["scripts/refresh-football-directory.js","--refresh-due"],["scripts/update-sport-editorial-depth.js","--repair-missing"],["scripts/publish-feed.js","data/events.json","data/events.json","data/feed-meta.json","data/events.js","--preserve-known"],["scripts/build-follow-directories.js","--codes=football"],["scripts/build-follow-fixtures.js"],["scripts/build-paged-feed.js"],["scripts/build-code-inspector.js","--codes=football,tennis"],["scripts/build-app-shell-runtime.js"],["scripts/version-generated-shell.js"],["scripts/validate-football-directory.js"],["scripts/validate-editorial-sport-depth.js"]])runStep(args);
    if(!options.localOnly)runStep(['scripts/redeploy-and-release.sh']);return;
  }
  if(process.argv.includes("--participant-schedules")){
    for(const args of [["scripts/apply-reviewed-participant-fixtures.js"],["scripts/publish-feed.js","data/events.json","data/events.json","data/feed-meta.json","data/events.js","--preserve-known"],["scripts/build-follow-fixtures.js"],["scripts/build-follow-directories.js"],["scripts/build-follow-directories.js","--check"],["scripts/build-paged-feed.js"],["scripts/build-code-inspector.js","--codes=tennis"],["scripts/build-tennis-feed-parents.js"],["scripts/build-tournament-horizon.js"],["scripts/build-tennis-journeys.js"],["scripts/build-app-shell-runtime.js"],["scripts/version-generated-shell.js"],["scripts/build-app-shell-runtime.js","--check"],["scripts/validate-reviewed-tennis-results.js"],["scripts/validate-athletes.js"],["scripts/validate-follow-policy-parity.js"],["scripts/validate-feed.js","data/events.json"],["scripts/qa-storyline-spoilers.js","data/events.json"]])runStep(args);
    console.log("Reviewed participant schedules published through canonical owner; observation clocks retained.");return;
  }
  if(process.argv.includes("--tennis-feed")){
    runStep(['scripts/build-tennis-context.js']);
    runStep(['scripts/build-code-inspector.js','--codes=tennis']);
    runStep(['scripts/build-follow-directories.js','--codes=tennis,tennis-women']);
    runStep(['scripts/build-follow-directories.js','--codes=tennis,tennis-women','--check']);
    for(const script of ['build-tennis-feed-parents','build-tournament-horizon','build-tennis-journeys','validate-tennis-journeys','build-app-shell-runtime','validate-tennis-feed-normalisation'])runStep([`scripts/${script}.js`]);
    return;
  }
  if(process.argv.includes("--follow-ui")){
    runStep(['scripts/refresh-football-directory.js','--prune-removed']);
    for(const script of ["build-follow-directories","build-code-inspector","build-tournament-horizon","build-tennis-feed-parents","build-app-shell-runtime","validate-curated-follow-directories","validate-live-fixture-api"])runStep([`scripts/${script}.js`]);
    console.log("Follow UI projections rebuilt from retained canonical sources; no source refresh or release performed.");return;
  }
  if(process.argv.includes('--representative-context')){
    // Validate both surfaces before mutation; an unchanged review is not a publication.
    const project=require('./apply-representative-metadata').projectDocument;
    const inputs=['feeds/incoming/events.json','data/events.json'].map(file=>({file,document:JSON.parse(fs.readFileSync(file,'utf8'))}));
    const outputs=inputs.map(({file,document})=>project(document,file));
    if(inputs.every(({document},index)=>JSON.stringify(document)===JSON.stringify(outputs[index]))){
      console.log('Existing representative/competition context already agrees; no publication, projection or source check.');return;
    }
    for(const args of [
      ['scripts/apply-representative-metadata.js','feeds/incoming/events.json'],
      ['scripts/apply-representative-metadata.js','data/events.json','data/events.js'],
      ['scripts/publish-feed.js','data/events.json','data/events.json','data/feed-meta.json','data/events.js','--preserve-known'],
      ['scripts/build-follow-fixtures.js'],['scripts/build-paged-feed.js'],
      ['scripts/build-code-inspector.js','--codes=nrl,motogp,motorsport,cricket'],
      ['scripts/build-app-shell-runtime.js'],['scripts/version-generated-shell.js'],
      ['scripts/validate-representative-competition-grouping.js'],
      ['scripts/validate-follow-policy-parity.js'],['scripts/validate-feed.js','data/events.json'],
      ['scripts/qa-storyline-spoilers.js','data/events.json'],
    ])runStep(args);
    console.log('Existing representative fixture context published through the canonical owner; no source refresh performed.');return;
  }
  if(process.argv.includes('--nrlw-finals') || process.argv.includes('--nrlw-season')){
    const season=process.argv.includes('--nrlw-season'),scope=season?'--nrlw-season-only':'--nrlw-finals-only';
    for(const args of [
      ['scripts/sync-requested-sports-to-feed.js','feeds/incoming/events.json','feeds/incoming/events.json',scope],
      ['scripts/sync-requested-sports-to-feed.js','data/events.json','data/events.json',scope],
      ['scripts/publish-feed.js','data/events.json','data/events.json','data/feed-meta.json','data/events.js','--preserve-known'],
      ['scripts/build-follow-fixtures.js'],['scripts/build-paged-feed.js'],
      ['scripts/build-code-inspector.js','--codes=nrlw'],
      ['scripts/validate-nrlw-reviewed-finals.js'],['scripts/validate-requested-sports.js'],
      ['scripts/validate-follow-policy-parity.js'],['scripts/validate-feed.js','data/events.json'],
      ['scripts/qa-storyline-spoilers.js','data/events.json']
    ])runStep(args);
    if(!options.localOnly)runStep(['scripts/redeploy-and-release.sh']);
    console.log(`${season?'Sixty reviewed NRLW season matches':'Reviewed NRLW finals'} published through the canonical owner; no provider refresh.`);return;
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
  if(process.argv.includes('--epl-identities')){
    // Retained projection through the canonical owner, without a provider poll.
    for(const step of [
      ['scripts/publish-feed.js','data/events.json','data/events.json','data/feed-meta.json','data/events.js','--preserve-known'],
      ['scripts/build-follow-fixtures.js'],['scripts/build-paged-feed.js'],['scripts/build-code-inspector.js','--codes=football'],
      ['scripts/build-app-shell-runtime.js'],['scripts/version-generated-shell.js'],['scripts/build-app-shell-runtime.js','--check'],
      ['scripts/validate-epl-provider-identities.js'],['scripts/validate-epl-provider-persistence.js'],['scripts/validate-epl-identity-api.js'],['scripts/validate-epl-local-ratings.js'],['scripts/validate-epl-identity-database.js'],
      ['scripts/validate-follow-policy-parity.js'],['scripts/validate-feed.js','data/events.json'],['scripts/qa-storyline-spoilers.js','data/events.json']
    ])runStep(step);
    console.log('Reviewed EPL identities projected through the canonical owner; no provider check, database application or release.');return;
  }
  if(process.argv.includes('--viewing-reconciliation')){
    for(const step of [
      ['scripts/apply-current-card-evidence.js','--ids=calendar-nothingsport-manual-seed-wsl-margaret-river-pro-2026'],
      ['scripts/publish-feed.js','data/events.json','data/events.json','data/feed-meta.json','data/events.js','--preserve-known'],
      ['scripts/build-follow-fixtures.js'],['scripts/build-paged-feed.js'],['scripts/build-code-inspector.js'],['scripts/build-tournament-horizon.js'],['scripts/build-tennis-feed-parents.js'],
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
      runStep(['scripts/build-follow-directories.js','--codes=cricket,cricket-women,rugby,rugby-women']);
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
    const releaseIndex=steps.findIndex(args=>args[0]==='scripts/redeploy-and-release.sh');
    const refreshSteps=releaseIndex<0?steps:steps.slice(0,releaseIndex);
    const execute=async()=>{for(const args of refreshSteps)runStep(args);};
    if(quick)await execute();
    else await require('./quick-results').atomicRefresh({},{refreshOperation:execute});
    // A failure after publication must not restore pre-release working bytes.
    if(releaseIndex>=0)try{for(const args of steps.slice(releaseIndex))runStep(args);}
    catch(error){error.publicationStarted=true;throw error;}

    if(quick){console.log("Quick results refresh complete.");return;}
    console.log(`\nCards, ladders and standings update complete${options.localOnly ? " (local only)" : ""}: canonical ranking data refreshed and validated, followed fixtures recomputed from the current server snapshot, curated previews applied, fixture research queued, and both feeds passed editorial, spoiler and schema QA.`);
  } finally {
    delete process.env.FOLLOW_SNAPSHOT_PATH;
    delete process.env.FOLLOW_SNAPSHOT_KEY;
    if (snapshotDirectory) fs.rmSync(snapshotDirectory, { recursive:true, force:true });
  }
}

async function main(){
  if(process.argv.includes('--f1-results')){
    const f1StartedAt=require('node:perf_hooks').performance.now();parseOptions();
    // The scoped public F1 owner needs no Football/Golf invocation or backup
    // bookkeeping. Its own atomic boundary includes final diagnostic IO.
    process.env.REFRESH_REPORT ||= path.join(os.tmpdir(),'ns-refresh-report-'+crypto.randomUUID()+'.json');
    require('./lib/refresh-report').update({mode:'f1-results',publicationState:'refreshing',stage:'starting',sourceFailures:[],missingResults:[],blockingError:null,failedStep:null,failureChain:[]});
    try{return await runMain({f1StartedAt});}catch(error){console.error(`Refresh diagnostics: ${process.env.REFRESH_REPORT}`);throw error;}
  }
  // Validate mode before creating diagnostic state or starting any source step.
  const initialOptions=parseOptions();
  if(initialOptions.australianChampionship||initialOptions.retainedCoverage||initialOptions.reviewedEditorial)return runMain();
  process.env.REFRESH_REPORT ||= path.join(os.tmpdir(),'ns-refresh-report-'+crypto.randomUUID()+'.json');
  require('./lib/refresh-report').update({mode:process.argv.includes('--quick')?'quick':'full',publicationState:'refreshing',stage:'starting',sourceFailures:[],missingResults:[],blockingError:null,failedStep:null,failureChain:[]});
  const prior=process.env.FOOTBALL_DATA_RUN_DIR;
  const directory=prior||fs.mkdtempSync(path.join(os.tmpdir(),'ns-football-backup-'));
  process.env.FOOTBALL_DATA_RUN_DIR=directory;
  const priorGolf={file:process.env.GOLF_SOURCE_REPORT,runId:process.env.GOLF_SOURCE_RUN_ID};
  process.env.GOLF_SOURCE_REPORT ||= path.join(directory,'golf-source-report.json');
  process.env.GOLF_SOURCE_RUN_ID=crypto.randomUUID();
  try{
    require('../lib/golf-source-observations').create({mode:process.argv.includes('--offline')?'offline':process.argv.includes('--quick')?'quick':'full'}).save();
    if(!process.argv.includes('--offline'))require('./lib/football-data-backup').record({state:'invocation',mode:process.argv.includes('--quick')?'quick':process.argv.includes('--european-football')?'european-football':'full'},{directory});
    const result=await runMain();
    require('./lib/refresh-report').update({publicationState:'validated',stage:'validated'});
    return result;
  }catch(error){
    try{
      require('./lib/refresh-report').failure(error.message,error.refreshFailure);
      require('./lib/refresh-report').update({publicationState:error.publicationStarted?'blocked-after-publication':error.refreshRollback?.status==='failed'?'blocked-rollback-failed':'blocked-rolled-back',stage:'failed'});
    }catch(diagnosticError){console.warn(`::warning::Canonical failure report unavailable: ${require('./lib/refresh-report').sanitise(diagnosticError.message)}`);}
    console.error(`Refresh diagnostics: ${process.env.REFRESH_REPORT}`);
    throw error;
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
  buildBroadcasterReviewSteps,
  buildVenueReviewSteps,
  discoverCanonicalFixtureBundles,
  parseOptions,
};
