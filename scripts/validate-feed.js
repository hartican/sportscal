#!/usr/bin/env node

const { normalizeFeed, readJson, validateFeed } = require("./lib/feed-utils");

const inputPath = process.argv[2] || "data/events.json";
const feed = normalizeFeed(readJson(inputPath));
const errors = validateFeed(feed);

if (errors.length) {
  console.error(`Feed validation failed for ${inputPath}:`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

const sportCounts = feed.events.reduce((counts, event) => {
  counts[event.key] = (counts[event.key] || 0) + 1;
  return counts;
}, {});
const copyReviewSummary = feed.events.reduce((summary, event) => {
  if (!event.copyReview) return summary;
  if (event.copyReview.reviewRequired) summary.required += 1;
  if (event.copyReview.reviewRequired && !event.copyReview.reviewComplete) summary.pending += 1;
  if (event.copyReview.reviewRequired && event.copyReview.reviewComplete) summary.complete += 1;
  return summary;
}, { required: 0, pending: 0, complete: 0 });

console.log(`Feed valid: ${inputPath}`);
console.log(`Version: ${feed.version}`);
console.log(`Events: ${feed.events.length}`);
console.log(`Sports: ${Object.entries(sportCounts).map(([key, count]) => `${key}:${count}`).join(", ")}`);
if (copyReviewSummary.required) {
  console.log(`Copy review: required:${copyReviewSummary.required}, pending:${copyReviewSummary.pending}, complete:${copyReviewSummary.complete}`);
}
