#!/usr/bin/env node

const path = require("path");
const { isDeepStrictEqual } = require("node:util");
const { readJson, writeJson } = require("./lib/feed-utils");
const { lifecycleFor, participantsFor, spoilerSafeRootCopy, storylineFor, isMajorCard } = require("./lib/storyline-card-rules");

const write = process.argv.includes("--write");
const inputs = ["feeds/incoming/events.json", "data/events.json"];
const reviewedAt = new Date().toISOString();
let total = 0;

inputs.forEach(input => {
  const feed = readJson(path.resolve(input));
  let updated = 0;
  feed.events = feed.events.map(event => {
    const major = isMajorCard(event);
    const status = lifecycleFor(event);
    const participants = major ? participantsFor(event) : undefined;
    const storyline = major ? storylineFor(event) : event.storyline;
    const safeRoot = spoilerSafeRootCopy(event, storyline);
    const next = {
      ...event,
      status,
      ...(participants ? { participants } : {}),
      ...(storyline ? { storyline } : {}),
      selectedSentence: safeRoot.hook,
      fullSpiel: safeRoot.synopsis,
    };
    if (status === "completed") delete next.editorialPreview;
    if (!isDeepStrictEqual(next, event)) {
      updated += 1;
      if (major) next.lastReviewedAt = reviewedAt;
    }
    if (major) total += 1;
    return next;
  });
  if (write) writeJson(path.resolve(input), feed);
  console.log(`${write ? "Updated" : "Would update"} ${updated} cards in ${input}.`);
});

console.log(`${write ? "Checked" : "Identified"} ${total} major-card records across the canonical and incoming feeds.`);
