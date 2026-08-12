#!/usr/bin/env node

"use strict";

const { normalizeFeed, readJson, validateFeed, writeJson } = require("./lib/feed-utils");
const tennisCoverage = require("../config/tennis-coverage.js");
const { generateCatalogue } = require("./refresh-tennis-catalogue.js");

function sydneyDate(reference = new Date()){
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(reference).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function displayLevel(level){
  return {
    grand_slam: "Grand Slam",
    atp_masters_1000: "ATP Masters 1000",
    wta_1000: "WTA 1000",
    atp_finals: "ATP Finals",
    wta_finals: "WTA Finals",
    team_competition: "Team competition",
  }[level] || String(level || "Tennis").replace(/_/g, " ");
}

function expectedFor(level){
  if (["grand_slam", "atp_finals", "wta_finals"].includes(level)) return 9;
  if (["atp_masters_1000", "wta_1000"].includes(level)) return 8;
  if (level === "team_competition") return 7;
  if (["atp_500", "wta_500"].includes(level)) return 6;
  return 5;
}

function tournamentToCard(tournament, referenceDate){
  const levelLabel = displayLevel(tournament.level);
  const tourLabel = tournament.tour === "BOTH" || tournament.tour === "TEAM" ? levelLabel : `${tournament.tour} ${levelLabel.replace(/^ATP |^WTA /, "")}`;
  const compactTitle = `${tournament.name} — ${tourLabel}`;
  const id = `tennis-tournament-${tournament.tournamentId.replace(/^tournament:tennis:/, "")}-${referenceDate}`;
  const tourName = tournament.tour === "ATP" ? "men's" : tournament.tour === "WTA" ? "women's" : "combined";
  const surfaceLabel = tournament.surface === "hard" ? "hard-court" : `${tournament.surface}-court`;
  const activeCopy = tournament.endDate === referenceDate
    ? `${tournament.name}'s ${tourName} ${levelLabel} reaches the final day of its ${surfaceLabel} window in ${tournament.city}.`
    : tournament.startDate === referenceDate
      ? `${tournament.name}'s ${tourName} ${levelLabel} opens its ${surfaceLabel} window in ${tournament.city}.`
      : `${tournament.name}'s ${tourName} ${levelLabel} is inside its official ${surfaceLabel} tournament window in ${tournament.city}.`;
  const contextSignals = [
    tournament.tour === "ATP" ? "atp-tour" : tournament.tour === "WTA" ? "wta-tour" : "combined-tours",
    tournament.level,
    tournament.endDate === referenceDate ? "closing-day" : tournament.startDate === referenceDate ? "opening-day" : "active-tournament-window",
    `${tournament.surface}-surface`,
  ];
  return {
    id,
    eventId: id,
    sport: "Tennis",
    key: "tennis",
    sportId: "tennis",
    taxonomyNodeId: tournament.eventSeriesId || tournament.competitionId,
    taxonomySportId: "sport:tennis",
    disciplineId: "discipline:tennis:professional",
    taxonomyCompetitionId: tournament.competitionId,
    ...(tournament.eventSeriesId ? { eventSeriesId: tournament.eventSeriesId } : {}),
    competitionId: tournament.competitionId,
    tennisTournamentId: tournament.tournamentId,
    tennisLevel: tournament.level,
    tour: tournament.tour,
    representedTours: tournament.representedTours,
    cardType: "tournament_overview",
    name: compactTitle,
    displayTitleCompact: compactTitle.slice(0, 80),
    date: referenceDate,
    time: "09:00",
    timeTbc: true,
    displayTimeLabel: "Daily order of play",
    broadcaster: "Broadcast TBC",
    broadcastOptions: [],
    expected: expectedFor(tournament.level),
    venue: `${tournament.city}, ${tournament.countryCode}`,
    liveWindow: 12,
    round: "all",
    narrativeType: "tennis-tournament-overview",
    status: "upcoming",
    selectedSentence: activeCopy,
    fullSpiel: `${activeCopy} Match cards require a confirmed draw or order-of-play source; this tournament-level card guarantees that active marquee tennis is not silently omitted while exact court times remain unconfirmed.`,
    sourceName: `${tournament.tour === "WTA" ? "WTA" : tournament.tour === "ATP" ? "ATP Tour" : "Official tennis competition"} tournament calendar`,
    sourceUrl: tournament.sourceUrl,
    sourceCheckedAt: tournament.reviewedAt || "2026-08-13T02:00:00.000Z",
    sourceType: "official",
    lastReviewedAt: tournament.reviewedAt || "2026-08-13T02:00:00.000Z",
    editorialPreview: {
      status: "journalistic",
      angle: activeCopy,
      contextSignals,
      sourceName: `${tournament.tour === "WTA" ? "WTA" : tournament.tour === "ATP" ? "ATP Tour" : "Official tennis competition"} tournament calendar`,
      sourceUrl: tournament.sourceUrl,
      sourceCheckedAt: tournament.reviewedAt || "2026-08-13T02:00:00.000Z",
      needsPreviewRefresh: false,
    },
    replayEligible: false,
    highlightEligible: true,
    briefingEligible: true,
    catchupEligible: false,
    storyline: {
      stakes: expectedFor(tournament.level) >= 8 ? 4 : 3,
      intensity: expectedFor(tournament.level) >= 8 ? 4 : 3,
      archetype: "marquee tournament window",
      arcStage: "preview",
      expectedSpectacle: expectedFor(tournament.level),
      hookSpoilerOff: activeCopy,
      synopsisSpoilerOff: `${activeCopy} Exact match times will replace this overview only when an authoritative order of play is available.`,
    },
  };
}

function syncTennisTournaments(feed, catalogue, { referenceDate = sydneyDate(), publishedAt = new Date().toISOString() } = {}){
  const retained = (feed.events || []).filter(event => event.narrativeType !== "tennis-tournament-overview");
  const active = tennisCoverage.activeTournamentOverviewEvents(catalogue, { referenceDate, froth: "balanced" });
  const generated = active.map(tournament => tournamentToCard({ ...tournament, reviewedAt: catalogue.generatedAt }, referenceDate));
  const output = normalizeFeed({
    ...feed,
    version: feed.version,
    publishedAt,
    events: [...retained, ...generated].sort((first, second) => `${first.date}T${first.time}${first.id}`.localeCompare(`${second.date}T${second.time}${second.id}`)),
  });
  return { output, generated };
}

function main(){
  const positional = process.argv.slice(2).filter(arg => !arg.startsWith("--"));
  const fromExports = process.argv.includes("--from-exports");
  const cataloguePath = fromExports ? null : positional[0] || "data/canonical/tennis-catalogue-2026.json";
  const inputPath = fromExports ? positional[0] || "feeds/incoming/events.json" : positional[1] || "feeds/incoming/events.json";
  const outputPath = fromExports ? positional[1] || inputPath : positional[2] || inputPath;
  const referenceDateArg = process.argv.find(arg => arg.startsWith("--reference-date="));
  const referenceDate = referenceDateArg ? referenceDateArg.split("=")[1] : sydneyDate();
  const catalogue = fromExports ? generateCatalogue() : readJson(cataloguePath);
  const { output, generated } = syncTennisTournaments(readJson(inputPath), catalogue, { referenceDate });
  const errors = validateFeed(output);
  if (errors.length) {
    console.error("Refusing to write invalid tennis tournament cards:");
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
  }
  writeJson(outputPath, output);
  console.log(`Synced ${generated.length} active marquee tennis tournament cards for ${referenceDate}.`);
  console.log(outputPath);
}

if (require.main === module) main();

module.exports = {
  displayLevel,
  expectedFor,
  sydneyDate,
  syncTennisTournaments,
  tournamentToCard,
};
