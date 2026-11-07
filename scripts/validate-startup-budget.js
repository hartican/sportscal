#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
require('./validate-feed-page-budget');

const serviceWorker = fs.readFileSync("service-worker.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const releaseVersion=JSON.parse(fs.readFileSync('app-version.json','utf8')).version;
assert.equal(html.match(/name="app-shell-version" content="(\d+)"/)?.[1],releaseVersion,'HTML must match the release marker');
assert.equal(serviceWorker.match(/const SHELL_VERSION = "(\d+)"/)?.[1],releaseVersion,'worker version replies must match the release marker, not just the cache name');
assert(serviceWorker.includes(`nothingsport-shell-v${releaseVersion}`),'cache identity must match the release marker');
const shellBlock = serviceWorker.match(/const APP_SHELL = \[([\s\S]*?)\n\];/)?.[1] || "";
const assets = [...shellBlock.matchAll(/"([^"]+)"/g)].map(match => match[1]);
const bytes = assets.reduce((total, asset) => {
  const localPath = `.${asset.split(/[?#]/, 1)[0]}`;
  return total + (fs.existsSync(localPath) && fs.statSync(localPath).isFile() ? fs.statSync(localPath).size : 0);
}, 0);

assert(bytes <= 3 * 1024 * 1024, `lean app shell must stay under 3 MB, received ${bytes} bytes`);
assert(!assets.includes("/") && assets.includes("/index.html"), "installation must fetch one canonical HTML shell, not a duplicate root alias");
assert(!html.includes('src="data/events.js"'), "the 1.6 MB fallback bundle must not block HTML parsing");
assert(html.includes('function loadLatestBundledEvents()') && html.includes('return reloadBundledEventsScript();'), "offline fallback must remain available on demand");
// Exercise the real fallback function. A comment is not proof that the script
// URL still matches the installed cache after a release.
const fallback=html.match(/function reloadBundledEventsScript\(\)\{[\s\S]*?\n\}/)?.[0];
assert(fallback,"the on-demand fallback function must remain available");
function fallbackUrl(source){
  let inserted;
  const context={URL,EVENTS:[],FEED_CONFIG:{eventsScriptUrl:"data/events.js"},
    document:{baseURI:"https://qa.nothingsport.invalid/",createElement:()=>({}),head:{appendChild:script=>{inserted=script;}}}};
  vm.runInNewContext(source+'\nreloadBundledEventsScript();',context);
  return inserted?.src;
}
const cachedFallback=new URL('/data/events.js','https://qa.nothingsport.invalid/').href;
assert.equal(fallbackUrl(fallback),cachedFallback,"the on-demand fallback must use a cache-matchable URL");
assert.notEqual(fallbackUrl(fallback.replace('script.src = source.href;','script.src = source.href + "?cacheBust=1";')),cachedFallback,"the URL check must catch a cache-busting regression");
assert(!assets.includes("/data/events.json"), "duplicate JSON feed must not be precached");
assert(!assets.includes("/data/marquee-candidates.v1.json"), "server owner candidate data must not be precached");
assert(!assets.includes("/assets/audio/sb_skyscrapersamba_eq_lessdrums.mp3"), "optional soundtrack must not be precached");
assert(JSON.parse(fs.readFileSync('config/app-shell-modules.json','utf8')).includes('config/server-sync.js'), 'Required account sync remains inside the canonical runtime');
assert(!assets.includes('/config/server-sync.js'), 'Account sync must not be downloaded twice in the installed shell; standalone owner use caches normally');
assert(html.includes('id="soundtrackAudio"') && html.includes('preload="none"'), "soundtrack must defer network work until explicitly played");

const deferredSetup=html.match(/function openFirstRunSettingsAfterFeedAlignment\(\)\{[\s\S]*?\n\}/)?.[0];
assert(deferredSetup,'the existing first-run alignment owner remains available');
for(const [label,complete,settingsOpen,expected]of [
  ['untouched cold setup',false,false,1],
  ['completed while queued',true,false,0],
  ['Account opened while queued',false,true,0],
  ['completed and Account open',true,true,0],
]){
  const frames=[],opened=[],preferences={onboardingComplete:false},modal={open:false};
  const context={userPreferences:preferences,window:{requestAnimationFrame:callback=>frames.push(callback)},
    document:{getElementById:id=>{assert.equal(id,'settingsModal');return{classList:{contains:name=>{assert.equal(name,'show');return modal.open;}}};}},
    openSettings:options=>opened.push(options)};
  vm.runInNewContext(deferredSetup+'\nopenFirstRunSettingsAfterFeedAlignment();',context);
  assert.equal(frames.length,1);frames.shift()();
  preferences.onboardingComplete=complete;modal.open=settingsOpen;
  assert.equal(frames.length,1);frames.shift()();
  assert.equal(opened.length,expected,label+' must use current completion/navigation at the final frame');
  if(expected)assert.equal(opened[0].firstRun,true);
}

console.log(`Startup budget valid: ${assets.length} shell assets, ${(bytes / 1024 / 1024).toFixed(2)} MB precache, generated feed fallback deferred.`);
