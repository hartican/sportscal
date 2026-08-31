#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const { safeSignal, validateSnapshot } = require("./snapshot-editorial-nothingscore");
const { nextLinkedProjection, updateAudienceMemories } = require("./update-editorial-audience-memory");
const { validateKnowledge } = require("./lib/editorial-narrative");

const readJson = file => JSON.parse(fs.readFileSync(file, "utf8"));
const clone = value => JSON.parse(JSON.stringify(value));
const knowledge = readJson("data/editorial-knowledge.v1.json");
const feed = readJson("feeds/incoming/events.json");
const major = readJson("data/major-events.v1.json");
const capturedAt = "2026-08-30T06:00:00.000Z";
const sourceEventId = "rugby-argentina-australia-jujuy-2026-08-30";
const raw = {
  eventId:sourceEventId,
  canonicalEventId:sourceEventId,
  phase:"impact",
  contributors:[{ userId:"must-not-survive", profileId:"profile:secret" }],
  aggregates:{
    heat:{ score:4.2, support:5, contributorCount:4, leadingTags:[{ tag:"Rivalry", support:3 }] },
    pulse:{ score:4.4, support:4, uniqueContributors:4, leadingTags:[] },
    impact:{ score:4.3, support:5, contributorCount:3, leadingTags:[{ tag:"Emotional", support:3 }, { tag:"Pure chaos", support:2 }] },
  },
};
const safe = safeSignal(raw, capturedAt);
assert.doesNotMatch(JSON.stringify(safe), /must-not-survive|profile:secret|userId|profileId|persona|rawRatings/, "aggregate snapshots must contain no contributor identity or raw-rating detail");
assert.equal(validateSnapshot({ schemaVersion:"editorial-nothingscore-snapshot.v1", capturedAt, source:"fixture", signals:[safe] }).length, 0);

const sourceProjection = knowledge.eventProjections.find(projection => projection.targetIds.includes(sourceEventId));
const explicitNext = nextLinkedProjection(knowledge, sourceProjection, [...feed.events, ...major.events]);
assert.equal(explicitNext?.id, "projection:feed:argentina-australia-mendoza-2026", "carry must use the next projection with an explicit shared narrative thread");

const belowThreshold = clone(safe);
belowThreshold.impact.uniqueContributorCount = 2;
const hidden = updateAudienceMemories(clone(knowledge), { capturedAt, signals:[belowThreshold] }, feed, major, new Date(capturedAt));
assert.equal(hidden.audienceMemories.length, 0, "Impact below three unique contributors must remain hidden");

const qualified = updateAudienceMemories(clone(knowledge), { capturedAt, signals:[safe] }, feed, major, new Date(capturedAt));
assert.equal(qualified.audienceMemories.length, 1);
const memory = qualified.audienceMemories[0];
assert.equal(memory.uniqueContributorCount, 3);
assert.deepEqual(memory.leadingTags, ["Emotional", "Pure chaos"]);
assert.equal(memory.carryProjectionId, explicitNext.id);
assert(sourceProjection.id !== explicitNext.id);
assert.equal(qualified.eventProjections.find(item => item.id === sourceProjection.id).audienceMemoryId, memory.id);
assert.equal(qualified.eventProjections.find(item => item.id === explicitNext.id).audienceMemoryId, memory.id);
assert(Date.parse(memory.expiresAt) <= Date.parse("2026-09-06T10:00:00.000Z"), "carried memory must expire no later than the linked event finish");
assert.deepEqual(validateKnowledge(qualified), []);

const unsafe = clone(qualified);
unsafe.audienceMemories[0].userId = "forbidden";
assert(validateKnowledge(unsafe).some(issue => issue.includes("forbidden identity")), "the knowledge gate must reject identity fields in audience memory");
const expired = updateAudienceMemories(clone(qualified), { capturedAt:"2027-01-01T00:00:00.000Z", signals:[] }, feed, major, new Date("2027-01-01T00:00:00.000Z"));
assert.equal(expired.audienceMemories.length, 0, "expired memory must be removed rather than becoming a history list");
assert(!expired.eventProjections.some(projection => projection.audienceMemoryId), "expired projection references must be removed");

const html = fs.readFileSync("index.html", "utf8");
const enrichment = fs.readFileSync("config/enrichment-engine.js", "utf8");
const internalNothingscore = fs.readFileSync("config/nothingscore.js", "utf8");
assert(!html.includes("Pilot contributors"));
assert(!/name:\s*"Heat"|Heat can help/.test(html));
assert(!/Heat blended/.test(enrichment));
assert.match(html, /name:"How do you think it’ll go\?"/);
assert.match(internalNothingscore, /PHASES = Object\.freeze\(\["heat",\s*"pulse",\s*"impact"\]\)/, "internal nothingscore.v1 phase must remain heat");
assert.doesNotMatch(html, /label\.textContent = "Sentiment"/, "privacy-safe Sentiment memory must remain stored but invisible while the crowd-results structure is being refined");
assert.doesNotMatch(html, /if \(state !== "compact"\)[\s\S]{0,240}buildEditorialSentiment\(ev\)/, "NSC aggregate Sentiment must not appear on event cards");
assert.doesNotMatch(html, /buildEditorialSentiment\(record\)[\s\S]{0,120}identity\.appendChild\(sentiment\)/, "NSC aggregate Sentiment must not appear on major-event cards");
assert.match(html, /Editorial standards/);
assert(!html.includes("Official sources"), "research citations must stay out of cards");
assert(!html.includes('script src="scripts/snapshot-editorial-nothingscore.js"'), "server aggregate work must add no startup request");

console.log("Editorial Sentiment valid: aggregate-only snapshot, three-contributor threshold, explicit one-chapter carry, expiry, hidden presentation and internal heat compatibility passed.");
