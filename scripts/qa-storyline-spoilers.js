#!/usr/bin/env node

const { readJson } = require("./lib/feed-utils");
const { RESULT_LEAK, PREVIEW_LEAK, PREVIEW_TENSE, lifecycleFor, stakesFor } = require("./lib/storyline-card-rules");

const inputPath = process.argv[2] || "data/events.json";
const feed = readJson(inputPath);
const now = new Date();
const errors = [];

function completed(event) {
  return lifecycleFor(event, now) === "completed";
}

function displayCopy(event, spoilersOn) {
  const storyline = event.storyline || {};
  if (!completed(event)) {
    return {
      hook: storyline.hookSpoilerOff || storyline.hookSpoilerOn || event.selectedSentence || "",
      synopsis: storyline.synopsisSpoilerOff || storyline.synopsisSpoilerOn || event.fullSpiel || "",
    };
  }
  if (spoilersOn) {
    return {
      hook: storyline.hookSpoilerOn || event.outcomeText || event.selectedSentence || "",
      synopsis: storyline.synopsisSpoilerOn || event.recapText || event.fullSpiel || "",
    };
  }
  const title = event.displayTitleCompact || event.name || "This event";
  return {
    hook: storyline.hookSpoilerOff || `${title} is complete, with the result protected until you choose to reveal it.`,
    synopsis: storyline.synopsisSpoilerOff || `${title} is complete. The key moments and result are ready when you are, without giving anything away here.`,
  };
}

const majorCards = feed.events.filter(event => stakesFor(event) >= 4);

majorCards.forEach(event => {
  const off = displayCopy(event, false);
  const on = displayCopy(event, true);
  const label = `(${event.id})`;

  if (!off.hook || !off.synopsis || !on.hook || !on.synopsis) {
    errors.push(`${label} is missing display copy.`);
  }
  if (completed(event)) {
    if (`${off.hook}\n${off.synopsis}` === `${on.hook}\n${on.synopsis}`) errors.push(`${label} completed-card spoiler ON/OFF copy is identical.`);
    if (RESULT_LEAK.test(`${off.hook}\n${off.synopsis}`)) errors.push(`${label} spoiler-off copy leaks a result.`);
    if (PREVIEW_TENSE.test(`${on.hook}\n${on.synopsis}`)) errors.push(`${label} completed card still reads as a preview.`);
  } else if (PREVIEW_LEAK.test(`${off.hook}\n${off.synopsis}\n${on.hook}\n${on.synopsis}`)) {
    errors.push(`${label} upcoming card contains result language.`);
  }

  if (event.storyline?.stakes >= 4) {
    const required = ["arcStage", "hookSpoilerOff", "hookSpoilerOn", "synopsisSpoilerOff", "synopsisSpoilerOn"];
    required.forEach(field => {
      if (!event.storyline[field]) errors.push(`${label} major Storyline card is missing storyline.${field}.`);
    });
    if (!event.lastReviewedAt) errors.push(`${label} major Storyline card is missing lastReviewedAt.`);
  }
});

if (errors.length) {
  console.error(`Storyline spoiler QA failed for ${inputPath}:`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

const completedCards = majorCards.filter(completed).length;
console.log(`Storyline spoiler QA passed: ${majorCards.length} major cards audited (${completedCards} completed, ${majorCards.length - completedCards} upcoming).`);
