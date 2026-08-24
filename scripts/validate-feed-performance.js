#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const AUDIT_PATH = path.join(ROOT, "data/coverage/feed-performance-audit.json");

function localScriptPaths(html){
  return Array.from(html.matchAll(/<script[^>]+src="([^"]+)"/g), match => match[1])
    .filter(source => !/^https?:/i.test(source));
}

function readAtRef(ref, filePath){
  try {
    return execFileSync("git", ["show", `${ref}:${filePath}`], { cwd: ROOT, maxBuffer: 10 * 1024 * 1024 });
  } catch {
    return null;
  }
}

function criticalAssetMetrics({ ref = null } = {}){
  const read = filePath => ref ? readAtRef(ref, filePath) : fs.readFileSync(path.join(ROOT, filePath));
  const htmlBuffer = read("index.html");
  assert(htmlBuffer, `index.html must exist${ref ? ` at ${ref}` : ""}`);
  const html = htmlBuffer.toString("utf8");
  const paths = ["index.html", ...localScriptPaths(html)];
  const files = paths.map(filePath => ({ filePath, buffer: read(filePath) })).filter(item => item.buffer);
  return {
    requestCount: files.length,
    rawBytes: files.reduce((total, item) => total + item.buffer.length, 0),
    gzipBytes: files.reduce((total, item) => total + zlib.gzipSync(item.buffer).length, 0),
    files: files.map(item => item.filePath),
  };
}

function median(values){
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function main(){
  const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, "utf8"));
  assert.equal(audit.schemaVersion, "feed-performance-audit.v1");
  const baseline = criticalAssetMetrics({ ref: audit.baseline.ref });
  const current = criticalAssetMetrics();
  const gzipGrowthPercent = ((current.gzipBytes / baseline.gzipBytes) - 1) * 100;
  const freshMedian = median(audit.measurements.release3FreshOrigin.samplesMs);
  const configuredMedian = median(audit.measurements.release3Configured.samplesMs);
  const missionCriticalMedian = median(audit.measurements.release4MissionCritical.samplesMs);
  const missionCriticalRefreshMedian = median(audit.measurements.release4MissionCritical.feedRefreshSamplesMs);
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "data/feed/manifest.json"), "utf8"));
  const firstPage = fs.statSync(path.join(ROOT, manifest.pages[0].path));
  const baselineFeed = readAtRef("origin/main", "data/events.json");
  const currentInitialFeed = Buffer.concat([
    fs.readFileSync(path.join(ROOT, "data/feed/manifest.json")),
    fs.readFileSync(path.join(ROOT, manifest.pages[0].path)),
  ]);
  const transferReduction = 1 - (zlib.gzipSync(currentInitialFeed).length / zlib.gzipSync(baselineFeed).length);
  const hydrationReduction = 1 - (missionCriticalMedian / audit.measurements.release2FreshOrigin.medianMs);

  assert.equal(freshMedian, audit.measurements.release3FreshOrigin.medianMs, "fresh-origin browser median must be reproducible from its samples");
  assert.equal(configuredMedian, audit.measurements.release3Configured.medianMs, "configured browser median must be reproducible from its samples");
  assert(freshMedian <= audit.targets.freshOriginFirstCardMedianMs, `fresh first-card median ${freshMedian}ms exceeds target`);
  assert(configuredMedian <= audit.targets.configuredFirstCardMedianMs, `configured first-card median ${configuredMedian}ms exceeds target`);
  assert.equal(missionCriticalMedian, audit.measurements.release4MissionCritical.medianMs, "mission-critical browser median must be reproducible from its samples");
  assert.equal(missionCriticalRefreshMedian, audit.measurements.release4MissionCritical.feedRefreshMedianMs, "bounded feed-refresh median must be reproducible from its samples");
  assert(transferReduction >= 0.5, `startup feed transfer reduction ${(transferReduction * 100).toFixed(1)}% is below 50%`);
  assert(hydrationReduction >= 0.5, `browser hydration reduction ${(hydrationReduction * 100).toFixed(1)}% is below 50%`);
  assert.equal(audit.measurements.release4MissionCritical.initialFeedPageRequests, 1, "startup must request only the first feed page before interaction");
  assert(audit.measurements.release4MissionCritical.maximumInitialImageRequests <= 20, "startup must request no more than twenty card images");
  assert(gzipGrowthPercent <= audit.targets.maxCriticalGzipGrowthPercent, `critical gzip growth ${gzipGrowthPercent.toFixed(2)}% exceeds target`);
  assert(current.requestCount <= audit.targets.maxCriticalLocalAssetRequests, `critical local asset request count ${current.requestCount} exceeds target`);
  assert(audit.measurements.release3FreshOrigin.horizontalOverflow === false, "fresh mobile preview must have no horizontal overflow");
  assert(audit.measurements.release3Configured.horizontalOverflow === false, "configured mobile preview must have no horizontal overflow");
  assert.equal(manifest.schemaVersion, "public-feed.v2", "published startup data must use the paged feed contract");
  assert.equal(manifest.pageSize, 20, "the first feed window must remain bounded to twenty records");
  assert(firstPage.size <= 250 * 1024, "the first feed page must remain below 250 KiB uncompressed");
  assert(html.includes("loadDeferredStartupContext") && html.includes('name:"published feed"'), "optional context must be deferred until the first page is usable");
  assert(html.includes("cumulativeLayoutShift") && html.includes("feedLongTaskMaxMs") && html.includes("feedInteractionMaxMs"), "privacy-safe browser QA metrics must publish CLS, long-task and interaction ceilings");
  assert(html.includes("}, 480);") && html.includes("duration:360") && !html.includes("}, 3000);"), "the branded launch must reveal the usable shell in under one second");

  console.log(`Feed performance valid: mission-critical browser median ${missionCriticalMedian}ms (${(hydrationReduction * 100).toFixed(1)}% faster), feed refresh ${missionCriticalRefreshMedian}ms; initial feed transfer ${(transferReduction * 100).toFixed(1)}% smaller, ${audit.measurements.release4MissionCritical.maximumInitialImageRequests} image requests max.`);
}

if (require.main === module) main();

module.exports = { criticalAssetMetrics, localScriptPaths, median };
