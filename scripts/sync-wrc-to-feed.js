#!/usr/bin/env node

"use strict";

const {
  normalizeFeed,
  readJson,
  validateFeed,
  writeJson,
} = require("./lib/feed-utils");
const { STAN_URL, validateWrcContext } = require("./lib/wrc-context");

const PLACEHOLDER_IDS = new Set([
  "calendar-nothingsport-manual-seed-rally-paris-dakar-stage-11-2026",
  "calendar-nothingsport-manual-seed-rally-wrc-safari-2027",
]);
const WRC_SOURCE_NOTE = "WRC rounds are sourced from the official WRC calendar and FIA senior championship tables.";

function wrcCardId(event){
  return String(event.id).replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
}

function resultFields(event){
  if (event.status !== "completed") return {};
  if (event.result?.status !== "official"){
    return {
      resultStatus: "pending",
      resultSourceUrl: event.result?.sourceUrl,
      resultSourceCheckedAt: event.result?.checkedAt,
    };
  }
  const summary = `${event.result.winningCrew} won in ${event.result.totalTime}`;
  return {
    status: "completed",
    resultStatus: "official",
    score: `${event.result.winningCrew} — ${event.result.totalTime}`,
    outcomeText: `${summary} in a ${event.result.vehicle}.`,
    recapText: `${event.displayName} was won by ${event.result.winningCrew} in ${event.result.totalTime}, driving a ${event.result.vehicle}.`,
    resultLabels: [event.roundLabel, event.result.winningCrew, event.result.totalTime, "Official result"],
    consensusResult: { winner: event.result.winningCrew, summary, marginText: event.result.totalTime },
    resultSourceUrl: event.result.sourceUrl,
    resultSourceCheckedAt: event.result.checkedAt,
  };
}

function eventToCard(event){
  const completed = event.status === "completed";
  const sourceCheckedAt = event.source?.checkedAt;
  return {
    id: wrcCardId(event),
    eventId: wrcCardId(event),
    canonicalEventId: event.id,
    sport: "WRC",
    key: "wrc",
    sportDomainId: "sport:wrc",
    canonicalSportDomainId: "sport:motorsport",
    competitionId: event.competitionId,
    name: event.displayName,
    displayTitleCompact: event.displayName,
    date: event.date,
    endDate: event.endDate,
    time: "00:00",
    dateOnly: true,
    timePrecision: "date-only",
    scheduleStatus: "date-only",
    displayTime: "Multiple live stages",
    broadcaster: "Stan Sport",
    broadcastOptions: ["Stan Sport"],
    broadcasterIds: ["stan"],
    watchUrl: STAN_URL,
    replayUrl: STAN_URL,
    expected: 7,
    stakesScore: 4,
    venue: event.country,
    countryCode: event.countryCode,
    region: event.region,
    liveWindow: 24,
    round: "all",
    roundNumber: event.roundNumber,
    roundLabel: event.roundLabel,
    narrativeType: "championship-round",
    status: completed ? "completed" : "upcoming",
    selectedSentence: completed
      ? `${event.displayName} is complete; the winning crew and total time stay hidden until you reveal the result.`
      : `${event.displayName} runs from ${event.date} to ${event.endDate}, with multiple live stages on Stan Sport.`,
    fullSpiel: completed
      ? `${event.displayName} is complete. Its official winning crew, vehicle and total time are available in the result view without being exposed on the spoiler-safe card.`
      : `${event.displayName} is ${event.roundLabel} of the 2026 FIA World Rally Championship. The rally is represented as one multi-day card rather than separate stage cards, with live coverage and replays on Stan Sport in Australia.`,
    sourceName: event.source?.provider || "WRC",
    sourceUrl: event.source?.sourceUrl,
    sourceCheckedAt,
    sourceType: "official",
    sourceTrust: "verified",
    lastReviewedAt: sourceCheckedAt,
    replayEligible: true,
    highlightEligible: true,
    briefingEligible: true,
    catchupEligible: true,
    storyline: {
      stakes: 4,
      intensity: 4,
      arcStage: completed ? "recap" : "preview",
      hookSpoilerOff: completed
        ? `${event.displayName} has finished; reveal the official result when you are ready.`
        : `${event.displayName} brings the championship to ${event.country}.`,
      hookSpoilerOn: completed
        ? `${event.displayName} has an official winning crew and time.`
        : `${event.displayName} brings the championship to ${event.country}.`,
    },
    ...resultFields(event),
  };
}

function migrateLegacyRallyCard(card){
  if (card?.key !== "rally") return card;
  if (/\b(?:WRC|World Rally Championship)\b/i.test(`${card.name || ""} ${card.sport || ""}`)){
    return { ...card, key: "wrc", sport: "WRC", sportDomainId: "sport:wrc" };
  }
  return { ...card, key: "motorsport", sport: "Motorsport", sportDomainId: "sport:motorsport" };
}

function syncWrcToFeed(feed, context){
  const contextErrors = validateWrcContext(context);
  if (contextErrors.length) throw new Error(`Cannot project invalid WRC context:\n- ${contextErrors.join("\n- ")}`);
  const cards = context.events.map(eventToCard);
  const cardIds = new Set(cards.map(card => card.id));
  const retained = (feed.events || [])
    .filter(card => !PLACEHOLDER_IDS.has(card?.id) && !PLACEHOLDER_IDS.has(card?.eventId))
    .filter(card => card?.canonicalEventId ? !context.events.some(event => event.id === card.canonicalEventId) : true)
    .filter(card => !cardIds.has(card?.id))
    .map(migrateLegacyRallyCard);
  const baseSourceNote = String(feed.sourceNote || "Curated Nothingsport feed.")
    .replaceAll(WRC_SOURCE_NOTE, "")
    .replace(/\s+/g, " ")
    .trim();
  return normalizeFeed({
    ...feed,
    sourceNote: `${baseSourceNote} ${WRC_SOURCE_NOTE}`,
    events: [...retained, ...cards].sort((first, second) => `${first.date}T${first.time}${first.id}`.localeCompare(`${second.date}T${second.time}${second.id}`)),
  });
}

function main(){
  const contextPath = process.argv[2] || "data/canonical/wrc-context-2026.json";
  const inputPath = process.argv[3] || "feeds/incoming/events.json";
  const outputPath = process.argv[4] || inputPath;
  const output = syncWrcToFeed(readJson(inputPath), readJson(contextPath));
  const errors = validateFeed(output);
  if (errors.length){
    console.error("Refusing to write invalid WRC feed cards:");
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
  }
  writeJson(outputPath, output);
  console.log(`Projected 14 WRC rally cards into ${outputPath}; legacy rally placeholders removed and non-WRC rally content retained under Motorsport.`);
}

if (require.main === module) main();

module.exports = { WRC_SOURCE_NOTE, eventToCard, migrateLegacyRallyCard, resultFields, syncWrcToFeed };
