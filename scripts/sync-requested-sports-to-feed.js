#!/usr/bin/env node

"use strict";

const path = require("node:path");
const {
  normalizeFeed,
  readJson,
  validateFeed,
  writeJson,
} = require("./lib/feed-utils");

const ROOT = path.resolve(__dirname, "..");
const SCHEDULE_PATH = path.join(ROOT, "data/canonical/fiba-women-sailgp-motogp-2026.json");
const SOURCE_CHECKED_AT = "2026-09-06T00:00:00.000Z";

function stableCardId(canonicalEventId){
  return `evt_${String(canonicalEventId || "")
    .replace(/^event:/, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")}`;
}

function broadcasterFor(sportKey){
  if (sportKey === "nrlw"){
    return { label:"Nine / 9Now / Fox Sports / Kayo", options:["9Now", "Kayo Sports", "Foxtel"], ids:["nine", "kayo", "foxtel"] };
  }
  if (sportKey === "fiba-women") return { label:"ESPN via Kayo / Foxtel", options:["Kayo Sports", "Foxtel"], ids:["kayo", "foxtel"] };
  return { label:"Fox Sports via Kayo / Foxtel", options:["Kayo Sports", "Foxtel"], ids:["kayo", "foxtel"] };
}

function sportLabel(sportKey){
  return ({
    nrlw:"NRLW",
    "fiba-women":"FIBA Women",
    sailgp:"SailGP",
    motogp:"MotoGP",
  })[sportKey] || sportKey;
}

function cardForEvent(event, schedule, participantsById){
  const source = schedule.sources[event.sourceId];
  const result = event.result || null;
  const resultSource = result ? schedule.sources[result.sourceId] : null;
  if (result && !resultSource) throw new Error(`${event.id}: unknown result source ${result.sourceId}`);
  const broadcaster = broadcasterFor(event.sportKey);
  const fieldEvent = ["motogp", "sailgp"].includes(event.sportKey);
  const eventParticipantIds = event.participantIds || (fieldEvent
    ? (schedule.participants || []).filter(participant => participant.sportKey === event.sportKey).map(participant => participant.id)
    : []);
  const participants = eventParticipantIds.map((participantId, index) => {
    const participant = participantsById.get(participantId);
    if (!participant) throw new Error(`${event.id}: unknown participant ${participantId}`);
    return { id:participantId, name:participant.displayName, role:index === 0 ? "home" : "away" };
  });
  const participantSlots = participants.map((participant, index) => ({
    slot:index + 1,
    participantId:participant.id,
    label:participant.name,
  }));
  const representativeCountryCodes = eventParticipantIds
    .map(participantId => participantsById.get(participantId)?.countryCode)
    .filter(Boolean);
  const id = stableCardId(event.id);
  const stakes = event.round === "final" ? 5 : event.round === "semifinal" || event.round === "quarterfinal" ? 4 : Math.max(2, Math.ceil(Number(event.expected) / 2));
  const completed = Boolean(result);
  const spoilerSafeHook = `${event.name} is complete; the key moments are protected until you choose to reveal them.`;
  const spoilerSafeSynopsis = `${event.name} is complete. The defining moments and result-aware recap are ready when you are, without giving anything away here.`;
  const revealedHook = result?.status === "official" ? result.outcomeText : `${event.name} is complete; the official outcome is still pending.`;
  const revealedSynopsis = result?.status === "official" ? result.recapText : `${event.name} is complete, but the official results page had not published a verified outcome at the latest check.`;
  return {
    id,
    eventId:id,
    canonicalEventId:event.id,
    sport:sportLabel(event.sportKey),
    key:event.sportKey,
    name:event.name,
    displayTitleCompact:event.name,
    date:event.date,
    time:event.time,
    ...(event.startTimeUtc ? { startTimeUtc:event.startTimeUtc } : {}),
    ...(event.timeTbc ? { timeTbc:true } : {}),
    timePrecision:event.timeTbc ? "tbc" : (event.timePrecision || "exact"),
    scheduleStatus:event.timeTbc ? "tbc" : "confirmed",
    broadcaster:broadcaster.label,
    broadcastOptions:broadcaster.options,
    broadcasterIds:broadcaster.ids,
    expected:Number(event.expected),
    stakesScore:stakes,
    venue:event.venue || null,
    liveWindow:Number(event.liveWindow || 3),
    round:event.round || "all",
    roundLabel:event.roundLabel || null,
    ...(Number.isInteger(event.roundNumber) ? { roundNumber:event.roundNumber } : {}),
    stage:event.stage || null,
    narrativeType:"all",
    selectedSentence:completed ? spoilerSafeHook : event.hook,
    fullSpiel:completed ? spoilerSafeSynopsis : event.context,
    sourceName:source.name,
    sourceUrl:source.url,
    sourceCheckedAt:SOURCE_CHECKED_AT,
    sourceType:source.type,
    sourceTrust:"verified",
    status:completed ? "completed" : "upcoming",
    ...(result ? {
      resultStatus:result.status,
      resultSourceUrl:resultSource.url,
      resultSourceCheckedAt:result.checkedAt,
      ...(result.status === "official" ? {
        score:result.score,
        outcomeText:result.outcomeText,
        recapText:result.recapText,
        resultLabels:[event.roundLabel || event.stage || "Result", result.score, "Official result"],
        consensusResult:{ winner:participantsById.get(result.winnerParticipantId)?.displayName || null, summary:result.outcomeText },
      } : {}),
    } : {}),
    sportDomainId:event.sportKey === "sailgp" ? "sport:sailing"
      : event.sportKey === "fiba-women" ? "sport:basketball"
        : event.sportKey === "nrlw" ? "sport:nrl"
          : "sport:motorsport",
    discoverySportId:`sport:${event.sportKey}`,
    competitionId:event.competitionId,
    taxonomyNodeId:event.sportKey === "nrlw" ? "competition:nrlw-premiership" : event.codeId,
    codeId:event.codeId,
    competitionScope:event.sportKey === "nrlw" ? "domestic" : "international",
    isInternational:event.sportKey !== "nrlw",
    representativeCountryCodes:Array.from(new Set(representativeCountryCodes)),
    ...(fieldEvent && participants.length ? {
      participantIds:eventParticipantIds,
      participantDisplayMode:"field",
    } : participants.length ? {
      participantIds:eventParticipantIds,
      participants,
      participantSlots,
    } : {}),
    replayEligible:true,
    highlightEligible:true,
    briefingEligible:Number(event.expected) >= 8,
    catchupEligible:Number(event.expected) >= 8,
    storyline:{
      stakes,
      intensity:Math.max(2, Math.ceil(Number(event.expected) / 2)),
      intensitySource:"manual",
      arcStage:completed ? "recap" : "preview",
      expectedSpectacle:Number(event.expected),
      hookSpoilerOff:completed ? spoilerSafeHook : event.hook,
      hookSpoilerOn:completed ? revealedHook : event.hook,
      synopsisSpoilerOff:completed ? spoilerSafeSynopsis : event.context,
      synopsisSpoilerOn:completed ? revealedSynopsis : event.context,
      lastReviewedAt:SOURCE_CHECKED_AT,
    },
    editorialPreview:{
      status:"journalistic",
      angle:event.roundLabel || event.stage || "2026 schedule",
      contextSignals:["official-schedule", event.stage || "competition"],
      sourceName:source.name,
      sourceUrl:source.url,
      sourceCheckedAt:SOURCE_CHECKED_AT,
      needsPreviewRefresh:false,
    },
    lastReviewedAt:SOURCE_CHECKED_AT,
  };
}

function main(){
  const inputPath = path.resolve(process.argv[2] || path.join(ROOT, "feeds/incoming/events.json"));
  const outputPath = path.resolve(process.argv[3] || inputPath);
  const schedule = readJson(SCHEDULE_PATH);
  const feed = readJson(inputPath);
  const participantsById = new Map((schedule.participants || []).map(participant => [participant.id, participant]));
  const cards = (schedule.events || []).map(event => cardForEvent(event, schedule, participantsById));
  const canonicalIds = new Set(cards.map(card => card.canonicalEventId));
  const next = normalizeFeed({
    ...feed,
    events:[...(feed.events || []).filter(event => !canonicalIds.has(event.canonicalEventId)), ...cards],
  });
  const errors = validateFeed(next);
  if (errors.length) throw new Error(`Requested sports feed is invalid:\n- ${errors.join("\n- ")}`);
  writeJson(outputPath, next);
  const counts = cards.reduce((result, card) => ({ ...result, [card.key]:(result[card.key] || 0) + 1 }), {});
  console.log(`Requested sports synced: ${Object.entries(counts).map(([key, count]) => `${key} ${count}`).join(", ")}.`);
}

if (require.main === module){
  try { main(); }
  catch (error){
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { cardForEvent, stableCardId };
