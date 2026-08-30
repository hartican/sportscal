#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  indexesFor,
  projectionForTarget,
  validateConsequence,
  validateKnowledge,
} = require("./lib/editorial-narrative.js");

const WRITE = process.argv.includes("--write");
const KNOWLEDGE_PATH = path.resolve("data/editorial-knowledge.v1.json");
const CONSEQUENCES_PATH = path.resolve("data/editorial-consequences.v1.json");
const FEED_PATH = path.resolve("feeds/incoming/events.json");
const MAJOR_EVENTS_PATH = path.resolve("data/major-events.v1.json");
const NRL_FINALS_ID = "major-event:nrl-finals-series-2026";
const NRL_FINALS_SOURCE = Object.freeze({
  name:"NRL — finals progression explainer",
  url:"https://www.nrl.com/news/2019/08/26/everything-you-need-to-know-about-the-2019-nrl-finals/",
  checkedAt:"2026-08-29T23:56:41.761Z",
});

function readJson(filePath){ return JSON.parse(fs.readFileSync(filePath, "utf8")); }
function serialize(value){ return `${JSON.stringify(value, null, 2)}\n`; }
function writeJson(filePath, value){ fs.writeFileSync(filePath, serialize(value)); }
function unique(values){ return Array.from(new Set(values)); }
function slug(value){ return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function upsert(collection, record){
  const index = collection.findIndex(item => item.id === record.id);
  if (index >= 0) collection[index] = record;
  else collection.push(record);
}
function stableTime(...values){
  const timestamps = values.map(value => Date.parse(value || "")).filter(Number.isFinite);
  return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
}
function consequenceBody(record){
  const { targetType, targetIds, ...consequence } = record;
  return consequence;
}
function eventStart(record){
  const direct = Date.parse(record?.startTimeUtc || "");
  if (Number.isFinite(direct)) return direct;
  return Date.parse(`${record?.date || ""}T${record?.time || "00:00"}:00+10:00`);
}
function normalizedName(value){ return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function sentence(value){
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text && !/[.!?]$/.test(text) ? `${text}.` : text;
}
function effectFragment(value){
  const text = String(value || "").replace(/\s+/g, " ").trim().replace(/[.!?]+$/, "");
  return text ? `${text.charAt(0).toLowerCase()}${text.slice(1)}` : "";
}
function resultOutcomeKeys(event, participants){
  const homeScore = Number(event?.homeScore);
  const awayScore = Number(event?.awayScore);
  if (Number.isFinite(homeScore) && Number.isFinite(awayScore)) {
    if (homeScore === awayScore) return ["draw", "draw"];
    return homeScore > awayScore ? ["win", "loss"] : ["loss", "win"];
  }
  const winner = normalizedName(event?.consensusResult?.winner);
  if (!winner) return null;
  const matched = participants.findIndex(participant => {
    const name = normalizedName(participant.name);
    return name === winner || name.includes(winner) || winner.includes(name);
  });
  return matched === 0 ? ["win", "loss"] : matched === 1 ? ["loss", "win"] : null;
}
function resultAwareConsequence(event, consequence){
  if (event?.status !== "completed" || consequence.spoilerOnSentence) return consequence;
  const keys = resultOutcomeKeys(event, consequence.participants);
  const resultText = sentence(event.outcomeText || event.canonicalResultScoreline || event.recapText);
  const capturedAt = stableTime(event.resultPublishedAt, event.sourceCheckedAt, event.canonicalSourceCheckedAt, event.lastReviewedAt);
  if (!keys || !resultText || !capturedAt || Date.parse(capturedAt) < eventStart(event)) return consequence;
  const [first, second] = consequence.participants;
  const firstEffect = effectFragment(first.outcomes[keys[0]].effect);
  const secondEffect = effectFragment(second.outcomes[keys[1]].effect);
  return {
    ...consequence,
    spoilerOnSentence:`${resultText} For ${first.name}, that ${firstEffect}; for ${second.name}, it ${secondEffect}. Before kickoff, ${first.name} needed ${first.need}, while ${second.name} needed ${second.need}.`,
    resultCapturedAt:capturedAt,
  };
}

function ensureResultProvenance(event, consequence, knowledge){
  if (!consequence.spoilerOnSentence) return consequence;
  if (consequence.resultFactIds?.length && consequence.resultSourceIds?.length) return consequence;
  const sourceUrl = event.canonicalSourceUrl || event.sourceUrl;
  if (!/^https:\/\//.test(sourceUrl || "")) throw new Error(`${event.eventId || event.id} completed consequence needs an official result source.`);
  const stem = slug(event.canonicalEventId || event.eventId || event.id);
  const sourceId = `source:consequence:${stem}:result`;
  const factId = `fact:consequence:${stem}:result`;
  const sourceType = ["official", "broadcaster", "reputable"].includes(event.canonicalSourceType || event.sourceType)
    ? (event.canonicalSourceType || event.sourceType)
    : "official";
  upsert(knowledge.sources, {
    id:sourceId,
    name:event.canonicalSourceName || event.sourceName || "Official match result",
    url:sourceUrl,
    sourceType,
    checkedAt:consequence.resultCapturedAt,
  });
  upsert(knowledge.narrativeFacts, {
    id:factId,
    subjectIds:consequence.participants.map(participant => participant.subjectId),
    statement:sentence(event.outcomeText || event.canonicalResultScoreline || event.recapText),
    dimension:"consequence",
    sourceIds:[sourceId],
    observedAt:consequence.resultCapturedAt,
    expiresAt:null,
  });
  return {
    ...consequence,
    resultFactIds:[factId],
    resultSourceIds:[sourceId],
    factIds:unique([...consequence.factIds, factId]),
    sourceIds:unique([...consequence.sourceIds, sourceId]),
  };
}

function nrlBracketProgression(){
  const id = suffix => `major-match:nrl-finals-2026:${suffix}`;
  const advances = (nextMatchId, label) => ({ status:"advances", nextMatchId, label });
  const eliminated = label => ({ status:"eliminated", label });
  return {
    schemaVersion:"bracket-progression.v1",
    sourceUrl:NRL_FINALS_SOURCE.url,
    sourceCheckedAt:NRL_FINALS_SOURCE.checkedAt,
    matches:[
      { matchId:id("qualifying-final-1"), winner:advances(id("preliminary-final-1"), "Preliminary Final 1"), loser:advances(id("semi-final-1"), "Semi Final 1") },
      { matchId:id("qualifying-final-2"), winner:advances(id("preliminary-final-2"), "Preliminary Final 2"), loser:advances(id("semi-final-2"), "Semi Final 2") },
      { matchId:id("elimination-final-1"), winner:advances(id("semi-final-1"), "Semi Final 1"), loser:eliminated("Eliminated from the finals") },
      { matchId:id("elimination-final-2"), winner:advances(id("semi-final-2"), "Semi Final 2"), loser:eliminated("Eliminated from the finals") },
      { matchId:id("semi-final-1"), winner:advances(id("preliminary-final-2"), "Preliminary Final 2"), loser:eliminated("Eliminated from the finals") },
      { matchId:id("semi-final-2"), winner:advances(id("preliminary-final-1"), "Preliminary Final 1"), loser:eliminated("Eliminated from the finals") },
      { matchId:id("preliminary-final-1"), winner:advances(id("grand-final"), "NRL Grand Final"), loser:eliminated("Eliminated from the finals") },
      { matchId:id("preliminary-final-2"), winner:advances(id("grand-final"), "NRL Grand Final"), loser:eliminated("Eliminated from the finals") },
      { matchId:id("grand-final"), winner:{ status:"champion", label:"NRL premiers" }, loser:eliminated("Grand Final runner-up") },
    ],
  };
}

function applyBracketProgression(majorEvents){
  const record = majorEvents.events.find(event => event.id === NRL_FINALS_ID);
  if (!record) throw new Error(`${NRL_FINALS_ID} is missing.`);
  record.bracketProgression = nrlBracketProgression();
  const byUrl = new Map([...(record.sources || []), NRL_FINALS_SOURCE].map(source => [source.url, source]));
  record.sources = Array.from(byUrl.values());
}

function validateSnapshotRecord(record, { knowledge, event }){
  const indexes = indexesFor(knowledge);
  const projection = projectionForTarget(knowledge, record.targetType, event);
  if (!projection) return [`${record.targetType}:${record.targetIds[0]} has no editorial projection.`];
  const projected = {
    ...projection,
    factIds:unique([...(projection.factIds || []), ...(record.factIds || [])]),
    sourceIds:unique([...(projection.sourceIds || []), ...(record.sourceIds || [])]),
  };
  const issues = validateConsequence(consequenceBody(record), { ...indexes, projection:projected, label:`${projection.id}.consequence` });
  const eventParticipants = (event.participants || []).slice(0, 2);
  if (eventParticipants.length === 2) record.participants.forEach((participant, index) => {
    const stored = normalizedName(participant.name);
    const published = normalizedName(eventParticipants[index]?.name);
    if (!(stored === published || stored.includes(published) || published.includes(stored))) issues.push(`${projection.id}.consequence participant order must match the published fixture.`);
  });
  const kickoff = eventStart(event);
  if (!Number.isFinite(kickoff)) issues.push(`${projection.id}.consequence requires a verified kickoff.`);
  else if (Date.parse(record.capturedAt) > kickoff) issues.push(`${projection.id}.consequence must be captured at or before kickoff.`);
  return issues;
}

function enrich({ knowledge, consequences, feed, majorEvents }){
  if (consequences.schemaVersion !== "editorial-consequences.v1" || !Array.isArray(consequences.consequences)) throw new Error("Editorial consequence snapshots are invalid.");
  const targetKeys = new Set();
  let enriched = 0;
  consequences.consequences = consequences.consequences.map(record => {
    const key = `${record.targetType}:${record.targetIds.join("|")}`;
    if (targetKeys.has(key)) throw new Error(`Duplicate editorial consequence target ${key}.`);
    targetKeys.add(key);
    const records = record.targetType === "feed-event" ? feed.events : majorEvents.events;
    const event = records.find(candidate => record.targetIds.some(id => [candidate.id, candidate.eventId, candidate.canonicalEventId].includes(id)));
    if (!event) throw new Error(`Editorial consequence target is missing: ${key}.`);
    const issues = validateSnapshotRecord(record, { knowledge, event });
    if (issues.length) throw new Error(`Editorial consequence invalid:\n- ${issues.join("\n- ")}`);
    const updated = ensureResultProvenance(event, resultAwareConsequence(event, record), knowledge);
    const projection = projectionForTarget(knowledge, record.targetType, event);
    projection.factIds = unique([...(projection.factIds || []), ...updated.factIds]);
    projection.sourceIds = unique([...(projection.sourceIds || []), ...updated.sourceIds]);
    projection.consequence = consequenceBody(updated);
    enriched += 1;
    return updated;
  });
  applyBracketProgression(majorEvents);
  consequences.updatedAt = stableTime(consequences.updatedAt, ...consequences.consequences.map(record => record.resultCapturedAt)) || consequences.updatedAt;
  knowledge.updatedAt = stableTime(knowledge.updatedAt, consequences.updatedAt) || knowledge.updatedAt;
  const issues = validateKnowledge(knowledge);
  if (issues.length) throw new Error(`Editorial knowledge invalid after consequence enrichment:\n- ${issues.join("\n- ")}`);
  return enriched;
}

function main(){
  const original = {
    knowledge:fs.readFileSync(KNOWLEDGE_PATH, "utf8"),
    consequences:fs.readFileSync(CONSEQUENCES_PATH, "utf8"),
    majorEvents:fs.readFileSync(MAJOR_EVENTS_PATH, "utf8"),
  };
  const knowledge = JSON.parse(original.knowledge);
  const consequences = JSON.parse(original.consequences);
  const majorEvents = JSON.parse(original.majorEvents);
  const enriched = enrich({ knowledge, consequences, feed:readJson(FEED_PATH), majorEvents });
  const next = {
    knowledge:serialize(knowledge),
    consequences:serialize(consequences),
    majorEvents:serialize(majorEvents),
  };
  if (WRITE) {
    writeJson(KNOWLEDGE_PATH, knowledge);
    writeJson(CONSEQUENCES_PATH, consequences);
    writeJson(MAJOR_EVENTS_PATH, majorEvents);
  } else {
    const stale = Object.keys(next).filter(key => next[key] !== original[key]);
    if (stale.length) throw new Error(`Editorial consequence artifacts are stale: ${stale.join(", ")}.`);
  }
  console.log(`${WRITE ? "Enriched" : "Validated"} ${enriched} immutable editorial consequence snapshot(s) and the structured NRL bracket.`);
}

if (require.main === module){
  try { main(); }
  catch (error){ console.error(error.message); process.exitCode = 1; }
}

module.exports = {
  applyBracketProgression,
  consequenceBody,
  enrich,
  eventStart,
  nrlBracketProgression,
  resultAwareConsequence,
  resultOutcomeKeys,
  ensureResultProvenance,
  validateSnapshotRecord,
};
