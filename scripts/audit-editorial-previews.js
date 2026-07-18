#!/usr/bin/env node

const path = require("path");
const { readJson, writeJson } = require("./lib/feed-utils");
const { lifecycleFor, stakesFor } = require("./lib/storyline-card-rules");
const { EDITORIAL_WINDOW_DAYS, editorialPreviewDue, editorialPreviewIssues } = require("./lib/editorial-preview-quality");

const inputPath = process.argv[2] || "data/events.json";
const outputPath = process.argv[3] || "data/editorial-preview-audit.json";
const feed = readJson(path.resolve(inputPath));
const now = new Date();
const due = feed.events
  .map(event => ({ ...event, status: lifecycleFor(event, now) }))
  .filter(event => editorialPreviewDue(event, stakesFor(event), now));

const duplicateHooks = new Map();
due.forEach(event => {
  const hook = String(event.selectedSentence || "").trim().toLowerCase();
  if (!hook) return;
  duplicateHooks.set(hook, [...(duplicateHooks.get(hook) || []), event.id]);
});

const cards = due.map(event => {
  const issues = editorialPreviewIssues(event, stakesFor(event), now);
  const duplicates = duplicateHooks.get(String(event.selectedSentence || "").trim().toLowerCase()) || [];
  if (duplicates.length > 1) issues.push(`duplicate-hook:${duplicates.join(",")}`);
  return {
    id: event.id,
    name: event.name,
    sport: event.sport,
    date: event.date,
    stakes: stakesFor(event),
    status: event.editorialPreview?.status || "missing",
    contextSignals: event.editorialPreview?.contextSignals || [],
    sourceUrl: event.editorialPreview?.sourceUrl || event.sourceUrl,
    issues,
  };
});

const failed = cards.filter(card => card.issues.length);
writeJson(path.resolve(outputPath), {
  schemaVersion: "sportscal.editorial-preview-audit.v1",
  generatedAt: now.toISOString(),
  editorialWindowDays: EDITORIAL_WINDOW_DAYS,
  sourceFeed: `/${inputPath.replace(/^\/+/, "")}`,
  summary: { due: cards.length, passed: cards.length - failed.length, failed: failed.length },
  cards,
});

if (failed.length) {
  console.error(`Editorial preview QA failed for ${failed.length} of ${cards.length} cards:`);
  failed.forEach(card => console.error(`- ${card.id}: ${card.issues.join(", ")}`));
  process.exit(1);
}
console.log(`Editorial preview QA passed: ${cards.length} high-stakes cards inside the ${EDITORIAL_WINDOW_DAYS}-day window.`);
