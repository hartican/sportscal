#!/usr/bin/env node

const assert = require("node:assert/strict");
const { buildSteps, parseOptions } = require("./update-cards");

const releaseStep = "scripts/redeploy-and-release.sh";
const defaultSteps = buildSteps(parseOptions([]));
const localSteps = buildSteps(parseOptions(["-p", "--local-only"]));

assert(defaultSteps.some(step => step[0] === releaseStep), "the scheduled canonical flow must retain its reviewed release step");
assert(!localSteps.some(step => step[0] === releaseStep), "local-only updates must never commit, push, or deploy");
assert(localSteps.some(step => step[0] === "scripts/refresh-canonical-sports.js"), "local-only updates must still refresh canonical sports data");
assert(localSteps.some(step => step[0] === "scripts/verify-result-completeness.js" && step[1] === "data/events.json"), "local-only updates must still enforce published result completeness");
assert.deepEqual(
  localSteps,
  defaultSteps.filter(step => step[0] !== releaseStep),
  "local-only mode must skip only the release boundary"
);

console.log("Canonical update modes valid: default release path retained; --local-only skips only commit, push, and deployment.");
