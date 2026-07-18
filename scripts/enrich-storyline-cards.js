#!/usr/bin/env node

const path = require("path");
const { readJson, writeJson } = require("./lib/feed-utils");
const { lifecycleFor, participantsFor, storylineFor, isMajorCard } = require("./lib/storyline-card-rules");

const write = process.argv.includes("--write");
const inputs = ["feeds/incoming/events.json", "data/events.json"];
const reviewedAt = new Date().toISOString();
let total = 0;

inputs.forEach(input => {
  const feed = readJson(path.resolve(input));
  let updated = 0;
  feed.events = feed.events.map(event => {
    if (!isMajorCard(event)) return event;
    total += 1;
    updated += 1;
    const participants = participantsFor(event);
    return {
      ...event,
      status: lifecycleFor(event),
      ...(participants ? { participants } : {}),
      storyline: storylineFor(event),
      lastReviewedAt: reviewedAt,
    };
  });
  if (write) writeJson(path.resolve(input), feed);
  console.log(`${write ? "Enriched" : "Would enrich"} ${updated} major cards in ${input}.`);
});

console.log(`${write ? "Updated" : "Identified"} ${total} major-card records across the canonical and incoming feeds.`);
