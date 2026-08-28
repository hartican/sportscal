#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("index.html", "utf8");

function sourceOf(name){
  const start = html.indexOf(`function ${name}(`);
  assert(start >= 0, `${name} must exist`);
  const opening = html.indexOf("{", start);
  let depth = 0;
  for (let index = opening; index < html.length; index += 1){
    if (html[index] === "{") depth += 1;
    if (html[index] === "}") depth -= 1;
    if (depth === 0) return html.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const keyedPatch = sourceOf("patchElementInPlace");
assert.match(keyedPatch, /finalizeLoadedIdentityImages\(element\)/, "keyed card patching must not put a fresh fallback beside a retained decoded logo");

const decoder = sourceOf("decodeIdentityImageInPlace");
assert.match(decoder, /image\.decode\(\)\.then\(reveal,\s*reveal\)/, "a successfully loaded identity must replace its fallback even when Safari rejects decode()");
assert.match(decoder, /image\.complete[\s\S]*image\.naturalWidth > 0/, "a cached identity that completed before listener attachment must still replace its fallback");

const finalizer = sourceOf("finalizeLoadedIdentityImage");
assert.match(finalizer, /IDENTITY_FALLBACK_SELECTOR[\s\S]*fallback\.remove\(\)/, "the shared loaded-image finalizer must remove the fallback before revealing the logo");

const stableKey = sourceOf("stableDescendantKey");
assert.match(stableKey, /dataset\.teamLogoLight[\s\S]*dataset\.eventLogoLight/, "keyed patches must identify logos by stable identity sources");
assert.match(stableKey, /identity-image-\(\?:pending\|decoded\)/, "temporary decode-state classes must not change a logo's stable patch identity");

const matchup = sourceOf("buildMatchupIdentity");
assert.match(matchup, /appendTeamIdentityFallback[\s\S]*applyTeamLogoAsset/, "matchup logos must use the shared fallback and loaded-image lifecycle");

const title = sourceOf("renderEventTitleIdentity");
assert.match(title, /appendTeamIdentityFallback[\s\S]*applyTeamLogoAsset/, "inline team logos must use the shared fallback and loaded-image lifecycle");

function imageHarness({ complete = false } = {}){
  const classes = new Set();
  const listeners = {};
  const frame = {
    fallbacks:[],
    querySelectorAll(){ return this.fallbacks; },
  };
  const image = {
    complete,
    naturalWidth:complete ? 128 : 0,
    isConnected:true,
    hidden:true,
    dataset:{},
    classList:{
      add(...names){ names.forEach(name => classes.add(name)); },
      remove(...names){ names.forEach(name => classes.delete(name)); },
      contains(name){ return classes.has(name); },
    },
    addEventListener(type, listener){ listeners[type] = listener; },
    closest(){ return frame; },
    decode(){ return Promise.reject(new Error("Safari decode rejection")); },
  };
  const addFallback = () => {
    const fallback = { removed:false, remove(){ this.removed = true; } };
    frame.fallbacks = [fallback];
    return fallback;
  };
  return { image, listeners, frame, classes, addFallback };
}

async function runLifecycleRegression(){
  const context = { window:{ queueMicrotask(callback){ callback(); } } };
  vm.createContext(context);
  vm.runInContext(`const IDENTITY_IMAGE_SELECTOR = "img"; const IDENTITY_FRAME_SELECTOR = "frame"; const IDENTITY_FALLBACK_SELECTOR = "fallback";\n${sourceOf("finalizeLoadedIdentityImage")}\n${sourceOf("finalizeLoadedIdentityImages")}\n${decoder}\nglobalThis.install = decodeIdentityImageInPlace; globalThis.finalizeAll = finalizeLoadedIdentityImages;`, context);

  const loaded = imageHarness();
  const loadedFallback = loaded.addFallback();
  context.install(loaded.image);
  loaded.image.complete = true;
  loaded.image.naturalWidth = 128;
  loaded.listeners.load();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(loadedFallback.removed, true, "decode rejection after a successful load must still remove the fallback");
  assert.equal(loaded.image.hidden, false, "the successfully loaded logo must be visible");

  const reintroducedFallback = loaded.addFallback();
  context.finalizeAll({ querySelectorAll(){ return [loaded.image]; } });
  assert.equal(reintroducedFallback.removed, true, "keyed patching must remove a freshly reintroduced fallback beside a retained decoded logo");

  const cached = imageHarness({ complete:true });
  const cachedFallback = cached.addFallback();
  context.install(cached.image);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(cachedFallback.removed, true, "an already-complete cached logo must remove its fallback without another load event");
}

runLifecycleRegression().then(() => {
  console.log("Identity fallback lifecycle valid: loaded, cached and retained logos always replace temporary fallbacks.");
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
