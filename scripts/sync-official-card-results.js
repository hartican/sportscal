#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { storylineFor, spoilerSafeRootCopy } = require("./lib/storyline-card-rules");

const ROOT = path.resolve(__dirname, "..");
const SNAPSHOT_PATH = path.join(ROOT, "data/canonical/official-card-results-2026.json");

// Exact recorded aliases, with the historical NRL finals spelling only.
// Do not use names or dates to join results to fixtures.
function resultAliases(event){
  return [...new Set([event.id, event.eventId, event.canonicalEventId, ...(event.sourceEventIds || [])]
    .filter(Boolean).flatMap(id => [id, String(id).replace(/^major-match:(nrl-finals-\d{4}):/, "major-match-$1-")]))];
}

function applyOfficialResults(events, snapshot){
  const results = new Map((snapshot.results || []).flatMap(result => resultAliases(result).map(id => [id, result])));
  let count = 0;
  const nextEvents = events.map(event => {
    const result = resultAliases(event).map(id => results.get(id)).find(Boolean);
    if (!result) return event;
    const next = {
      ...event,
      ...result,
      resultPublishedAt:event.resultPublishedAt || result.resultPublishedAt || result.sourceCheckedAt || snapshot.checkedAt,
      sourceCheckedAt:(!result.sourceUrl || result.sourceUrl === event.sourceUrl) && Date.parse(event.sourceCheckedAt) > Date.parse(result.sourceCheckedAt || snapshot.checkedAt) ? event.sourceCheckedAt : result.sourceCheckedAt || snapshot.checkedAt,
      lastReviewedAt:result.lastReviewedAt || result.sourceCheckedAt || snapshot.checkedAt,
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
  const output = applied.count ? {
    ...document,
    version:snapshot.feedVersion,
    // Result observation dates belong on the result, not the assembled Feed.
    // Backdating this clock makes retention validation use an obsolete window.
    events:applied.events,
  } : { ...document, events:applied.events };
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Applied ${applied.count} source-backed official card results.`);
}

if (require.main === module) main();

module.exports = { applyOfficialResults };
