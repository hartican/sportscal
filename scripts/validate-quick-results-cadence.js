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

assert.equal(fs.existsSync(".github/workflows/quick-results-refresh.yml"),false,"the duplicate quick-results scheduler must stay removed");
const workflow = fs.readFileSync(".github/workflows/canonical-card-refresh.yml", "utf8");
assert.match(workflow, /cron: "0 3 \* \* \*"/);
assert.match(workflow, /timezone: Australia\/Sydney/);
assert.match(workflow, /TZ=Australia\/Sydney date \+%u/);
assert.match(workflow, /QUICK_RESULTS: \$\{\{ steps\.cadence\.outputs\.quick \}\}/);

const release = fs.readFileSync("scripts/update-sportscal-cards-and-release.sh", "utf8");
assert(release.indexOf("scripts/update-cards.js --quick") < release.indexOf("./scripts/redeploy-and-release.sh"), "the source refresh must complete before release begins");
assert(!release.slice(0, release.indexOf("scripts/update-cards.js --quick")).includes("vercel whoami"), "deployment credentials must not gate source ingestion");
const quick=fs.readFileSync("scripts/quick-results.js","utf8");
for(const code of ["american-football","aflw","nrlw","f1","motogp"])assert(quick.includes(`'${code}'`),`${code} must be rebuilt by quick result projection`);
assert(quick.includes("tennis.fetchOfficialSnapshot({quick:true") && fs.readFileSync("scripts/refresh-us-open-events.js","utf8").includes("!cachedUrls.has(day.feedUrl)"),"quick US Open refresh must backfill newly released days");
assert(quick.includes("usRetentionEnd.getUTCDate()+14"),"US Open result backfill must continue through card retention");

console.log("Refresh cadence valid: one daily scheduler, Sunday full reconciliation, no AI path, and preservation before deployment auth.");
