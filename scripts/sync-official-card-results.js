#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { storylineFor, spoilerSafeRootCopy } = require("./lib/storyline-card-rules");

const ROOT = path.resolve(__dirname, "..");
const SNAPSHOT_PATH = path.join(ROOT, "data/canonical/official-card-results-2026.json");

function applyOfficialResults(events, snapshot){
  const results = new Map((snapshot.results || []).map(result => [result.id, result]));
  let count = 0;
  const nextEvents = events.map(event => {
    const result = results.get(event.id) || results.get(event.eventId);
    if (!result) return event;
    const next = {
      ...event,
      ...result,
      resultPublishedAt:event.resultPublishedAt || snapshot.checkedAt,
      sourceCheckedAt:snapshot.checkedAt,
      lastReviewedAt:snapshot.checkedAt,
      sourceType:"official",
      resultLabels:[event.roundLabel || event.stage || "Result", result.score, "Official result"],
    };
    delete next.id;
    const merged = { ...event, ...next };
    const storyline = storylineFor(merged);
    const safe = spoilerSafeRootCopy(merged, storyline);
    merged.storyline = storyline;
    merged.selectedSentence = safe.hook;
    merged.fullSpiel = safe.synopsis;
    delete merged.editorialPreview;
    if (JSON.stringify(merged) !== JSON.stringify(event)) count += 1;
    return merged;
  });
  return { events:nextEvents, count };
}

function main(){
  const inputPath = process.argv[2] || path.join(ROOT, "feeds/incoming/events.json");
  const outputPath = process.argv[3] || inputPath;
  const document = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8"));
  const applied = applyOfficialResults(document.events || [], snapshot);
  fs.writeFileSync(outputPath, `${JSON.stringify({ ...document, events:applied.events }, null, 2)}\n`);
  console.log(`Applied ${applied.count} source-backed official card results.`);
}

if (require.main === module) main();

module.exports = { applyOfficialResults };
