#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const loading = require("../config/loading-progress.js");

(async function run(){

const controller = loading.createController();
const percentages = [];
controller.subscribe(snapshot => percentages.push(snapshot.percent));
assert.equal(controller.snapshot().percent, 0);
controller.complete("runtime");
assert.equal(controller.snapshot().percent, 10);
controller.complete("local-state");
assert.equal(controller.snapshot().percent, 30);
controller.set("feed-page", 0.5);
assert.equal(controller.snapshot().percent, 52);
controller.set("feed-page", 0.25);
assert.equal(controller.snapshot().percent, 52, "reported loading progress must never move backwards");
controller.complete("feed-page");
controller.complete("first-viewport");
assert.equal(controller.snapshot().percent, 90);
controller.set("account-state", 0.9);
assert.equal(controller.snapshot().percent, 95, "opaque work must remain below complete until the task settles");
controller.complete("account-state");
assert.equal(controller.snapshot().percent, 100);
assert.equal(controller.snapshot().phase, "complete");
assert(percentages.every((value, index) => !index || value >= percentages[index - 1]), "subscriber progress must be monotonic");

assert.deepEqual(loading.startupTiming({ readyAfterMs: 1000 }), { funnelStartAfterMs: 3000, funnelDurationMs: 1000 });
assert.deepEqual(loading.startupTiming({ readyAfterMs: 4500 }), { funnelStartAfterMs: 4500, funnelDurationMs: 1000 });
assert.deepEqual(loading.startupTiming({ readyAfterMs: 8000 }), { funnelStartAfterMs: 6000, funnelDurationMs: 1000 });
assert.deepEqual(loading.startupTiming({ readyAfterMs: 8000, reducedMotion: true }), { funnelStartAfterMs: 0, funnelDurationMs: 0 });

const failed = loading.createController();
failed.fail("feed-page", "Network unavailable");
assert.equal(failed.snapshot().phase, "failed");
assert.equal(failed.snapshot().error, "Network unavailable");
assert.match(loading.ringMarkup(failed.snapshot(), { label: "Loading Fixtures" }), /role="progressbar"/);
assert.match(loading.ringMarkup(failed.snapshot(), { label: "Loading Fixtures" }), /aria-label="Loading Fixtures: Network unavailable"/);

assert.equal(loading.LOADING_AUDIO_CUES.fill.src, null, "placeholder loading cues must not make a network request");
assert.equal(loading.LOADING_AUDIO_CUES.funnel.src, null, "placeholder funnel cues must not make a network request");
const storageValues = new Map();
const fakeAudio = () => ({ src:"", loop:false, currentTime:4, paused:true, playCalls:0, pause(){ this.paused = true; }, async play(){ this.paused = false; this.playCalls += 1; } });
const fillAudio = fakeAudio();
const funnelAudio = fakeAudio();
const audioPlayer = loading.createAudioCuePlayer({
  fillAudio,
  funnelAudio,
  storage:{ getItem:key => storageValues.get(key) || null, setItem:(key, value) => storageValues.set(key, value) },
  cues:{ fill:{ src:"/tennis.mp3", loop:true }, funnel:{ src:"/golf.mp3", loop:false } },
});
assert.equal(audioPlayer.available(), true);
await audioPlayer.enable();
assert.equal(fillAudio.playCalls, 1, "the one-time enable gesture must start the fill cue");
await audioPlayer.playFunnel();
assert.equal(fillAudio.paused, true);
assert.equal(funnelAudio.playCalls, 1, "the funnel cue must play once after the fill cue stops");

const html = fs.readFileSync("index.html", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
require("./app-shell-test-utils").assertShellModule(html,"config/loading-progress.js");
assert(html.includes('id="startupProgressRing"') && html.includes('id="headerHydrationSlot"'), "startup and in-session surfaces must share percentage-ring hosts");
assert(html.includes("loadingController.complete(\"feed-page\")"), "usable feed arrival must drive the weighted progress controller");
assert(html.includes("function beginInSessionLoading(label)"), "one shared ring controller must cover in-session hydration");
assert(html.includes("LOADING_PROGRESS?.INDICATOR_DELAY_MS || 150") && html.includes("LOADING_PROGRESS?.INDICATOR_MIN_VISIBLE_MS || 300"), "in-session loading must suppress flicker with the agreed delay and minimum visibility");
for (const label of ["Loading Events", "Loading Standings", "Loading Standings & Fixtures", "Refreshing Feed", "Saving settings"]){
  assert(html.includes(`beginInSessionLoading(\"${label}\")`), `${label} must use the shared loading ring`);
}
assert(worker.includes('"/config/loading-progress.js"'), "the loading controller must be available offline");

console.log("Loading progress valid: weighted milestones, monotonic percentage, dynamic 3–6 second reveal and accessible ring passed.");
})().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
