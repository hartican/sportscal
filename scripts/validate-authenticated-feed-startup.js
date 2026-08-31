#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function functionSource(source, name){
  const marker = `async function ${name}(`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`${name} was not found`);
  const nextFunction = source.indexOf("\nasync function requestFeedRebuildAfterFollowChange", start);
  if (nextFunction < 0) throw new Error(`${name} was incomplete`);
  return source.slice(start, nextFunction).trim();
}

async function run(){
  const html = fs.readFileSync("index.html", "utf8");
  const source = functionSource(html, "refreshRemoteFeed");
  const calls = { personalised:0, public:0 };
  const context = {
    TextEncoder,
    URLSearchParams,
    console:{ warn(){} },
    globalThis:{ location:{ protocol:"https:" } },
    serverSyncClient:{
      getSession(){ return { access_token:"restored-session" }; },
      async loadFeed(){
        calls.personalised += 1;
        return { schemaVersion:"server-feed.v3", events:[], derivedCardCache:{ buildOrigin:"server", derivedCards:[] } };
      },
    },
    serverPersistence:{ state:"checking", user:null },
    startupFunnelFinished:false,
    FEED_PAGE_SIZE:20,
    FEED_CONFIG:{ manifestUrl:"/data/feed/manifest.json" },
    EVENTS:[],
    activeEvents:[],
    derivedCardCache:{ derivedCards:[] },
    feedPerformanceMetrics:{},
    feedPerformanceNow:() => 0,
    beginInSessionLoading:() => null,
    showToast() {},
    publishFeedPerformanceMetrics() {},
    cachePersonalisedFeedPayload() {},
    applyServerFeed(){ return { source:"server", eventCount:0, cardCount:0, rendered:true }; },
    async fetchJson(path){
      calls.public += 1;
      if (path.includes("manifest")) return { schemaVersion:"public-feed.v2", sourceVersion:"test", pages:[{ path:"/page-1.json" }] };
      return { events:[{ id:"public-only" }] };
    },
    coerceEventList:payload => payload.events || [],
    applyFeedEvents:events => { context.activeEvents = events; return true; },
    warmNextFeedPageDuringIdle() {},
    setServerPersistence(patch){ context.serverPersistence = { ...context.serverPersistence, ...patch }; },
    async loadLatestBundledEvents(){ return []; },
    recordFeedInteraction() {},
  };
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.refreshRemoteFeed = refreshRemoteFeed;`, context);
  const result = await context.refreshRemoteFeed({ quiet:true, signedInHint:true });

  assert.equal(calls.personalised, 1, "a restored authenticated session must request the personalised Feed while account hydration is still checking");
  assert.equal(calls.public, 0, "a restored authenticated session must never flash or settle on the public Feed during startup");
  assert.equal(result.source, "server", "authenticated startup must apply the central follow-derived Feed");

  console.log("Authenticated startup uses the personalised Feed before account hydration settles.");
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
