#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const profileStorage = require("../config/profile-storage");
const disposableStorage = require("../config/disposable-storage");

class CountingStorage {
  constructor(entries = {}){
    this.values = new Map(Object.entries(entries));
    this.writes = 0;
    this.writeBytes = 0;
    this.failWrites = false;
  }

  getItem(key){
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value){
    if (this.failWrites){
      const error = new DOMException("Storage quota exceeded", "QuotaExceededError");
      throw error;
    }
    const text = String(value);
    this.values.set(key, text);
    this.writes += 1;
    this.writeBytes += Buffer.byteLength(text);
  }

  removeItem(key){
    this.values.delete(key);
  }

  resetMetrics(){
    this.writes = 0;
    this.writeBytes = 0;
  }
}

function read(relativePath){
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function validateProfileStorage(){
  assert.equal(profileStorage.PROFILE_SCHEMA_VERSION, 5, "durable profiles must use schema v5");
  assert.equal(typeof profileStorage.commitSections, "function", "profile storage must expose one transactional commitSections API");

  const storage = new CountingStorage();
  let bundle = profileStorage.loadActiveProfile(storage, { now: new Date("2026-08-24T00:00:00Z") });
  storage.resetMetrics();
  bundle = profileStorage.commitSections(storage, bundle, {
    preferences: { onboardingComplete: true, feedIntent: "balanced" },
    domainPreferences: [{ domainId: "sport:nrl", froth: 3 }],
    competitionPreferences: [],
    entityFollows: [],
    viewingPreference: { spoilers: "standard" },
    learningPreference: { version: 1 },
  }, { now: new Date("2026-08-24T00:01:00Z") });
  assert.equal(storage.writes, 1, "one settings save must perform one durable profile write");
  assert.equal(bundle.schemaVersion, 5);
  assert.equal(Object.prototype.hasOwnProperty.call(bundle, "surfacePresentation"), false, "surface history must not inflate the durable profile");

  storage.failWrites = true;
  assert.throws(
    () => profileStorage.commitSections(storage, bundle, { ratings: { example: 8 } }),
    error => error?.name === "QuotaExceededError",
    "quota errors must remain classifiable by the runtime"
  );

  const legacyStorage = new CountingStorage({
    ns_preferences_v1: JSON.stringify({
      onboardingComplete:true,
      feedIntent:"focused",
      selectedSelectorEntityIds:["sport:football", "competition:a-leagues"],
      preferenceGraph:{
        domainPreferences:[{ sportDomainId:"sport:football", mustWatchSensitivity:"high", editorialSensitivity:"medium" }],
        competitionPreferences:[{ competitionId:"competition:a-leagues", enabled:true }, { competitionId:"competition:premier-league", enabled:true }],
        entityFollows:[{ participantId:"team:football:sydney-fc", followLevel:"follow" }, { participantId:"team:football:epl:1", followLevel:"follow" }],
      },
    }),
    ns_ratings_v1: JSON.stringify({ fixture: 9 }),
    ns_event_user_state_v1: JSON.stringify({ fixture:{ mustWatch:true, mustWatchAddedAt:"2026-08-20T00:00:00Z", reminderRequested:true } }),
  });
  const migrated = profileStorage.loadActiveProfile(legacyStorage, { now: new Date("2026-08-24T00:02:00Z") });
  assert.equal(migrated.schemaVersion, 5);
  assert.equal(migrated.preferences.feedIntent, "focused");
  assert.equal(migrated.ratings.fixture, 9);
  assert(!migrated.preferences.selectedSelectorEntityIds.includes("competition:a-leagues"));
  assert.deepEqual(migrated.preferences.preferenceGraph.competitionPreferences.map(item => item.competitionId), ["competition:premier-league"]);
  assert.deepEqual(migrated.preferences.preferenceGraph.entityFollows.map(item => item.participantId), ["team:football:epl:1"]);
  assert.equal(Object.hasOwn(migrated.preferences.preferenceGraph.domainPreferences[0], "mustWatchSensitivity"), false, "legacy preference-level Must Watch fields must be discarded");
  assert.equal(Object.hasOwn(migrated.eventUserState.fixture, "mustWatch"), false, "legacy Must Watch fields must be accepted then discarded");
  assert.equal(migrated.eventUserState.fixture.reminderRequested, true, "unrelated legacy actions must survive migration");
  assert.equal(legacyStorage.getItem("ns_preferences_v1"), null, "legacy preferences may be removed only after the v5 bundle reads back successfully");
  const migratedAgain = profileStorage.loadActiveProfile(legacyStorage, { now: new Date("2026-08-24T00:03:00Z") });
  assert.deepEqual(migratedAgain.preferences, migrated.preferences, "legacy migration must be idempotent");

  const disabledStorage = {
    getItem(){ throw new DOMException("Storage is disabled", "SecurityError"); },
    setItem(){ throw new DOMException("Storage is disabled", "SecurityError"); },
    removeItem(){ throw new DOMException("Storage is disabled", "SecurityError"); },
  };
  assert.throws(
    () => profileStorage.loadActiveProfile(disabledStorage),
    error => error?.name === "SecurityError",
    "disabled durable storage must remain distinguishable from quota exhaustion"
  );
}

async function validateDisposableFallback(){
  let currentTime = 1_000_000;
  const store = disposableStorage.createStore({ indexedDB: null, now: () => currentTime });
  store.set("derivedCardCache", { ids: ["one"] }, { ttlMs: 60_000 });
  assert.deepEqual(store.initial("derivedCardCache", null), { ids: ["one"] }, "disposable data must remain usable in memory when IndexedDB is blocked");
  assert.equal(await store.flush(), false, "a blocked IndexedDB write must be explicitly classifiable as a disposable-cache fallback");
  assert.deepEqual(await store.hydrate("derivedCardCache", null), { ids: ["one"] }, "failed disposable persistence must not discard the session cache");
  currentTime += 60_001;
  assert.deepEqual(store.initial("derivedCardCache", { ids: [] }), { ids: [] }, "expired in-memory disposable data must honour TTL");
}

function validateFeedContract(){
  const index = read("index.html");
  const serviceWorker = read("service-worker.js");
  const serverPipeline = read("lib/server-feed-pipeline.js");
  const manifestPath = path.join(ROOT, "data/feed/manifest.json");

  assert(serverPipeline.includes('SERVER_FEED_SCHEMA_VERSION = "server-feed.v3"'), "the server feed must publish v3");
  assert(fs.existsSync(manifestPath), "the anonymous paged feed manifest must be generated");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.schemaVersion, "public-feed.v2");
  assert.equal(manifest.pageSize, 20);
  assert(manifest.pages.length > 1, "the public feed must be split into multiple pages");
  const firstPagePath = path.join(ROOT, manifest.pages[0].path);
  assert(fs.statSync(firstPagePath).size <= 250 * 1024, "the first public feed page must remain under 250 KiB uncompressed");

  assert(index.includes("const FEED_PAGE_SIZE = 20"), "the browser must cap its initial feed window at 20 cards");
  assert(index.includes("const INITIAL_CARD_IMAGE_BUDGET = 4") && index.includes("assignCardImageSource"), "the browser must cap first-viewport card identity requests at four and defer the rest until interaction");
  assert(index.includes(".events-feed,") && index.includes("overflow-anchor:none"), "feed surfaces must preserve the reviewed scroll-anchor contract");
  assert(index.includes("feedPageObserver = new IntersectionObserver"), "feed pagination must be driven near the scroll boundary");
  assert(index.includes("appendFeedPageToCurrentList") && index.includes("append && appendFeedPageToCurrentList(events)"), "later feed pages must append targeted date groups instead of rerendering the whole feed");
  assert(index.includes("loadDeferredStartupContext"), "optional sporting context must be deferred until after the first feed is usable");
  assert(index.includes("profileStorageBootstrapError") && index.includes("retryDurableProfileWrite"), "blocked storage must retain an in-memory profile and retry after disposable eviction");
  assert(index.includes('kind: "disposable-cache"') && index.includes("flushDisposableStore"), "disposable-cache failures must be distinguished from durable quota and blocked-storage failures");
  assert(index.includes("JSON.stringify(verified) === JSON.stringify(migrated)"), "legacy disposable state must remain until IndexedDB read-back succeeds");
  assert(index.includes('schemaVersion: "feed-performance.v1"'), "the browser must expose privacy-safe session performance measurements");
  assert(serviceWorker.includes("staleWhileRevalidate"), "the service worker must use stale-while-revalidate for published data");
}

async function main(){
  validateProfileStorage();
  await validateDisposableFallback();
  validateFeedContract();
  console.log("Mission-critical Release 1 contract valid: one durable settings write, disposable state removed from the profile, and a 20-card paged feed with deferred context.");
}

if (require.main === module) main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

module.exports = { CountingStorage, validateDisposableFallback, validateFeedContract, validateProfileStorage };
