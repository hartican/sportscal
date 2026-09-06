#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const cadence = require("./quick-results-cadence");

assert.equal(cadence.shouldRun(new Date("2026-06-01T23:00:00Z")), true, "AEST 09:00 must run");
assert.equal(cadence.shouldRun(new Date("2026-06-01T05:00:00Z")), true, "AEST 15:00 must run");
assert.equal(cadence.shouldRun(new Date("2026-06-01T11:00:00Z")), true, "AEST 21:00 must run");
assert.equal(cadence.shouldRun(new Date("2026-12-01T22:00:00Z")), true, "AEDT 09:00 must run");
assert.equal(cadence.shouldRun(new Date("2026-12-01T04:00:00Z")), true, "AEDT 15:00 must run");
assert.equal(cadence.shouldRun(new Date("2026-12-01T10:00:00Z")), true, "AEDT 21:00 must run");
assert.equal(cadence.shouldRun(new Date("2026-06-01T22:00:00Z")), false, "the companion DST trigger must be rejected in AEST");
assert.equal(cadence.shouldRun(new Date("2026-12-01T23:00:00Z")), false, "the companion standard-time trigger must be rejected in AEDT");

const workflow = fs.readFileSync(".github/workflows/quick-results-refresh.yml", "utf8");
assert.match(workflow, /cron: "0 4,5,10,11,22,23 \* \* \*"/);
assert(!workflow.includes("timezone:"), "GitHub schedule configuration must not depend on unsupported local-time cron syntax");
assert.match(workflow, /quick-results-cadence\.js --github-output/);

const release = fs.readFileSync("scripts/update-sportscal-cards-and-release.sh", "utf8");
assert(release.indexOf("scripts/update-cards.js --quick") < release.indexOf("./scripts/redeploy-and-release.sh"), "the source refresh must complete before release begins");
assert(!release.slice(0, release.indexOf("scripts/update-cards.js --quick")).includes("vercel whoami"), "deployment credentials must not gate source ingestion");

console.log("Quick refresh cadence valid: three Sydney runs across AEST/AEDT, no AI path, and preservation before deployment auth.");
