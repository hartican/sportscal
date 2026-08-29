#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  applyToFeedEvent,
  applyToMajorEvent,
  indexesFor,
  projectionForTarget,
  validateKnowledge,
} = require("./lib/editorial-narrative.js");

const WRITE = process.argv.includes("--write");
const KNOWLEDGE_PATH = path.resolve("data/editorial-knowledge.v1.json");
const FEED_PATH = path.resolve("feeds/incoming/events.json");
const MAJOR_EVENTS_PATH = path.resolve("data/major-events.v1.json");

function readJson(filePath){ return JSON.parse(fs.readFileSync(filePath, "utf8")); }
function writeJson(filePath, value){ fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`); }

function main(){
  const knowledge = readJson(KNOWLEDGE_PATH);
  const issues = validateKnowledge(knowledge);
  if (issues.length) throw new Error(`Editorial knowledge invalid:\n- ${issues.join("\n- ")}`);
  const indexes = indexesFor(knowledge);

  const feed = readJson(FEED_PATH);
  let feedApplied = 0;
  feed.events = feed.events.map(event => {
    const projection = projectionForTarget(knowledge, "feed-event", event);
    if (!projection) return event;
    feedApplied += 1;
    return applyToFeedEvent(event, projection, indexes);
  });

  const majorEvents = readJson(MAJOR_EVENTS_PATH);
  let majorApplied = 0;
  majorEvents.events = majorEvents.events.map(record => {
    const projection = projectionForTarget(knowledge, "major-event", record);
    if (!projection) return record;
    majorApplied += 1;
    return applyToMajorEvent(record, projection, indexes);
  });

  const expectedFeed = new Set(knowledge.eventProjections.filter(item => item.targetType === "feed-event").flatMap(item => item.targetIds));
  const expectedMajor = new Set(knowledge.eventProjections.filter(item => item.targetType === "major-event").flatMap(item => item.targetIds));
  const foundFeed = new Set(feed.events.flatMap(event => [event.id, event.eventId]).filter(id => expectedFeed.has(id)));
  const foundMajor = new Set(majorEvents.events.map(record => record.id).filter(id => expectedMajor.has(id)));
  const missing = [...expectedFeed].filter(id => !foundFeed.has(id)).concat([...expectedMajor].filter(id => !foundMajor.has(id)));
  if (missing.length) throw new Error(`Editorial projections reference missing targets: ${missing.join(", ")}`);

  if (WRITE){
    writeJson(FEED_PATH, feed);
    writeJson(MAJOR_EVENTS_PATH, majorEvents);
  }
  console.log(`${WRITE ? "Applied" : "Would apply"} ${feedApplied} feed and ${majorApplied} major-event editorial projections.`);
}

if (require.main === module){
  try { main(); }
  catch (error){ console.error(error.message); process.exitCode = 1; }
}
