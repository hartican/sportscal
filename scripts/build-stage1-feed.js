#!/usr/bin/env node

const {
  activeSportsFor,
  normalizeFeed,
  readJson,
  summarizeFeedHorizon,
  validateFeed,
  writeJson,
} = require("./lib/feed-utils");
const { rewriteFifaCards } = require("./rewrite-fifa-cards");
const { rewriteWimbledonCards } = require("./rewrite-wimbledon-cards");
const { enrichLegacyCards } = require("./enrich-legacy-cards");

const inputPath = process.argv[2] || "feeds/incoming/events.json";
const eventsOutPath = process.argv[3] || "data/events.json";
const metaOutPath = process.argv[4] || "data/feed-meta.json";

const output = normalizeFeed(
  enrichLegacyCards(
    rewriteWimbledonCards(
      rewriteFifaCards(readJson(inputPath))
    )
  )
);
const errors = validateFeed(output);

if (errors.length){
  console.error(`Refusing to build invalid stage-one feed from ${inputPath}:`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

let meta = {
  version: "unpublished",
  schemaVersion: "events.v1",
  publishedAt: output.publishedAt,
  eventsPath: "/data/events.json",
  activeSports: [],
  briefingWeekKey: "manual",
  usesBundledEvents: false,
};

try{
  meta = readJson(metaOutPath);
}catch(error){
  if (error.code !== "ENOENT") throw error;
}

const nextMeta = {
  ...meta,
  version: output.version,
  schemaVersion: output.schemaVersion,
  publishedAt: output.publishedAt,
  eventsPath: "/data/events.json",
  activeSports: activeSportsFor(output),
  feedHorizon: summarizeFeedHorizon(output, { basisDate: "2026-07-16" }),
  usesBundledEvents: false,
};

writeJson(eventsOutPath, output);
writeJson(metaOutPath, nextMeta);

console.log(`Built source-backed stage-one feed: ${output.events.length} events.`);
console.log(`FIFA cards: ${output.events.filter(event => event.key === "fifa").length}.`);
console.log(`Wimbledon cards: ${output.events.filter(event => event.key === "wimbledon").length}.`);
console.log(`Updated ${eventsOutPath} and ${metaOutPath}.`);
