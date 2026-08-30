#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  editorialConsequenceReadyForCard,
  editorialNarrativeReadyForCard,
} = require("../config/enrichment-engine.js");

function readJson(filePath){
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function identities(record){
  return [record?.id, record?.eventId, record?.canonicalEventId].map(String).filter(Boolean);
}

function byIdentity(records){
  const result = new Map();
  records.forEach(record => identities(record).forEach(id => result.set(id, record)));
  return result;
}

const incoming = readJson("feeds/incoming/events.json");
const published = readJson("data/events.json");
const majorEvents = readJson("data/major-events.v1.json");
const knowledge = readJson("data/editorial-knowledge.v1.json");

assert.equal(typeof editorialNarrativeReadyForCard, "function", "the browser-loaded enrichment engine must export the narrative display predicate");
assert.equal(typeof editorialConsequenceReadyForCard, "function", "the browser-loaded enrichment engine must export the consequence display predicate");

const incomingById = byIdentity(incoming.events || []);
const publishedById = byIdentity(published.events || []);
const majorById = byIdentity(majorEvents.events || []);
const resolved = [];

for (const projection of knowledge.eventProjections || []){
  const candidates = projection.targetType === "major-event" ? [majorById] : [incomingById, publishedById];
  for (const records of candidates){
    const record = projection.targetIds.map(id => records.get(id)).find(Boolean);
    assert(record, `${projection.id} must resolve to its published ${projection.targetType} record`);
    assert(
      editorialNarrativeReadyForCard(record.editorialNarrative),
      `${projection.id} ${record.editorialNarrative?.schemaVersion || "missing"} narrative must remain displayable`,
    );
    if (record.editorialNarrative?.consequence){
      assert(editorialConsequenceReadyForCard(record.editorialNarrative), `${projection.id} consequence must remain displayable`);
    }
    resolved.push(record);
  }
}

const researched = [...(published.events || []), ...(majorEvents.events || [])]
  .filter(record => record.editorialNarrative?.generationMode === "researched");
const visible = researched.filter(record => editorialNarrativeReadyForCard(record.editorialNarrative));
assert.equal(visible.length, researched.length, "every researched narrative shipped to the app must pass the exact browser display gate");

assert(editorialNarrativeReadyForCard({
  schemaVersion:"editorial-narrative.v1",
  generationMode:"legacy",
  hook:"A validated legacy hook.",
  synopsis:"A validated legacy synopsis.",
}), "v1 compatibility must remain available");
assert(editorialNarrativeReadyForCard({
  schemaVersion:"editorial-narrative.v2",
  generationMode:"researched",
  hook:"A sourced hook.",
  synopsis:"A sourced synopsis.",
  factIds:["fact:test"],
  sourceIds:["source:test"],
}), "researched v2 must not depend on v3 consequence coverage");
assert(!editorialNarrativeReadyForCard({
  schemaVersion:"editorial-narrative.v2",
  generationMode:"researched",
  hook:"Schedule filler.",
  synopsis:"Schedule filler.",
  factIds:[],
  sourceIds:[],
}), "unsourced researched filler must fail closed");
assert(!editorialConsequenceReadyForCard({
  schemaVersion:"editorial-narrative.v3",
  consequence:{ schemaVersion:"editorial-consequence.v1" },
}), "an incomplete consequence must fail without hiding the base narrative");

console.log(`Editorial render coverage passed: ${visible.length}/${researched.length} researched records display; ${resolved.length} projected publication targets use the shared browser predicate.`);
