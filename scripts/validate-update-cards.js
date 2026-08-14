#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { buildSteps, parseOptions } = require("./update-cards");

const releaseStep = "scripts/redeploy-and-release.sh";
const defaultSteps = buildSteps(parseOptions([]));
const localSteps = buildSteps(parseOptions(["-p", "--local-only"]));

assert(defaultSteps.some(step => step[0] === releaseStep), "the scheduled canonical flow must retain its reviewed release step");
assert(!localSteps.some(step => step[0] === releaseStep), "local-only updates must never commit, push, or deploy");
assert(localSteps.some(step => step[0] === "scripts/refresh-canonical-sports.js"), "local-only updates must still refresh canonical sports data");
assert(localSteps.some(step => step[0] === "scripts/refresh-tennis-catalogue.js" && step.includes("--enforce-freshness") && !step.includes("--check")), "every canonical update must rebuild the provider-neutral tennis catalogue and fail closed on stale or asymmetric ATP/WTA ranking exports");
assert(localSteps.some(step => step[0] === "scripts/refresh-tennis-catalogue.js" && step.includes("--check") && step.includes("--enforce-freshness")), "every canonical update must reject a stale generated tennis catalogue");
assert(localSteps.some(step => step[0] === "scripts/build-tennis-context.js" && step.length === 1), "every canonical update must rebuild ATP/WTA athlete follows and standings from the provider-neutral catalogue");
assert(localSteps.some(step => step[0] === "scripts/build-tennis-context.js" && step.includes("--check")), "every canonical update must reject a stale generated tennis context");
assert(localSteps.some(step => step[0] === "scripts/validate-tennis-catalogue.js"), "every canonical update must enforce ATP/WTA parity, Australian coverage, froth rules, and Toronto regression coverage");
assert(localSteps.some(step => step[0] === "scripts/sync-tennis-tournaments-to-feed.js" && step.includes("--from-exports")), "the canonical update must project active marquee tennis from the reviewed provider exports");
assert(localSteps.some(step => step[0] === "scripts/validate-sport-hierarchy.js"), "every canonical update must validate hierarchy compatibility for every published card");
assert(localSteps.some(step => step[0] === "scripts/validate-preference-taxonomy.js"), "every canonical update must validate exact idempotent preference translation into the hierarchy");
assert(localSteps.some(step => step[0] === "scripts/validate-feed-controls.js"), "every canonical update must enforce feed intent, discovery mix, availability and negative suppression");
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
const releaseScript = fs.readFileSync(path.join(projectRoot, "scripts/redeploy-and-release.sh"), "utf8");
const snapshotScript = fs.readFileSync(path.join(projectRoot, "scripts/deploy-current-commit.sh"), "utf8");

assert.match(wrapperScript, /SKIP_RELEASE=1 "\$NODE_BIN" scripts\/update-cards\.js -p/, "the wrapper must suppress update-cards' nested release so each run deploys once");
assert.match(wrapperScript, /local_head.*origin_head/s, "the scheduled wrapper must require an exact origin\/main starting commit");
assert.doesNotMatch(releaseScript, /rsync -a/, "the release must never stage the mutable working tree");
assert.match(releaseScript, /NS_DEPLOY_REF=origin\/main \.\/scripts\/deploy-current-commit\.sh/, "the release must deploy the fetched origin\/main commit");
assert.match(releaseScript, /"data\/canonical\/contexts\.js"/, "the release commit must include the regenerated direct-file context bundle");
assert.match(snapshotScript, /git archive "\$DEPLOY_SHA"/, "the deployment helper must archive the resolved immutable commit");
assert.match(snapshotScript, /releaseGitSha=\$DEPLOY_SHA/, "the Vercel deployment must record its source commit");

const stagingCheck = spawnSync("bash", ["scripts/deploy-current-commit.sh"], {
  cwd: projectRoot,
  env: { ...process.env, NS_DEPLOY_DRY_RUN: "1", NS_DEPLOY_REF: "HEAD" },
  encoding: "utf8",
});
assert.equal(stagingCheck.status, 0, `immutable deployment staging must pass: ${stagingCheck.stderr || stagingCheck.stdout}`);
assert.match(stagingCheck.stdout, /Immutable release snapshot verified:/, "the staging check must report the verified commit");

console.log("Canonical update modes valid: default release path retained; --local-only skips only commit, push, and deployment.");
