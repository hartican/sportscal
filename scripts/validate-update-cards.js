#!/usr/bin/env node

const assert = require("node:assert/strict");
const { buildSteps, parseOptions } = require("./update-cards");

const releaseStep = "scripts/redeploy-and-release.sh";
const defaultSteps = buildSteps(parseOptions([]));
const localSteps = buildSteps(parseOptions(["-p", "--local-only"]));

assert(defaultSteps.some(step => step[0] === releaseStep), "the scheduled canonical flow must retain its reviewed release step");
assert(!localSteps.some(step => step[0] === releaseStep), "local-only updates must never commit, push, or deploy");
assert(localSteps.some(step => step[0] === "scripts/refresh-canonical-sports.js"), "local-only updates must still refresh canonical sports data");
assert(localSteps.some(step => step[0] === "scripts/build-canonical-context-bundle.js" && step.length === 1), "every canonical update must rebuild the direct-file context transport from authoritative JSON");
assert(localSteps.some(step => step[0] === "scripts/build-canonical-context-bundle.js" && step[1] === "--check"), "every canonical update must reject a stale direct-file context transport");
assert(localSteps.some(step => step[0] === "scripts/verify-result-completeness.js" && step[1] === "data/events.json"), "local-only updates must still enforce published result completeness");
assert(localSteps.some(step => step[0] === "scripts/validate-product-events.js"), "every canonical update must enforce the authenticated pilot event contract");
assert(localSteps.some(step => step[0] === "scripts/validate-swipe-learning.js"), "every canonical update must enforce bounded swipe learning and complete-fixture isolation");
assert(localSteps.some(step => step[0] === "scripts/validate-tuning-ratings.js"), "every canonical update must enforce fine-tuning, compatible five-star ratings, and prompt fatigue controls");
assert(localSteps.some(step => step[0] === "scripts/verify-nothingsport.js"), "every canonical update must enforce focused-sport retention and interface regressions");
assert(
  localSteps.findIndex(step => step[0] === "scripts/verify-nothingsport.js")
    > localSteps.findIndex(step => step[0] === "scripts/verify-result-completeness.js" && step[1] === "data/events.json"),
  "the interface regression gate must inspect the fully published and result-complete feed"
);
assert.deepEqual(
  localSteps,
  defaultSteps.filter(step => step[0] !== releaseStep),
  "local-only mode must skip only the release boundary"
);

console.log("Canonical update modes valid: default release path retained; --local-only skips only commit, push, and deployment.");
