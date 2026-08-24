#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { buildSteps, parseOptions } = require("./update-cards");

const releaseStep = "scripts/redeploy-and-release.sh";
const defaultSteps = buildSteps(parseOptions([], {}));
const localSteps = buildSteps(parseOptions(["-p", "--local-only"], {}));
const environmentLocalSteps = buildSteps(parseOptions([], { SKIP_RELEASE: "1" }));

assert(defaultSteps.some(step => step[0] === releaseStep), "the scheduled canonical flow must retain its reviewed release step");
assert(!localSteps.some(step => step[0] === releaseStep), "local-only updates must never commit, push, or deploy");
assert(!environmentLocalSteps.some(step => step[0] === releaseStep), "SKIP_RELEASE=1 must suppress the nested release even if a caller omits --local-only");
assert(localSteps.some(step => step[0] === "scripts/refresh-canonical-sports.js"), "local-only updates must still refresh canonical sports data");
assert(localSteps.some(step => step[0] === "scripts/refresh-premier-league-context.js" && !step.includes("--check")), "every canonical update must refresh the official EPL league table");
assert(localSteps.some(step => step[0] === "scripts/refresh-premier-league-context.js" && step.includes("--check")), "every canonical update must reject an incomplete published EPL snapshot");
assert(localSteps.some(step => step[0] === "scripts/validate-premier-league-context.js"), "every canonical update must validate EPL identity mapping, offline transport and failed-refresh preservation");
assert(localSteps.some(step => step[0] === "scripts/refresh-major-events-from-canonical.js"), "the canonical update must reconcile published AFL Finals Series slots before validating Events");
assert(
  localSteps.findIndex(step => step[0] === "scripts/refresh-major-events-from-canonical.js")
    > localSteps.findIndex(step => step[0] === "scripts/refresh-canonical-sports.js")
    && localSteps.findIndex(step => step[0] === "scripts/refresh-major-events-from-canonical.js")
      < localSteps.findIndex(step => step[0] === "scripts/validate-major-events.js"),
  "major event reconciliation must run after canonical sport refresh and before Events validation"
);
assert(localSteps.some(step => step[0] === "scripts/refresh-tennis-ranking-exports.js"), "every canonical update must check and refresh the official public ATP/WTA ranking exports before building the catalogue");
assert(localSteps.some(step => step[0] === "scripts/validate-tennis-ranking-refresh.js"), "every canonical update must reject truncated or structurally unsafe official ranking extraction");
assert(localSteps.some(step => step[0] === "scripts/refresh-tennis-catalogue.js" && step.includes("--enforce-freshness") && !step.includes("--check")), "every canonical update must rebuild the provider-neutral tennis catalogue and fail closed on stale or unconfirmed ATP/WTA ranking publications");
assert(localSteps.some(step => step[0] === "scripts/refresh-tennis-catalogue.js" && step.includes("--check") && step.includes("--enforce-freshness")), "every canonical update must reject a stale generated tennis catalogue");
assert(localSteps.some(step => step[0] === "scripts/build-tennis-context.js" && step.length === 1), "every canonical update must rebuild ATP/WTA athlete follows and standings from the provider-neutral catalogue");
assert(localSteps.some(step => step[0] === "scripts/build-tennis-context.js" && step.includes("--check")), "every canonical update must reject a stale generated tennis context");
assert(localSteps.some(step => step[0] === "scripts/validate-tennis-catalogue.js"), "every canonical update must enforce independent ATP/WTA publication freshness, Australian coverage, froth rules, and Toronto regression coverage");
assert(localSteps.some(step => step[0] === "scripts/refresh-football-directory.js" && step.includes("--check")), "every canonical update must fail closed when a six-league football snapshot is incomplete");
assert(localSteps.some(step => step[0] === "scripts/validate-football-directory.js"), "every canonical update must validate football clubs, players, follows, flags, session state, and lazy fixtures");
assert(localSteps.some(step => step[0] === "scripts/build-team-player-directories.js" && step.includes("--check")), "every canonical update must reject stale NRL and AFL directory snapshots");
assert(localSteps.some(step => step[0] === "scripts/validate-team-player-directories.js"), "every canonical update must validate NRL and AFL club coverage, player follow expansion, source URLs and lazy loading");
assert(localSteps.some(step => step[0] === "scripts/sync-tennis-tournaments-to-feed.js" && step.includes("--from-exports")), "the canonical update must project active marquee tennis from the reviewed provider exports");
assert(localSteps.some(step => step[0] === "scripts/validate-sport-hierarchy.js"), "every canonical update must validate hierarchy compatibility for every published card");
assert(localSteps.some(step => step[0] === "scripts/validate-discovery-catalogue.js"), "every canonical update must validate discovery hierarchy, event-follow migration, Sydney-window counts and session state");
assert(localSteps.some(step => step[0] === "scripts/refresh-cincinnati-tournament.js"), "every canonical update must run the official Cincinnati-only tournament check");
assert(localSteps.some(step => step[0] === "scripts/validate-joint-tennis-tournament.js"), "every canonical update must reject joint-tournament schema, ID, date or spoiler failures");
assert(localSteps.some(step => step[0] === "scripts/validate-major-events.js"), "every canonical update must fail closed on major-event evidence, dates, IDs and ticket endpoints");
assert(localSteps.some(step => step[0] === "scripts/validate-card-polish.js"), "every canonical update must retain card, venue, score and local-ticket regressions");
assert(localSteps.some(step => step[0] === "scripts/validate-preference-taxonomy.js"), "every canonical update must validate exact idempotent preference translation into the hierarchy");
assert(localSteps.some(step => step[0] === "scripts/validate-feed-controls.js"), "every canonical update must enforce feed intent, discovery mix, availability and negative suppression");
assert(localSteps.some(step => step[0] === "scripts/validate-code-inspector-ui.js"), "every canonical update must cover every canonical code through the read-only Inspector contract");
assert(localSteps.some(step => step[0] === "scripts/validate-events-fixture-ux.js"), "every canonical update must validate Events tabs, compact fixture density, viewport stability and retained-card swipe learning");
assert(localSteps.some(step => step[0] === "scripts/validate-feed-ui-geometry.js"), "every canonical update must reject identity escapes, collisions, overflow and missing reserved geometry");
assert(localSteps.some(step => step[0] === "scripts/scan-broadcaster-coverage.js" && step.includes("--enforce-freshness") && !step.includes("--check")), "every canonical update must regenerate the broadcaster-led weekly and next-seven-day coverage report from approved inputs");
assert(localSteps.some(step => step[0] === "scripts/scan-broadcaster-coverage.js" && step.includes("--check") && step.includes("--enforce-freshness")), "every canonical update must reject stale broadcaster inputs and report artifacts");
assert(localSteps.some(step => step[0] === "scripts/validate-broadcaster-discovery.js"), "every canonical update must enforce source-adapter, matching, AU availability and editorial queue contracts");
assert(localSteps.some(step => step[0] === "scripts/validate-phase5-premium-ranking.js"), "every canonical update must enforce storyline, override, premium ranking, and clutter-control contracts");
assert(localSteps.some(step => step[0] === "scripts/apply-approved-coverage.js" && step.includes("--write")), "every canonical update must apply explicitly approved availability changes and canonical additions to the incoming feed");
assert(localSteps.some(step => step[0] === "scripts/apply-approved-coverage.js" && step.includes("--check")), "every canonical update must verify that approved coverage is present before publication");
assert(
  localSteps.findIndex(step => step[0] === "scripts/apply-approved-coverage.js" && step.includes("--write"))
    < localSteps.findIndex(step => step[0] === "scripts/publish-feed.js"),
  "approved coverage must enter the incoming feed before canonical publication"
);
assert(
  localSteps.findIndex(step => step[0] === "scripts/scan-broadcaster-coverage.js" && !step.includes("--check"))
    > localSteps.findIndex(step => step[0] === "scripts/publish-feed.js"),
  "the next editorial report must compare broadcaster inputs against the fully published catalogue"
);
assert(localSteps.some(step => step[0] === "scripts/build-canonical-context-bundle.js" && step.length === 1), "every canonical update must rebuild the direct-file context transport from authoritative JSON");
assert(localSteps.some(step => step[0] === "scripts/build-canonical-context-bundle.js" && step[1] === "--check"), "every canonical update must reject a stale direct-file context transport");
assert(localSteps.some(step => step[0] === "scripts/verify-result-completeness.js" && step[1] === "data/events.json"), "local-only updates must still enforce published result completeness");
assert(localSteps.some(step => step[0] === "scripts/validate-result-completeness-timing.js"), "every canonical update must protect multi-day Test timing before checking overdue results");
assert(localSteps.some(step => step[0] === "scripts/verify-pilot-readiness.js"), "every canonical update must enforce fresh complete current/next-round pilot coverage");
assert(localSteps.some(step => step[0] === "scripts/validate-pilot-readout.js"), "every canonical update must validate the on-demand cohort measurement report");
assert(localSteps.some(step => step[0] === "scripts/build-discovery-dashboard.js" && step.length === 1), "every canonical update must record the current coverage baseline and rebuild the no-user-data discovery dashboard");
assert(localSteps.some(step => step[0] === "scripts/build-discovery-dashboard.js" && step.includes("--check")), "every canonical update must reject stale Phase 6 measurement artifacts");
assert(localSteps.some(step => step[0] === "scripts/validate-discovery-measurement.js"), "every canonical update must enforce evidence-gated discovery tuning and keep empty action samples insufficient");
assert(localSteps.some(step => step[0] === "scripts/validate-product-events.js"), "every canonical update must enforce the authenticated pilot event contract");
assert(localSteps.some(step => step[0] === "scripts/validate-cross-device-sync.js"), "every canonical update must enforce cross-device field-level reconciliation");
assert(localSteps.some(step => step[0] === "scripts/validate-server-persistence.js"), "every canonical update must enforce durable trusted-device sessions and session-only opt-out");
assert(localSteps.some(step => step[0] === "scripts/validate-swipe-learning.js"), "every canonical update must enforce bounded swipe learning and complete-fixture isolation");
assert(localSteps.some(step => step[0] === "scripts/validate-tuning-ratings.js"), "every canonical update must enforce fine-tuning, compatible five-star ratings, and prompt fatigue controls");
assert(localSteps.some(step => step[0] === "scripts/verify-nothingsport.js"), "every canonical update must enforce focused-sport retention and interface regressions");
assert(
  localSteps.findIndex(step => step[0] === "scripts/verify-nothingsport.js")
    > localSteps.findIndex(step => step[0] === "scripts/verify-result-completeness.js" && step[1] === "data/events.json"),
  "the interface regression gate must inspect the fully published and result-complete feed"
);
assert(
  localSteps.findIndex(step => step[0] === "scripts/verify-pilot-readiness.js")
    > localSteps.findIndex(step => step[0] === "scripts/verify-result-completeness.js" && step[1] === "data/events.json"),
  "pilot readiness must run only after the published feed is result complete"
);
assert.deepEqual(
  localSteps,
  defaultSteps.filter(step => step[0] !== releaseStep),
  "local-only mode must skip only the release boundary"
);

const projectRoot = path.resolve(__dirname, "..");
const wrapperScript = fs.readFileSync(path.join(projectRoot, "scripts/update-sportscal-cards-and-release.sh"), "utf8");
const tournamentCheckScript = fs.readFileSync(path.join(projectRoot, "scripts/check-active-tournament-and-release.sh"), "utf8");
const releaseScript = fs.readFileSync(path.join(projectRoot, "scripts/redeploy-and-release.sh"), "utf8");
const snapshotScript = fs.readFileSync(path.join(projectRoot, "scripts/deploy-current-commit.sh"), "utf8");
const vercelConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, "vercel.json"), "utf8"));

assert.match(wrapperScript, /SKIP_RELEASE=1 "\$NODE_BIN" scripts\/update-cards\.js -p --local-only/, "the wrapper must explicitly suppress update-cards' nested release so each run deploys once");
assert.match(wrapperScript, /\$WEBSITE_URL\/service-worker\.js/, "the release wrapper must verify the served service worker");
assert.match(wrapperScript, /REMOTE_HOME_HASH.*LOCAL_HOME_HASH_AFTER/s, "the release wrapper must compare the live shell with the immutable local snapshot");
assert.match(wrapperScript, /REMOTE_META_HASH.*LOCAL_META_HASH_AFTER/s, "the release wrapper must compare live feed metadata with the immutable local snapshot");
assert.match(wrapperScript, /REMOTE_SERVICE_WORKER_HASH.*LOCAL_SERVICE_WORKER_HASH_AFTER/s, "the release wrapper must compare the live service worker with the immutable local snapshot");
assert.match(wrapperScript, /RELEASE_CONTENT_MATCH="NO"/, "a live-content mismatch must fail closed");
assert.match(tournamentCheckScript, /NODE_BIN="\$\{NODE_BIN:-node\}"/, "the separate tournament job must honour the approved Node runtime override");
assert.match(tournamentCheckScript, /PROBE_JSON="\$\("\$NODE_BIN" scripts\/refresh-cincinnati-tournament\.js --probe\)"/, "the tournament probe must run through NODE_BIN");
assert.match(tournamentCheckScript, /refresh-cincinnati-tournament\.js --probe/, "the separate tournament job must probe the official source without mutating output");
assert.match(tournamentCheckScript, /scripts\/update-sportscal-cards-and-release\.sh/, "a changed active tournament must enter the canonical update and immutable release path");
assert.match(tournamentCheckScript, /No supported tournament is active/, "an inactive tournament check must be an explicit no-op");
assert.match(tournamentCheckScript, /output is unchanged/, "an unchanged tournament check must be an explicit no-op");
assert.match(wrapperScript, /local_head.*origin_head/s, "the scheduled wrapper must require an exact origin\/main starting commit");
assert.doesNotMatch(releaseScript, /rsync -a/, "the release must never stage the mutable working tree");
assert.match(releaseScript, /NS_DEPLOY_REF=origin\/main \.\/scripts\/deploy-current-commit\.sh/, "the release must deploy the fetched origin\/main commit");
assert.match(releaseScript, /vercel list sportscal --meta "releaseGitSha=\$DEPLOY_SHA" --status READY --json/, "the release must query READY deployments by immutable source commit");
assert.match(releaseScript, /item\.target === "production"/, "the release metadata check must require the production target");
assert.match(releaseScript, /"data\/canonical\/contexts\.js"/, "the release commit must include the regenerated direct-file context bundle");
assert.match(releaseScript, /"data\/canonical\/joint-tennis-tournament-2026\.js"/, "the release commit must include the regenerated direct-file tournament bundle");
assert.match(snapshotScript, /materialize-git-tree\.js "\$DEPLOY_SHA"/, "the deployment helper must materialise the resolved immutable commit from Git objects");
assert.doesNotMatch(snapshotScript, /(?:git archive|git checkout|rsync -a)/, "immutable staging must avoid mutable worktree copies and the macOS bulk Git paths that can SIGBUS");
const materializerSource = fs.readFileSync(path.join(projectRoot, "scripts/materialize-git-tree.js"), "utf8");
assert.match(materializerSource, /gitBlobOid\(content\) === entry\.oid/, "working-tree bytes may be reused only after exact Git blob identity verification");
assert.match(materializerSource, /execFileSync\("git", \["cat-file", "blob", entry\.oid\]/, "changed working-tree files must fall back to immutable Git object reads");
assert.match(snapshotScript, /releaseGitSha=\$DEPLOY_SHA/, "the Vercel deployment must record its source commit");
assert.equal(vercelConfig.git?.deploymentEnabled, false, "Vercel Git auto-deploys must remain disabled so the reviewed immutable CLI release is the only production deployment path");

function runTournamentGate(probeJson){
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nothingsport-tournament-gate-"));
  const fixtureScripts = path.join(fixtureRoot, "scripts");
  const nodeArgsPath = path.join(fixtureRoot, "node-args.txt");
  const releaseMarkerPath = path.join(fixtureRoot, "release-marker.txt");
  const nodeStubPath = path.join(fixtureRoot, "node-stub.sh");
  try {
    fs.mkdirSync(fixtureScripts, { recursive: true });
    fs.copyFileSync(path.join(projectRoot, "scripts/check-active-tournament-and-release.sh"), path.join(fixtureScripts, "check-active-tournament-and-release.sh"));
    fs.writeFileSync(nodeStubPath, "#!/usr/bin/env bash\nset -euo pipefail\nprintf '%s\\n' \"$*\" > \"$NODE_ARGS_PATH\"\nprintf '%s\\n' \"$TOURNAMENT_PROBE_JSON\"\n");
    fs.chmodSync(nodeStubPath, 0o755);
    fs.writeFileSync(path.join(fixtureScripts, "update-sportscal-cards-and-release.sh"), "#!/usr/bin/env bash\nset -euo pipefail\nprintf '%s\\n' \"${RELEASE_COMMIT_MESSAGE:-}\" > \"$RELEASE_MARKER_PATH\"\n");
    fs.chmodSync(path.join(fixtureScripts, "update-sportscal-cards-and-release.sh"), 0o755);
    const result = spawnSync("bash", ["scripts/check-active-tournament-and-release.sh"], {
      cwd: fixtureRoot,
      env: {
        ...process.env,
        NODE_BIN: nodeStubPath,
        NODE_ARGS_PATH: nodeArgsPath,
        RELEASE_MARKER_PATH: releaseMarkerPath,
        TOURNAMENT_PROBE_JSON: probeJson,
      },
      encoding: "utf8",
    });
    return {
      result,
      nodeArgs: fs.existsSync(nodeArgsPath) ? fs.readFileSync(nodeArgsPath, "utf8").trim() : "",
      releaseMessage: fs.existsSync(releaseMarkerPath) ? fs.readFileSync(releaseMarkerPath, "utf8").trim() : null,
    };
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

const inactiveTournamentGate = runTournamentGate('{"status":"inactive","changed":false}');
assert.equal(inactiveTournamentGate.result.status, 0, inactiveTournamentGate.result.stderr);
assert.match(inactiveTournamentGate.result.stdout, /No supported tournament is active/);
assert.equal(inactiveTournamentGate.releaseMessage, null, "inactive tournament checks must not call the release wrapper");
assert.equal(inactiveTournamentGate.nodeArgs, "scripts/refresh-cincinnati-tournament.js --probe", "the gate must use NODE_BIN for only the read-only probe");

const unchangedTournamentGate = runTournamentGate('{"status":"success","changed":false}');
assert.equal(unchangedTournamentGate.result.status, 0, unchangedTournamentGate.result.stderr);
assert.match(unchangedTournamentGate.result.stdout, /output is unchanged/);
assert.equal(unchangedTournamentGate.releaseMessage, null, "unchanged tournament checks must not call the release wrapper");

const changedTournamentGate = runTournamentGate('{"status":"success","changed":true}');
assert.equal(changedTournamentGate.result.status, 0, changedTournamentGate.result.stderr);
assert.equal(changedTournamentGate.releaseMessage, "Refresh active tournament schedule", "changed tournament checks must call the canonical wrapper exactly once with the targeted release message");

const stagingCheck = spawnSync("bash", ["scripts/deploy-current-commit.sh"], {
  cwd: projectRoot,
  env: { ...process.env, NS_DEPLOY_DRY_RUN: "1", NS_DEPLOY_REF: "HEAD" },
  encoding: "utf8",
});
assert.equal(stagingCheck.status, 0, `immutable deployment staging must pass: ${stagingCheck.stderr || stagingCheck.stdout}`);
assert.match(stagingCheck.stdout, /Immutable release snapshot verified:/, "the staging check must report the verified commit");

console.log("Canonical update modes valid: local-only and SKIP_RELEASE suppress nested releases; immutable CLI deployment is the sole production path.");
