#!/usr/bin/env node

const assert = require("node:assert/strict");
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
assert(localSteps.some(step => step[0] === "scripts/verify-pilot-readiness.js"), "every canonical update must enforce fresh complete current/next-round pilot coverage");
assert(localSteps.some(step => step[0] === "scripts/validate-pilot-readout.js"), "every canonical update must validate the on-demand cohort measurement report");
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

console.log("Canonical update modes valid: default release path retained; --local-only skips only commit, push, and deployment.");
