#!/usr/bin/env node

const path = require("path");
const {
  activeSportsFor,
  normalizeFeed,
  readJson,
  summarizeFeedHorizon,
  validateFeed,
  writeJson,
} = require("./lib/feed-utils");

const inputPath = process.argv[2] || "feeds/incoming/events.json";
const eventsOutPath = process.argv[3] || "data/events.json";
const metaOutPath = process.argv[4] || "data/feed-meta.json";

const feed = normalizeFeed(readJson(inputPath));
const errors = validateFeed(feed);

if (errors.length) {
  console.error(`Refusing to publish invalid feed from ${inputPath}:`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

let meta = {
  version: "unpublished",
  schemaVersion: "events.v1",
  publishedAt: new Date().toISOString(),
  eventsPath: "/data/events.json",
  activeSports: [],
  briefingWeekKey: "manual",
  usesBundledEvents: false,
};

try {
  meta = readJson(metaOutPath);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const nextMeta = {
  ...meta,
  version: feed.version,
  schemaVersion: feed.schemaVersion,
  publishedAt: feed.publishedAt,
  eventsPath: "/" + path.relative(process.cwd(), eventsOutPath).replace(/\\/g, "/"),
  activeSports: activeSportsFor(feed),
  feedHorizon: summarizeFeedHorizon(feed),
  usesBundledEvents: false,
};

writeJson(eventsOutPath, feed);
writeJson(metaOutPath, nextMeta);

console.log(`Published ${feed.events.length} events from ${inputPath}`);
console.log(`Updated ${eventsOutPath}`);
console.log(`Updated ${metaOutPath}`);
console.log(`Feed version: ${feed.version}`);
