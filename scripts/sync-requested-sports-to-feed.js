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
const SCHEDULE_PATHS = [
  path.join(ROOT, "data/canonical/fiba-women-sailgp-motogp-2026.json"),
  path.join(ROOT, "data/canonical/golf-majors-2027.json"),
  path.join(ROOT, "data/canonical/nbl-2026-27.json"),
  path.join(ROOT, "data/canonical/f1-sessions-2026.json"),
];
const SOURCE_CHECKED_AT = "2026-09-06T00:00:00.000Z";
const F1_LEGACY_STABLE_IDS = Object.freeze({
  "spain:qualifying":"evt_28", "spain:race":"evt_29",
  "azerbaijan:qualifying":"evt_30", "azerbaijan:race":"evt_31",
  "singapore:qualifying":"evt_32", "singapore:race":"evt_33",
  "united-states:qualifying":"evt_34", "united-states:race":"evt_35",
  "mexico:qualifying":"evt_36", "mexico:race":"evt_37",
  "brazil:qualifying":"evt_38", "brazil:race":"evt_39",
  "las-vegas:qualifying":"evt_40", "las-vegas:race":"evt_41",
  "qatar:qualifying":"evt_42", "qatar:race":"evt_43",
  "united-arab-emirates:qualifying":"evt_44", "united-arab-emirates:race":"evt_45",
});

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
  if (sportKey === "nbl") return { label:"ESPN via Disney+ / Kayo / Foxtel", options:["Disney+", "Kayo Sports", "Foxtel"], ids:["kayo", "foxtel"] };
  if (sportKey === "golf") return { label:"Broadcast TBC", options:[], ids:[] };
  return { label:"Fox Sports via Kayo / Foxtel", options:["Kayo Sports", "Foxtel"], ids:["kayo", "foxtel"] };
}

function sportLabel(sportKey){
  return ({
    nrlw:"NRLW",
    "fiba-women":"FIBA Women",
    sailgp:"SailGP",
    motogp:"MotoGP",
    f1:"Formula 1",
    nbl:"NBL",
    golf:"Golf",
  })[sportKey] || sportKey;
}

function cardForEvent(event, schedule, participantsById){
  const source = schedule.sources[event.sourceId];
  const result = event.result || null;
  const resultSource = result ? schedule.sources[result.sourceId] : null;
  if (result && !resultSource) throw new Error(`${event.id}: unknown result source ${result.sourceId}`);
  const broadcaster = broadcasterFor(event.sportKey);
  const fieldEvent = ["motogp", "sailgp", "golf"].includes(event.sportKey);
  const aggregateSchedule = event.cardKind === "event" || (
    event.sportKey === "fiba-women"
    && !(event.participantIds || []).length
    && /(?:qualification day\s*\d*|quarterfinals|semifinals)$/i.test(event.name || "")
  );
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
  const completed = Boolean(result) || event.status === "completed";
  const sourceCheckedAt = event.sourceCheckedAt || source.checkedAt || schedule.generatedAt || SOURCE_CHECKED_AT;
  const spoilerSafeHook = `${event.name} is complete; the key moments are protected until you choose to reveal them.`;
  const spoilerSafeSynopsis = `${event.name} is complete. The defining moments and result-aware recap are ready when you are, without giving anything away here.`;
  const revealedHook = result?.status === "official" ? result.outcomeText : `${event.name} is complete; the official outcome is still pending.`;
  const revealedSynopsis = result?.status === "official" ? result.recapText : `${event.name} is complete, but the official results page had not published a verified outcome at the latest check.`;
  return {
    id,
    eventId:id,
    canonicalEventId:event.id,
    sport:sportLabel(event.sportKey),
    key:event.sportKey === "nbl" ? "basketball" : event.sportKey,
    name:event.name,
    cardKind:aggregateSchedule ? "event" : "fixture",
    displayTitleCompact:event.name,
    date:event.date,
    ...(event.endDate ? {endDate:event.endDate} : {}),
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
    sourceCheckedAt,
    sourceType:source.type,
    sourceTrust:"verified",
    status:event.status || (completed ? "completed" : "upcoming"),
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
    sportDomainId:event.sportKey === "golf" ? "sport:golf"
      : event.sportKey === "sailgp" ? "sport:sailing"
      : event.sportKey === "fiba-women" ? "sport:basketball"
        : event.sportKey === "nbl" ? "sport:basketball"
        : event.sportKey === "f1" ? "sport:f1"
        : event.sportKey === "nrlw" ? "sport:nrl"
          : "sport:motorsport",
    discoverySportId:`sport:${event.sportKey}`,
    competitionId:event.competitionId,
    taxonomyNodeId:event.taxonomyNodeId || (event.sportKey === "nrlw" ? "competition:nrlw-premiership" : event.codeId),
    codeId:event.codeId,
    competitionScope:["nrlw","nbl"].includes(event.sportKey) ? "domestic" : "international",
    isInternational:!["nrlw","nbl"].includes(event.sportKey),
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
      lastReviewedAt:sourceCheckedAt,
    },
    editorialPreview:{
      status:"journalistic",
      angle:event.roundLabel || event.stage || "2026 schedule",
      contextSignals:["official-schedule", event.stage || "competition"],
      sourceName:source.name,
      sourceUrl:source.url,
      sourceCheckedAt,
      needsPreviewRefresh:false,
    },
    lastReviewedAt:sourceCheckedAt,
  };
}

function main(){
  const inputPath = path.resolve(process.argv[2] || path.join(ROOT, "feeds/incoming/events.json"));
  const outputPath = path.resolve(process.argv[3] || inputPath);
  const feed = readJson(inputPath);
  const schedules=SCHEDULE_PATHS.map(readJson);
  const cards=schedules.flatMap(schedule=>{
    const participantsById = new Map((schedule.participants || []).map(participant => [participant.id, participant]));
    return (schedule.events || []).map(event => cardForEvent(event, schedule, participantsById));
  });
  const canonicalIds = new Set(cards.map(card => card.canonicalEventId));
  const sessionType=value=>/sprint qualifying/i.test(value)?"sprint-qualifying":/sprint/i.test(value)?"sprint":/practice\s*1|fp1/i.test(value)?"practice-1":/practice\s*2|fp2/i.test(value)?"practice-2":/practice\s*3|fp3/i.test(value)?"practice-3":/qualifying/i.test(value)?"qualifying":/race/i.test(value)?"race":"";
  const f1Identity=event=>event.key==="f1"?`${String(event.sourceUrl||"").match(/\/racing\/2026\/([^/?#]+)/)?.[1]||""}:${sessionType([event.sessionType,event.stage,event.roundLabel,event.name].join(" "))}`:"";
  const incomingF1=new Set(cards.map(f1Identity).filter(Boolean));
  const legacyF1Ids=new Set(Object.values(F1_LEGACY_STABLE_IDS));
  const existingByF1=new Map((feed.events||[]).map(event=>[f1Identity(event),event]).filter(([key])=>key));
  const existingById=new Map((feed.events||[]).map(event=>[event.id,event]));
  cards.forEach((card,index)=>{const identity=f1Identity(card),legacyId=F1_LEGACY_STABLE_IDS[identity],existing=existingByF1.get(identity)||existingById.get(legacyId);if(identity)cards[index]={...card,...(legacyId?{id:legacyId,eventId:legacyId}:{}),...Object.fromEntries(["storyline","editorialNarrative","editorialPreview","selectedSentence","fullSpiel"].filter(key=>existing?.[key]).map(key=>[key,existing[key]]))};});
  const next = normalizeFeed({
    ...feed,
    events:[...(feed.events || []).filter(event => !canonicalIds.has(event.canonicalEventId) && !incomingF1.has(f1Identity(event)) && !legacyF1Ids.has(event.id)), ...cards],
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
