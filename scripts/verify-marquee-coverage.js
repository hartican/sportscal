#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { readJson } = require("./lib/feed-utils");

const policyPath = path.resolve(process.argv[2] || "data/canonical/australian-marquee-events-2026.json");
const feedPath = path.resolve(process.argv[3] || "feeds/incoming/events.json");
const policy = readJson(policyPath);
const feed = readJson(feedPath);
const now = Date.parse(process.env.NOTHINGSPORTS_NOW || new Date().toISOString());

assert.equal(policy.schemaVersion, "australian-marquee-events.v1", "marquee policy schema must be supported");
assert(Array.isArray(policy.events) && policy.events.length > 0, "marquee policy must contain expected events");
assert(Array.isArray(policy.forbiddenEventIds), "marquee policy must declare superseded placeholder ids");
assert(Array.isArray(feed.events), "feed must contain events");

const failures = [];
const normalizedParticipants = event => (event.participants || [])
  .map(participant => String(participant?.name || "").trim().toLocaleLowerCase("en"))
  .filter(Boolean)
  .sort();

for (const expected of policy.events) {
  const matches = feed.events.filter(event => event.id === expected.id || event.eventId === expected.id);
  if (matches.length !== 1) {
    failures.push(`${expected.id}: expected exactly one card, found ${matches.length}`);
    continue;
  }
  const [event] = matches;
  for (const field of ["key", "name", "date", "time", "sourceUrl"]) {
    if (event[field] !== expected[field]) failures.push(`${expected.id}: ${field} must be ${JSON.stringify(expected[field])}`);
  }
  if (expected.surfacePinnedUntil && event.surfacePinnedUntil !== expected.surfacePinnedUntil) {
    failures.push(`${expected.id}: surfacePinnedUntil must be ${JSON.stringify(expected.surfacePinnedUntil)}`);
  }
  const actualParticipants = normalizedParticipants(event);
  const requiredParticipants = expected.participants.map(value => value.toLocaleLowerCase("en")).sort();
  if (JSON.stringify(actualParticipants) !== JSON.stringify(requiredParticipants)) {
    failures.push(`${expected.id}: participants must be ${expected.participants.join(" v ")}`);
  }
  if (event.sourceType !== "official") failures.push(`${expected.id}: sourceType must be official`);
  if (!/^https:\/\//.test(event.sourceUrl || "")) failures.push(`${expected.id}: sourceUrl must be https`);
  if (now >= Date.parse(expected.resultRequiredAfter)) {
    const missingResultFields = ["score", "outcomeText", "recapText", "sourceName", "sourceCheckedAt"]
      .filter(field => !event[field]);
    if (event.status !== "completed") failures.push(`${expected.id}: event is past its result deadline but is not completed`);
    if (missingResultFields.length) failures.push(`${expected.id}: missing result fields ${missingResultFields.join(", ")}`);
  }
}

for (const forbiddenId of policy.forbiddenEventIds) {
  if (feed.events.some(event => event.id === forbiddenId || event.eventId === forbiddenId)) {
    failures.push(`${forbiddenId}: superseded multi-match placeholder must not be published`);
  }
}

if (failures.length) {
  console.error("Australian marquee coverage failed:");
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Australian marquee coverage valid: ${policy.events.length} required one-match cards present; ${policy.forbiddenEventIds.length} superseded placeholders absent.`);
