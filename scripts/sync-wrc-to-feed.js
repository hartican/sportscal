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
    scoreCheckedAt: event.result.checkedAt,
    statusCheckedAt: event.result.checkedAt,
  };
}

function eventToCard(event){
  const completed = event.status === "completed";
  const cancelled = event.status === "cancelled";
  const hasViewing = event.broadcasters?.some(b=>b.broadcasterName==='Stan Sport');
  const season = event.season || event.date.slice(0,4);
  const sourceCheckedAt = event.source?.checkedAt;
  const card = {
    id: wrcCardId(event),
    eventId: wrcCardId(event),
    canonicalEventId: event.id,
    cardKind: "fixture",
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
    broadcaster: hasViewing ? "Stan Sport" : "TBC",
    broadcastOptions: hasViewing ? ["Stan Sport"] : [],
    broadcasterIds: hasViewing ? ["stan"] : [],
    watchUrl: hasViewing ? STAN_URL : undefined,
    replayUrl: hasViewing ? STAN_URL : undefined,
    expected: 7,
    stakesScore: 4,
    venue: event.venueName || event.country,
    ...Object.fromEntries(["venueCity","venueVerified","venueCountryCode","venueSourceUrl","venueCaption","courseArtworkId","courseGeometryVerified","courseGeometrySourceUrl","participantsConfirmed","participantIds","scheduleNote","statusSourceUrl","statusCheckedAt"].filter(key=>event[key]!=null).map(key=>[key,event[key]])),
    season,
    countryCode: event.countryCode,
    region: event.region,
    liveWindow: 24,
    round: "all",
    roundNumber: event.roundNumber,
    roundLabel: event.roundLabel,
    narrativeType: "championship-round",
    status: cancelled ? "cancelled" : completed ? "completed" : "upcoming",
    selectedSentence: cancelled ? "The WRC element of Rally Saudi Arabia will not take place in 2026." : completed
      ? `${event.displayName} is complete; the winning crew and total time stay hidden until you reveal the result.`
      : `${event.displayName} runs from ${event.date} to ${event.endDate}, with multiple competitive stages${hasViewing ? " and Stan Sport coverage" : "; Australian viewing details TBC"}.`,
    fullSpiel: cancelled ? event.scheduleNote : completed
      ? `${event.displayName} is complete. Its official winning crew, vehicle and total time are available in the result view without being exposed on the spoiler-safe card.`
      : `${event.displayName} is ${event.roundLabel} of the ${season} FIA World Rally Championship. The rally is represented as one multi-day card rather than separate stage cards, ${hasViewing ? "with live coverage and replays on Stan Sport in Australia" : "with Australian viewing details still to be confirmed"}.`,
    sourceName: event.source?.provider || "WRC",
    sourceUrl: event.source?.sourceUrl,
    sourceCheckedAt,
    sourceType: "official",
    sourceTrust: "verified",
    lastReviewedAt: sourceCheckedAt,
    replayEligible: !cancelled,
    highlightEligible: !cancelled,
    briefingEligible: !cancelled,
    catchupEligible: !cancelled,
    storyline: {
      stakes: 4,
      intensity: 4,
      arcStage: completed ? "recap" : "preview",
      hookSpoilerOff: cancelled ? "The 2026 WRC element has been withdrawn." : completed
        ? `${event.displayName} has finished; reveal the official result when you are ready.`
        : `${event.displayName} brings the championship to ${event.country}.`,
      hookSpoilerOn: cancelled ? "The 2026 WRC element has been withdrawn." : completed
        ? `${event.displayName} has an official winning crew and time.`
        : `${event.displayName} brings the championship to ${event.country}.`,
    },
    ...resultFields(event),
  };
  card.storyline.synopsisSpoilerOff = card.fullSpiel;
  card.storyline.synopsisSpoilerOn = card.recapText || card.fullSpiel;
  return card;
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
  // Project the existing season scope once, so fresh Feed loads can resolve
  // followed names without loading the optional standings transport.
  const participantById = new Map(context.participants.map(person => [person.id, person]));
  const previousByCanonicalId = new Map((feed.events || []).filter(card=>card.canonicalEventId).map(card=>[card.canonicalEventId,card]));
  const cards = context.events.map(event => {
    const card = require('../config/sport-context').applyEventContext(eventToCard(event), context);
    const previous=previousByCanonicalId.get(card.canonicalEventId);
    // Calendar observations cannot erase independently reviewed final detail.
    // A changed final, source receipt or identity uses the new projection.
    if(previous?.key==='wrc'&&previous.status==='completed'&&card.status==='completed'&&previous.resultStatus==='official'&&card.resultStatus==='official'&&card.score&&previous.score===card.score&&card.resultSourceUrl&&previous.resultSourceUrl===card.resultSourceUrl&&card.resultSourceCheckedAt&&previous.resultSourceCheckedAt===card.resultSourceCheckedAt){
      for(const field of ['outcomeText','recapText','resultLabels','consensusResult'])if(previous[field]!=null)card[field]=previous[field];
      for(const field of ['scoreCheckedAt','statusCheckedAt','scoreFactObservedAt','resultPublishedAt','fixtureObservationSchema'])if(Object.hasOwn(previous,field))card[field]=previous[field];
    }
    const participants=(card.participantIds || []).map(id => participantById.get(id)).filter(Boolean)
      .map(({id, displayName, countryCode}) => ({id, name:displayName, displayName, countryCode}));
    return { ...card, ...(participants.length ? {participants} : {}) };
  });
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
  console.log(`Projected WRC rally cards into ${outputPath}; legacy rally placeholders removed and non-WRC rally content retained under Motorsport.`);
}

if (require.main === module) main();

module.exports = { WRC_SOURCE_NOTE, wrcCardId, eventToCard, migrateLegacyRallyCard, resultFields, syncWrcToFeed };
