#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const serviceWorker = fs.readFileSync("service-worker.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const shellBlock = serviceWorker.match(/const APP_SHELL = \[([\s\S]*?)\n\];/)?.[1] || "";
const assets = [...shellBlock.matchAll(/"([^"]+)"/g)].map(match => match[1]);
const bytes = assets.reduce((total, asset) => {
  const localPath = `.${asset}`;
  return total + (fs.existsSync(localPath) ? fs.statSync(localPath).size : 0);
}, 0);

assert(bytes <= 3 * 1024 * 1024, `lean app shell must stay under 3 MB, received ${bytes} bytes`);
assert(!html.includes('src="data/events.js"'), "the 1.6 MB fallback bundle must not block HTML parsing");
assert(html.includes('function loadLatestBundledEvents()') && html.includes('return reloadBundledEventsScript();'), "offline fallback must remain available on demand");
assert(html.includes('Preserve the stable URL so the service-worker'), "the on-demand fallback must use a cache-matchable URL");
assert(!assets.includes("/data/events.json"), "duplicate JSON feed must not be precached");
assert(!assets.includes("/assets/audio/sb_skyscrapersamba_eq_lessdrums.mp3"), "optional soundtrack must not be precached");
assert(html.includes('id="soundtrackAudio"') && html.includes('preload="none"'), "soundtrack must defer network work until explicitly played");

console.log(`Startup budget valid: ${assets.length} shell assets, ${(bytes / 1024 / 1024).toFixed(2)} MB precache, generated feed fallback deferred.`);
