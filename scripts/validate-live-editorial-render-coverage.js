#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const vm = require("node:vm");

const baseUrl = String(process.argv[2] || process.env.WEBSITE_URL || "https://nothingsport.vercel.app").replace(/\/$/, "");

async function textAt(pathname){
  const response = await fetch(`${baseUrl}${pathname}`, { headers:{ "cache-control":"no-cache" } });
  if (!response.ok) throw new Error(`${pathname} returned HTTP ${response.status}`);
  return response.text();
}

async function jsonAt(pathname){
  return JSON.parse(await textAt(pathname));
}

async function main(){
  const nonce = `editorial-${Date.now()}`;
  const [html, enrichmentSource, feed, majorEvents] = await Promise.all([
    textAt(`/?${nonce}`),
    textAt(`/config/enrichment-engine.js?${nonce}`),
    jsonAt(`/data/events.json?${nonce}`),
    jsonAt(`/data/major-events.v1.json?${nonce}`),
  ]);
  assert.match(html, /ENRICHMENT_ENGINE\?\.editorialNarrativeReadyForCard\?\.\(narrative\)/, "production shell must call the shared narrative display predicate");
  assert.match(html, /ENRICHMENT_ENGINE\?\.editorialConsequenceReadyForCard\?\.\(narrative\)/, "production shell must keep consequence display independent");

  const context = { globalThis:{} };
  context.globalThis.globalThis = context.globalThis;
  vm.createContext(context);
  vm.runInContext(enrichmentSource, context, { filename:"production-enrichment-engine.js" });
  const engine = context.globalThis.NOTHINGSPORTS_ENRICHMENT_ENGINE;
  assert.equal(typeof engine?.editorialNarrativeReadyForCard, "function", "production enrichment engine must export the narrative display predicate");

  const records = [...(feed.events || []), ...(majorEvents.events || [])];
  const researched = records.filter(record => record.editorialNarrative?.generationMode === "researched");
  const visible = researched.filter(record => engine.editorialNarrativeReadyForCard(record.editorialNarrative));
  assert.equal(visible.length, researched.length, "production must not ship researched editorial that its browser gate hides");
  console.log(`Live editorial render coverage passed at ${baseUrl}: ${visible.length}/${researched.length} researched records display.`);
}

main().catch(error => {
  console.error(`Live editorial render coverage failed: ${error.message}`);
  process.exitCode = 1;
});
