#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const FORBIDDEN_EDITORIAL = /^(?:Pinned from|Official schedule\b|Venue\s*:|Watch on\b|Broadcast(?:er)?\s*:)/i;
const TARGETS = [
  {
    code:"afl",
    canonicalId:"event:afl:cd_m20260142602",
    label:"Sydney Swans v Brisbane Lions",
    expectedHook:"Sydney's five straight wins meet Brisbane's three in a qualifying final that turns current form into a week-off prize.",
    expectMajorChild:true,
  },
  {
    code:"afl",
    canonicalId:"event:afl:cd_m20260142603",
    label:"Geelong Cats v Carlton",
    expectedHook:"Carlton's 1–8 rescue has one life left against a Geelong side that closed the season with six straight wins.",
    expectMajorChild:true,
  },
  {
    code:"nrl",
    canonicalId:"event:nrl:129992703",
    label:"Rabbitohs v Roosters",
    expectedHook:"Rabbitohs enter 6th and Roosters 4th; a direct finals-position contest.",
    expectMajorChild:false,
  },
];

function readJson(filePath){ return JSON.parse(fs.readFileSync(filePath, "utf8")); }
function normalizedId(value){ return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, ""); }
function aliases(record){
  return [record?.id, record?.eventId, record?.canonicalEventId, record?.stableMatchId, ...(record?.legacyEventIds || [])]
    .map(normalizedId)
    .filter(Boolean);
}
function matchesId(record, id){
  const wanted = normalizedId(id);
  return aliases(record).includes(wanted);
}
function narrativeFor(record){ return record?.editorialNarrative || null; }
function assertEditorial(record, label){
  const narrative = narrativeFor(record);
  assert(narrative, `${label} must carry baked editorial`);
  assert.match(narrative.schemaVersion || "", /^editorial-narrative\.v[23]$/, `${label} must use a validated editorial schema`);
  assert(narrative.hook && narrative.synopsis, `${label} must carry both an L0 hook and expanded synopsis`);
  assert(Array.isArray(narrative.factIds) && narrative.factIds.length, `${label} must retain researched fact provenance`);
  assert(Array.isArray(narrative.sourceIds) && narrative.sourceIds.length, `${label} must retain researched source provenance`);
  assert(!FORBIDDEN_EDITORIAL.test(narrative.hook), `${label} hook must not contain schedule, venue, provider or pin filler`);
  assert(!FORBIDDEN_EDITORIAL.test(narrative.synopsis), `${label} synopsis must not contain schedule, venue, provider or pin filler`);
}
function walkRecords(value, visit){
  if (!value || typeof value !== "object") return;
  if (!Array.isArray(value) && (value.selectedSentence || value.fullSpiel)) visit(value);
  Object.values(value).forEach(child => {
    if (child && typeof child === "object") walkRecords(child, visit);
  });
}

const feed = readJson("feeds/incoming/events.json").events || [];
const major = readJson("data/major-events.v1.json").events || [];
const queue = readJson("data/editorial-research-queue.v1.json").entries || [];
const codeFixtures = new Map();
for (const target of TARGETS){
  if (!codeFixtures.has(target.code)) codeFixtures.set(target.code, readJson(`data/code-inspector/${target.code}.json`).fixtures || []);
  const feedHits = feed.filter(record => matchesId(record, target.canonicalId));
  assert.equal(feedHits.length, 1, `${target.label} must resolve to one canonical Feed fixture`);
  assertEditorial(feedHits[0], `Feed ${target.label}`);
  assert.equal(feedHits[0].editorialNarrative.hook, target.expectedHook, `${target.label} must retain its fixture-specific researched hook`);

  const inspectorHits = codeFixtures.get(target.code).filter(record => matchesId(record, target.canonicalId));
  assert.equal(inspectorHits.length, 1, `${target.label} must resolve to one Inspector fixture after stable-id normalization`);
  assertEditorial(inspectorHits[0], `Inspector ${target.label}`);
  assert.equal(inspectorHits[0].editorialNarrative.hook, target.expectedHook, `${target.label} Inspector fixture must inherit the canonical Feed editorial`);

  const majorHits = major.flatMap(parent => (parent.subEvents || []).map(record => ({ parent, record })))
    .filter(({ record }) => matchesId(record, target.canonicalId));
  assert.equal(majorHits.length, target.expectMajorChild ? 1 : 0, `${target.label} must have the expected Events child identity`);
  majorHits.forEach(({ record }) => {
    assertEditorial(record, `Events ${target.label}`);
    assert.equal(record.editorialNarrative.hook, target.expectedHook, `${target.label} Events child must inherit the canonical Feed editorial`);
  });
}

const majorChildById = new Map(major.flatMap(parent => (parent.subEvents || []).map(record => [record.id, record])));
queue.filter(entry => entry.targetType === "major-event-child").forEach(entry => {
  const record = majorChildById.get(entry.targetId);
  assert(record, `queued Events child ${entry.targetId} must still exist in the generated catalogue`);
  if (record.editorialNarrative) assertEditorial(record, `Events child ${record.id}`);
  else assert.equal(entry.coverage, "missing", `unresolved Events child ${record.id} must remain explicitly queued as missing`);
});

walkRecords(major, record => {
  assert(!/^(?:Pinned from|Official schedule\b)/i.test(record.selectedSentence || ""), "generated Events selectedSentence must not expose pin or schedule filler");
  assert(!/^(?:Pinned from|Official schedule\b)/i.test(record.fullSpiel || ""), "generated Events fullSpiel must not expose pin or schedule filler");
});
for (const fixtures of codeFixtures.values()) walkRecords(fixtures, record => {
  assert(!/^(?:Pinned from|Official schedule\b)/i.test(record.selectedSentence || ""), "generated Inspector selectedSentence must not expose pin or schedule filler");
  assert(!/^(?:Pinned from|Official schedule\b)/i.test(record.fullSpiel || ""), "generated Inspector fullSpiel must not expose pin or schedule filler");
});

console.log(`Fixture editorial resolution valid: ${TARGETS.length} named regressions match canonical Feed editorial, and surfaced Events children either carry validated copy or enter the research queue.`);
