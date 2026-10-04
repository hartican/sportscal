#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const DAY_MS = 86400000;
const REFERENCE = Date.parse(process.env.NS_EDITORIAL_REFERENCE || new Date().toISOString());
const feed = JSON.parse(fs.readFileSync("data/events.json", "utf8")).events;

function idFor(record){ return String(record?.eventId || record?.id || record?.canonicalEventId || ""); }
function eventTime(record){ return Date.parse(record?.startTimeUtc || `${record?.date || ""}T${record?.time || "00:00"}:00+10:00`); }
function stakesFor(record){
  const stored = Number(record?.storyline?.stakes || record?.stakesScore || 0);
  if (stored) return stored;
  const expected = Number(record?.expected || 0);
  return expected >= 10 ? 5 : expected >= 8 ? 4 : expected >= 6 ? 3 : expected >= 4 ? 2 : 1;
}
function sportFor(record){ return String(record?.sport || record?.sportKey || record?.key || "").toLowerCase(); }
function inRollingWindow(record, reference = REFERENCE){
  const start = eventTime(record);
  return Number.isFinite(start) && start >= reference - 7 * DAY_MS && start <= reference + 30 * DAY_MS;
}

const targets = feed.filter(record => {
  const sport = sportFor(record);
  if (sport.includes("football")) return stakesFor(record) >= 3 && inRollingWindow(record);
  if (sport === "afl") return stakesFor(record) >= 2 && inRollingWindow(record);
  if (sport === "cricket") return stakesFor(record) >= 3;
  return false;
});

const genericPatterns = [
  /chance to compress or widen/i,
  /\benter \d+(?:st|nd|rd|th) and .+ \d+(?:st|nd|rd|th)\b/i,
  /met in .+ with .+the outcome stays hidden/i,
  /late-season (?:contest|test)/i,
  /an australian test appointment/i,
  /opens a new test chapter/i,
  /keeps the sydney-local start, broadcast path/i,
];

assert(targets.length > 0, "the rolling catalogue must contain editorial targets; every current target is checked below and each sport must be represented");
function validateNarrative(record){
  const narrative = record.editorialNarrative;
  assert(narrative?.hook, `${idFor(record)} (${record.name}) needs a researched L0 hook`);
  assert(narrative?.synopsis, `${idFor(record)} (${record.name}) needs a researched L1/L2 narrative`);
  assert(!genericPatterns.some(pattern => pattern.test(narrative.hook)), `${idFor(record)} (${record.name}) still has a generic L0 hook: ${narrative.hook}`);
  assert(!genericPatterns.some(pattern => pattern.test(narrative.synopsis)), `${idFor(record)} (${record.name}) still has generic L1/L2 copy: ${narrative.synopsis}`);
}

for (const record of targets) validateNarrative(record);

// Keep the sport/copy regression without inventing an active match off-season.
// Every eligible current card remains checked; only a sport with no current
// target uses its most recent qualifying historical card as a retained sample.
const retainedSamples = [];
for (const sport of ["football", "cricket", "afl"]){
  if (targets.some(record => sportFor(record).includes(sport))) continue;
  const minimum = sport === "afl" ? 2 : 3;
  const sample = feed.filter(record => sportFor(record) === sport && stakesFor(record) >= minimum && eventTime(record) < REFERENCE)
    .sort((a,b) => eventTime(b) - eventTime(a))[0];
  assert(sample, `${sport} must have a current target or a qualifying retained historical sample`);
  validateNarrative(sample);
  assert(inRollingWindow(sample, eventTime(sample) + 7 * DAY_MS), "the last retained match must remain eligible at the seven-day boundary");
  assert(!inRollingWindow(sample, eventTime(sample) + 7 * DAY_MS + 1), "the completed season must age out of the current window");
  assert.throws(() => validateNarrative({...sample, editorialNarrative:{...sample.editorialNarrative, hook:"A late-season contest"}}), /generic L0/, "seasonal fallback must retain the generic-copy rejection");
  retainedSamples.push(idFor(sample));
}

console.log(`Editorial sport depth valid: ${targets.length} current targets and ${retainedSamples.length} retained off-season samples have non-generic L0 and L1/L2 narratives.`);
