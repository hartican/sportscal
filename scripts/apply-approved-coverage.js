#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { normalizeFeed, validateFeed, writeJson } = require("./lib/feed-utils.js");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_APPROVED_PATH = path.join(ROOT, "data/coverage/approved-coverage.json");
const DEFAULT_FEED_PATH = path.join(ROOT, "feeds/incoming/events.json");

function readJson(filePath){
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function uniqueStrings(values){
  return Array.from(new Set((Array.isArray(values) ? values : []).map(value => String(value || "").trim()).filter(Boolean)));
}

function structuredBroadcast(option){
  const platformType = option.accessType === "free" ? "fta"
    : option.accessType === "ppv" ? "ppv"
      : option.accessType === "included" ? "streaming"
        : "unknown";
  return {
    serviceId: option.serviceId,
    broadcasterName: option.serviceLabel,
    platform: option.serviceLabel,
    platformType,
    accessType: option.accessType,
    region: option.territory,
    liveOrReplay: option.liveOrReplay,
    ...(option.channelBrand ? { channelBrand: option.channelBrand } : {}),
    sourceId: option.sourceId,
    sourceUrl: option.sourceUrl,
    observedAt: option.observedAt,
  };
}

function mergeBroadcasts(event, published){
  const options = published.broadcastsAu.map(structuredBroadcast);
  const existingBroadcasts = Array.isArray(event.broadcasts) ? event.broadcasts : [];
  const broadcastsById = new Map([...existingBroadcasts, ...options].map(option => [
    `${option.serviceId || option.broadcasterName || option.platform}|${option.accessType || option.platformType}|${option.region || option.territory || "AU"}`,
    option,
  ]));
  const labels = uniqueStrings([
    ...(event.broadcastOptions || []),
    ...published.broadcastsAu.map(option => option.serviceLabel),
  ]);
  const lineage = {
    candidateId: published.candidateId,
    sourceEvidence: published.sourceEvidence,
    reviewedBy: published.reviewedBy,
    reviewedAt: published.reviewedAt,
    note: published.note,
  };
  const coverageSources = new Map((Array.isArray(event.coverageSources) ? event.coverageSources : []).map(source => [source.candidateId, source]));
  coverageSources.set(lineage.candidateId, lineage);
  return {
    ...event,
    broadcaster: labels.join(", ") || event.broadcaster,
    broadcastOptions: labels,
    broadcasts: Array.from(broadcastsById.values()),
    coverageSources: Array.from(coverageSources.values()).sort((left, right) => left.candidateId.localeCompare(right.candidateId)),
  };
}

function applyApprovedCoverage(feedPayload, approved){
  if (approved?.schemaVersion !== "approved-coverage.v1") throw new Error("Unsupported approved coverage payload");
  const feed = normalizeFeed(feedPayload);
  const originalIssues = validateFeed(feed);
  if (originalIssues.length) throw new Error(`Refusing to apply coverage to an invalid feed: ${originalIssues.join("; ")}`);
  const byEventId = new Map(feed.events.map((event, index) => [event.eventId || event.id, index]));
  let availabilityUpdates = 0;
  let canonicalAdditions = 0;
  const events = [...feed.events];
  for (const published of approved.published || []) {
    if (!Array.isArray(published.broadcastsAu) || !published.broadcastsAu.length) throw new Error(`${published.candidateId} has no approved AU option`);
    if (published.publicationType === "availability_update") {
      const index = byEventId.get(published.canonicalEventId);
      if (index === undefined) throw new Error(`${published.candidateId} references missing canonical event ${published.canonicalEventId}`);
      events[index] = mergeBroadcasts(events[index], published);
      availabilityUpdates += 1;
    } else if (published.publicationType === "canonical_addition") {
      const canonicalEvent = published.canonicalEvent;
      if (!canonicalEvent?.eventId || byEventId.has(canonicalEvent.eventId)) throw new Error(`${published.candidateId} has a duplicate or missing canonical event ID`);
      const normalizedEvent = normalizeFeed({ ...feed, events: [canonicalEvent] }).events[0];
      events.push(mergeBroadcasts(normalizedEvent, published));
      byEventId.set(normalizedEvent.eventId, events.length - 1);
      canonicalAdditions += 1;
    } else {
      throw new Error(`${published.candidateId} has an unsupported publication type`);
    }
  }
  const result = { ...feed, events };
  const issues = validateFeed(result);
  if (issues.length) throw new Error(`Approved coverage produced an invalid feed: ${issues.join("; ")}`);
  return { feed: result, summary: { availabilityUpdates, canonicalAdditions } };
}

function main(argv = process.argv.slice(2)){
  const check = argv.includes("--check");
  const write = argv.includes("--write");
  const approvedArgument = argv.find(argument => argument.startsWith("--approved="));
  const feedArgument = argv.find(argument => argument.startsWith("--feed="));
  const approvedPath = approvedArgument ? path.resolve(ROOT, approvedArgument.split("=").slice(1).join("=")) : DEFAULT_APPROVED_PATH;
  const feedPath = feedArgument ? path.resolve(ROOT, feedArgument.split("=").slice(1).join("=")) : DEFAULT_FEED_PATH;
  const input = readJson(feedPath);
  const result = applyApprovedCoverage(input, readJson(approvedPath));
  const expected = `${JSON.stringify(result.feed, null, 2)}\n`;
  const current = `${JSON.stringify(normalizeFeed(input), null, 2)}\n`;
  if (check && current !== expected){
    console.error(`Approved coverage has not been applied to ${path.relative(ROOT, feedPath)}.`);
    process.exit(1);
  }
  if (write && current !== expected) writeJson(feedPath, result.feed);
  console.log(`Approved coverage valid: ${result.summary.availabilityUpdates} availability updates, ${result.summary.canonicalAdditions} canonical additions${write ? " applied" : check ? " current" : " ready"}.`);
}

if (require.main === module) main();

module.exports = { applyApprovedCoverage, mergeBroadcasts, structuredBroadcast };
