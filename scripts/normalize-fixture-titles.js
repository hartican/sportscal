#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { canonicalFixtureTitle } = require("../config/enrichment-engine.js");

const targets = process.argv.slice(2);
const files = targets.length ? targets : ["feeds/incoming/events.json", "data/events.json"];
const titleFields = ["name", "displayTitleCompact", "spoilerSafeTitle", "revealedFixtureLabel"];
const narrativeFields = ["selectedSentence", "fullSpiel"];
const storylineFields = ["narrativeHook", "hookSpoilerOff", "hookSpoilerOn", "synopsisSpoilerOff", "synopsisSpoilerOn"];

function canonicalSeparator(value){
  return String(value || "")
    .replace(/\s+(?:vs\.?|versus)\s+/gi, " v ")
    .replace(/\s+[vV]\s+/g, " v ")
    .replace(/\s{2,}/g, " ");
}

function normalizeEvent(event){
  const sportKey = event.sportId || event.key;
  titleFields.forEach(field => {
    if (typeof event[field] === "string") event[field] = canonicalFixtureTitle(event[field], { sportKey });
  });
  narrativeFields.forEach(field => {
    if (typeof event[field] === "string") event[field] = canonicalSeparator(event[field]);
  });
  storylineFields.forEach(field => {
    if (typeof event.storyline?.[field] === "string"){
      event.storyline[field] = canonicalSeparator(event.storyline[field]);
    }
  });
  if (typeof event.calendarTemplate?.title === "string"){
    event.calendarTemplate.title = canonicalFixtureTitle(event.calendarTemplate.title, { sportKey });
  }
  return event;
}

files.forEach(file => {
  const absolute = path.resolve(file);
  const document = JSON.parse(fs.readFileSync(absolute, "utf8"));
  const events = Array.isArray(document) ? document : document.events;
  if (!Array.isArray(events)) throw new Error(`${file} does not contain an events array`);
  events.forEach(normalizeEvent);
  fs.writeFileSync(absolute, `${JSON.stringify(document, null, 2)}\n`);
  console.log(`Normalised ${events.length} fixture records in ${file}.`);
});
