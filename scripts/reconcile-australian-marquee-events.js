#!/usr/bin/env node

"use strict";

const path = require("node:path");
const { normalizeFeed, readJson, validateFeed, writeJson } = require("./lib/feed-utils");
const { spoilerSafeRootCopy, storylineFor } = require("./lib/storyline-card-rules");

const policyPath = path.resolve(process.argv[2] || "data/canonical/australian-marquee-events-2026.json");
const inputPath = path.resolve(process.argv[3] || "feeds/incoming/events.json");
const outputPath = path.resolve(process.argv[4] || inputPath);
const policy = readJson(policyPath);
const feed = normalizeFeed(readJson(inputPath));
const reviewedAt = policy.reviewedAt;

const resultById = Object.freeze({
  "cwg-glasgow-2026-netball-new-zealand-england-semifinal": {
    score: "New Zealand 61-54 England",
    outcomeText: "New Zealand defeated England 61-54 in the first netball semifinal.",
    recapText: "New Zealand won the first Glasgow 2026 netball semifinal 61-54 to progress to the gold-medal match, sending England to the bronze playoff.",
    resultLabels: ["Netball semifinal", "New Zealand by 7", "Official result"],
  },
  "cwg-glasgow-2026-netball-australia-jamaica-semifinal": {
    score: "Australia 45-46 Jamaica",
    outcomeText: "Jamaica defeated Australia 46-45 in the second netball semifinal.",
    recapText: "Jamaica edged Australia by one goal in the second Glasgow 2026 netball semifinal to reach the gold-medal match, sending the Diamonds to the bronze playoff.",
    resultLabels: ["Netball semifinal", "Jamaica by 1", "Official result"],
  },
  "cwg-glasgow-2026-netball-australia-england-bronze": {
    score: "Australia 68-50 England",
    outcomeText: "Australia defeated England 68-50 to win Commonwealth Games netball bronze.",
    recapText: "The Diamonds rebounded from their one-goal semifinal defeat with an 18-goal victory over England in the Glasgow 2026 bronze-medal match.",
    resultLabels: ["Netball bronze medal", "Australia by 18", "Official result"],
  },
  "cwg-glasgow-2026-netball-jamaica-new-zealand-gold": {
    score: "Jamaica 48-56 New Zealand",
    outcomeText: "New Zealand defeated Jamaica 56-48 to win Commonwealth Games netball gold.",
    recapText: "New Zealand beat Jamaica by eight goals in the Glasgow 2026 gold-medal match to win the Commonwealth title.",
    resultLabels: ["Netball gold medal", "New Zealand by 8", "Official result"],
  },
  "aflw-australia-ireland-2026-08-01": {
    score: "Australia 91-41 Ireland",
    outcomeText: "Australia defeated Ireland by 50 points in the inaugural AFLW international representative match.",
    recapText: "Australia won 13.13 (91) to 6.5 (41) before 9,017 people at North Sydney Oval, with Jasmine Garner named best on ground.",
    resultLabels: ["AFLW international", "Australia by 50", "Official result"],
  },
});

function eventShape(expected) {
  const isCwg = expected.key === "cwg";
  const result = resultById[expected.id];
  const completed = Boolean(result);
  const isSemifinal = /semifinal/.test(expected.id);
  const base = {
    id: expected.id,
    eventId: expected.id,
    sport: isCwg ? "Commonwealth Games" : "AFLW",
    key: expected.key,
    ...(isCwg ? { commonwealthDiscipline: "Netball" } : {}),
    name: expected.name,
    displayTitleCompact: expected.name,
    date: expected.date,
    time: expected.time,
    broadcaster: isCwg ? "Seven / 7plus" : "Fox Footy / Kayo Sports / Kayo Freebies / Binge",
    broadcastOptions: isCwg
      ? ["Seven / 7plus"]
      : ["Fox Footy", "Kayo Sports", "Kayo Freebies", "Binge"],
    expected: isCwg ? 10 : 9,
    venue: isCwg ? "The Hydro" : "North Sydney Oval",
    liveWindow: isCwg ? 4 : 3,
    round: isCwg ? (isSemifinal ? "semifinal" : "final") : "all",
    narrativeType: completed ? "post-match" : "pre-event",
    status: completed ? "completed" : "upcoming",
    participants: expected.participants.map((name, index) => ({ name, role: index === 0 ? "home" : "away" })),
    selectedSentence: completed
      ? `${expected.name} is complete; the key moments are protected until you choose to reveal them.`
      : "Jamaica and New Zealand meet for the Glasgow 2026 netball gold medal after winning contrasting semifinals.",
    fullSpiel: completed
      ? `${expected.name} is complete. The defining moments and result-aware recap are ready when you are, without giving anything away here.`
      : "The last netball match of Glasgow 2026 decides gold at The Hydro. Seven and 7plus carry the match live in Australia.",
    sourceName: isCwg ? "World Netball Commonwealth Games fixtures and results" : "AFL official Australia v Ireland match report",
    sourceUrl: expected.sourceUrl,
    sourceCheckedAt: reviewedAt,
    sourceType: "official",
    lastReviewedAt: reviewedAt,
    ...(expected.surfacePinnedUntil ? { surfacePinnedUntil: expected.surfacePinnedUntil } : {}),
    replayEligible: true,
    highlightEligible: true,
    briefingEligible: true,
    catchupEligible: true,
    ...(result || {}),
  };
  if (!completed) {
    base.editorialPreview = {
      status: "journalistic",
      angle: base.selectedSentence,
      contextSignals: [
        "Jamaica defeated Australia by one goal in the second semifinal.",
        "New Zealand defeated England by seven goals in the first semifinal."
      ],
      sourceName: base.sourceName,
      sourceUrl: base.sourceUrl,
      sourceCheckedAt: reviewedAt,
      needsPreviewRefresh: false,
      editorialWindowDays: 1
    };
  }
  base.storyline = storylineFor(base, new Date(reviewedAt));
  const safeRoot = spoilerSafeRootCopy(base, base.storyline, new Date(reviewedAt));
  base.selectedSentence = safeRoot.hook;
  base.fullSpiel = safeRoot.synopsis;
  return base;
}

const replacedIds = new Set([
  ...policy.forbiddenEventIds,
  ...policy.events.map(event => event.id),
]);
const marqueeCards = policy.events.map(eventShape);
const output = normalizeFeed({
  ...feed,
  version: "nothingsport-marquee-visibility-2026-08-03-v1",
  publishedAt: reviewedAt,
  sourceNote: "Curated cards plus official AFL/NRL fixtures, reconciled with the Australian-marquee policy and source-backed Glasgow 2026 netball finals.",
  events: [
    ...feed.events.filter(event => !replacedIds.has(event.id) && !replacedIds.has(event.eventId)),
    ...marqueeCards,
  ].sort((first, second) => `${first.date}T${first.time}${first.id}`.localeCompare(`${second.date}T${second.time}${second.id}`)),
});

const errors = validateFeed(output);
if (errors.length) {
  console.error("Refusing to write invalid Australian-marquee reconciliation:");
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

writeJson(outputPath, output);
console.log(`Reconciled ${marqueeCards.length} one-match Australian-marquee and selected-tournament finals cards.`);
console.log(path.relative(process.cwd(), outputPath));

module.exports = { eventShape, resultById };
