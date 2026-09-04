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
const majorEventContract = require("../config/major-events.js");
const competitionClassification = require("../config/competition-classification.js");

const WRITE = process.argv.includes("--write");
const KNOWLEDGE_PATH = path.resolve("data/editorial-knowledge.v1.json");
const FEED_PATH = path.resolve("feeds/incoming/events.json");
const PUBLISHED_FEED_PATH = path.resolve("data/events.json");
const MAJOR_EVENTS_PATH = path.resolve("data/major-events.v1.json");

function readJson(filePath){ return JSON.parse(fs.readFileSync(filePath, "utf8")); }
function writeJson(filePath, value){ fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`); }

function main(){
  const knowledge = readJson(KNOWLEDGE_PATH);
  const issues = validateKnowledge(knowledge);
  if (issues.length) throw new Error(`Editorial knowledge invalid:\n- ${issues.join("\n- ")}`);
  const indexes = indexesFor(knowledge);

  function applyFeed(document){
    let applied = 0;
    document.events = document.events.map(event => {
      const projection = projectionForTarget(knowledge, "feed-event", event);
      if (!projection) return event;
      applied += 1;
      return applyToFeedEvent(event, projection, indexes);
    });
    return applied;
  }
  const feed = readJson(FEED_PATH);
  const publishedFeed = readJson(PUBLISHED_FEED_PATH);
  const feedApplied = applyFeed(feed);
  applyFeed(publishedFeed);

  const majorEvents = readJson(MAJOR_EVENTS_PATH);
  let majorApplied = 0;
  let childApplied = 0;
  majorEvents.events = majorEvents.events.map(record => {
    const projection = projectionForTarget(knowledge, "major-event", record);
    const projectedParent = projection ? applyToMajorEvent(record, projection, indexes) : record;
    if (projection) majorApplied += 1;
    if (!Array.isArray(projectedParent.subEvents)) return projectedParent;
    return {
      ...projectedParent,
      subEvents:projectedParent.subEvents.map(subEvent => {
        const resolved = majorEventContract.editorialRecordForSubEvent(
          subEvent,
          projectedParent,
          [...feed.events, ...publishedFeed.events],
        );
        const narrative = resolved?.editorialNarrative;
        if (!narrative) return subEvent;
        childApplied += 1;
        return {
          ...subEvent,
          editorialNarrative:narrative,
          storyline:{
            ...(subEvent.storyline || {}),
            stakes:Number(subEvent.stakesScore || projectedParent.stakesScore || 5),
            hookSpoilerOff:narrative.hook,
            hookSpoilerOn:narrative.hook,
            synopsisSpoilerOff:narrative.synopsis,
            synopsisSpoilerOn:narrative.synopsis,
            arcStage:"preview",
          },
        };
      }),
    };
  });

  const expectedFeed = new Set(knowledge.eventProjections.filter(item => item.targetType === "feed-event").flatMap(item => item.targetIds));
  const expectedMajor = new Set(knowledge.eventProjections
    .filter(item => item.targetType === "major-event")
    .flatMap(item => item.targetIds)
    .filter(id => competitionClassification.belongsInEvents(id)));
  const foundFeed = new Set(feed.events.flatMap(event => [event.id, event.eventId]).filter(id => expectedFeed.has(id)));
  const foundMajor = new Set(majorEvents.events.map(record => record.id).filter(id => expectedMajor.has(id)));
  const missing = [...expectedFeed].filter(id => !foundFeed.has(id)).concat([...expectedMajor].filter(id => !foundMajor.has(id)));
  if (missing.length) throw new Error(`Editorial projections reference missing targets: ${missing.join(", ")}`);

  if (WRITE){
    writeJson(FEED_PATH, feed);
    writeJson(PUBLISHED_FEED_PATH, publishedFeed);
    writeJson(MAJOR_EVENTS_PATH, majorEvents);
  }
  console.log(`${WRITE ? "Applied" : "Would apply"} ${feedApplied} feed, ${majorApplied} major-event and ${childApplied} fixture-child editorial projections.`);
}

if (require.main === module){
  try { main(); }
  catch (error){ console.error(error.message); process.exitCode = 1; }
}
