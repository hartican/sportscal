#!/usr/bin/env node

const path = require("path");
const { readJson, writeJson } = require("./lib/feed-utils");
const { RESULT_LEAK, PREVIEW_LEAK, PREVIEW_TENSE, wordCount, lifecycleFor, stakesFor, isMajorCard } = require("./lib/storyline-card-rules");
const { editorialPreviewIssues } = require("./lib/editorial-preview-quality");

const inputPath = process.argv[2] || "data/events.json";
const outputPath = process.argv[3] || "data/card-audit.json";
const feed = readJson(path.resolve(inputPath));
const now = new Date();

function displayCopy(event, spoilersOn) {
  const storyline = event.storyline || {};
  if (lifecycleFor(event, now) === "upcoming") {
    return {
      hook: storyline.hookSpoilerOff || storyline.hookSpoilerOn || event.selectedSentence || "",
      synopsis: storyline.synopsisSpoilerOff || storyline.synopsisSpoilerOn || event.fullSpiel || "",
    };
  }
  return spoilersOn
    ? { hook: storyline.hookSpoilerOn || event.outcomeText || "", synopsis: storyline.synopsisSpoilerOn || event.recapText || "" }
    : { hook: storyline.hookSpoilerOff || "", synopsis: storyline.synopsisSpoilerOff || "" };
}

const cards = feed.events.filter(isMajorCard).map(event => {
  const status = lifecycleFor(event, now);
  const off = displayCopy(event, false);
  const on = displayCopy(event, true);
  const hasSpoilerOffCopy = Boolean(off.hook && off.synopsis);
  const hasSpoilerOnCopy = Boolean(on.hook && on.synopsis);
  const previewOnly = status === "completed" && PREVIEW_TENSE.test(`${on.hook} ${on.synopsis}`);
  const identicalSpoilerStates = status === "completed" && `${off.hook}\n${off.synopsis}` === `${on.hook}\n${on.synopsis}`;
  const leaksResult = status === "completed" && RESULT_LEAK.test(`${off.hook} ${off.synopsis}`);
  const upcomingResultLeak = status === "upcoming" && PREVIEW_LEAK.test(`${off.hook} ${off.synopsis} ${on.hook} ${on.synopsis}`);
  const copyLengthOverflow = wordCount(off.hook) > 25 || wordCount(on.hook) > 25 || wordCount(off.synopsis) > 80 || wordCount(on.synopsis) > 80;
  const matchup = /\s+v(?:s\.?)?\s+/i.test(event.name || "");
  const missingParticipants = matchup && (!Array.isArray(event.participants) || event.participants.length < 2 || event.participants.some(participant => !participant?.name || /^s\s+/i.test(participant.name)));
  const needsPreviewRefresh = status === "upcoming" && (!hasSpoilerOffCopy || !hasSpoilerOnCopy || upcomingResultLeak);
  const needsRecap = status === "completed" && (!hasSpoilerOffCopy || !hasSpoilerOnCopy || previewOnly || identicalSpoilerStates || leaksResult);
  const editorialIssues = editorialPreviewIssues({ ...event, status }, stakesFor(event), now);
  return {
    id: event.id,
    name: event.name,
    sport: event.sport,
    date: event.date,
    status,
    stakes: stakesFor(event),
    isMajorCard: true,
    hasSpoilerOffCopy,
    hasSpoilerOnCopy,
    needsPreviewRefresh,
    needsRecap,
    needsEditorialRefresh: editorialIssues.length > 0,
    isStale: needsPreviewRefresh || needsRecap || editorialIssues.length > 0 || !event.lastReviewedAt || copyLengthOverflow || missingParticipants,
    issues: [
      !event.lastReviewedAt && "missing-last-reviewed-at",
      previewOnly && "completed-preview-copy",
      identicalSpoilerStates && "identical-completed-spoiler-copy",
      leaksResult && "spoiler-off-result-leak",
      upcomingResultLeak && "upcoming-result-language",
      copyLengthOverflow && "copy-length-overflow",
      missingParticipants && "missing-participants",
      ...editorialIssues,
    ].filter(Boolean),
  };
});

const summary = {
  totalMajorCards: cards.length,
  completed: cards.filter(card => card.status === "completed").length,
  upcoming: cards.filter(card => card.status === "upcoming").length,
  stale: cards.filter(card => card.isStale).length,
  needsRecap: cards.filter(card => card.needsRecap).length,
  needsPreviewRefresh: cards.filter(card => card.needsPreviewRefresh).length,
  needsEditorialRefresh: cards.filter(card => card.needsEditorialRefresh).length,
};

writeJson(path.resolve(outputPath), {
  schemaVersion: "sportscal.card-audit.v1",
  generatedAt: now.toISOString(),
  sourceFeed: `/${inputPath.replace(/^\/+/, "")}`,
  rules: {
    majorThreshold: 4,
    completedSpoilerStatesMustDiffer: true,
    previewStatesMayMatch: true,
    hookWordLimit: 25,
    synopsisWordLimit: 80,
    journalisticPreviewWindowDays: 10,
    minimumContextSignals: 2,
  },
  summary,
  cards,
});

console.log(`Card audit written to ${outputPath}: ${summary.totalMajorCards} major cards, ${summary.stale} stale.`);
if (summary.stale) process.exit(1);
