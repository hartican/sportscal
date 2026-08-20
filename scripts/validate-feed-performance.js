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
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

  assert.equal(freshMedian, audit.measurements.release3FreshOrigin.medianMs, "fresh-origin browser median must be reproducible from its samples");
  assert.equal(configuredMedian, audit.measurements.release3Configured.medianMs, "configured browser median must be reproducible from its samples");
  assert(freshMedian <= audit.targets.freshOriginFirstCardMedianMs, `fresh first-card median ${freshMedian}ms exceeds target`);
  assert(configuredMedian <= audit.targets.configuredFirstCardMedianMs, `configured first-card median ${configuredMedian}ms exceeds target`);
  assert(gzipGrowthPercent <= audit.targets.maxCriticalGzipGrowthPercent, `critical gzip growth ${gzipGrowthPercent.toFixed(2)}% exceeds target`);
  assert(current.requestCount <= audit.targets.maxCriticalLocalAssetRequests, `critical local asset request count ${current.requestCount} exceeds target`);
  assert(audit.measurements.release3FreshOrigin.horizontalOverflow === false, "fresh mobile preview must have no horizontal overflow");
  assert(audit.measurements.release3Configured.horizontalOverflow === false, "configured mobile preview must have no horizontal overflow");
  assert(html.includes("renderAll();\nscheduleBrowserReminders();"), "the bundled static feed must render before startup network tasks begin");
  assert(html.indexOf("renderAll();\nscheduleBrowserReminders();") < html.indexOf("const startupTasks = ["), "the first static render must precede background hydration");

  console.log(`Feed performance valid: fresh median ${freshMedian}ms, configured median ${configuredMedian}ms; critical payload ${(current.gzipBytes / 1024).toFixed(1)} KiB gzip (${gzipGrowthPercent.toFixed(2)}% vs ${audit.baseline.ref}), ${current.requestCount} local assets.`);
}

if (require.main === module) main();

module.exports = { criticalAssetMetrics, localScriptPaths, median };
