#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const CATALOGUE_PATH = path.resolve(__dirname, "../data/major-events.v1.json");
const CANONICAL_PATH = path.resolve(__dirname, "../data/canonical/afl-nrl-2026.json");
const AFL_FINALS_ID = "major-event:afl-finals-series-2026";
const majorEvents = require("../config/major-events.js");
const competitionStakes = require("../config/enrichment-engine.js");

function readJson(filePath){
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function venueLabel(value){
  return !value || /^to be confirmed$/i.test(value) ? "Venue TBC" : value;
}

function scheduledName(event, existingName){
  if (!event.startTimeUtc || event.scheduleStatus !== "confirmed") return existingName;
  const phase = String(event.roundLabel || "Finals").replace(/s$/i, "");
  return `${phase} - ${event.displayName}`;
}

function reconcileAflFinals(catalogue, canonical){
  const record = catalogue.events.find(event => event.id === AFL_FINALS_ID);
  if (!record) throw new Error(`${AFL_FINALS_ID} is missing from the major events catalogue.`);
  const canonicalFinals = new Map(canonical.events
    .filter(event => event.sportDomainId === "sport:afl" && /final/i.test(event.roundLabel || ""))
    .map(event => [event.id, event]));
  if (canonicalFinals.size !== record.subEvents.length) throw new Error("AFL Finals Series child count no longer matches the canonical AFL schedule.");
  const participantNames = new Map((canonical.participants || []).map(participant => [participant.id, participant.displayName || participant.canonicalName || participant.shortName]));

  record.subEvents.forEach(subEvent => {
    const canonicalEvent = canonicalFinals.get(subEvent.id);
    if (!canonicalEvent) throw new Error(`${subEvent.id} is missing from the canonical AFL Finals Series.`);
    subEvent.startTimeUtc = canonicalEvent.startTimeUtc || null;
    subEvent.venue = venueLabel(canonicalEvent.venueName);
    subEvent.name = scheduledName(canonicalEvent, subEvent.name);
    subEvent.roundLabel = canonicalEvent.roundLabel || subEvent.roundLabel || null;
    subEvent.stage = canonicalEvent.roundLabel || subEvent.stage || null;
    const stagePolicy = competitionStakes.applyCompetitionStakes(canonicalEvent);
    subEvent.competitionPhase = stagePolicy.competitionPhase;
    subEvent.isFinalRegularSeasonRound = stagePolicy.isFinalRegularSeasonRound;
    subEvent.stakesFloor = stagePolicy.stakesFloor;
    subEvent.stakesScore = Math.max(Number(subEvent.stakesScore) || 1, stagePolicy.stakesFloor);
    subEvent.participantIds = canonicalEvent.participantIds || [];
    subEvent.participants = (canonicalEvent.participantIds || []).map(participantId => ({
      id:participantId,
      participantId,
      name:participantNames.get(participantId) || canonicalEvent.displayName?.split(/\s+v\s+/i)?.[subEvent.participantIds.indexOf(participantId)] || "Finals seed TBC",
    }));
    const isGrandFinal = /grand final/i.test(canonicalEvent.roundLabel || "");
    subEvent.broadcaster = isGrandFinal ? "7plus" : "Kayo Sports";
    subEvent.broadcasterIds = isGrandFinal ? ["seven"] : ["kayo", "foxtel", "seven"];
    subEvent.broadcastOptions = isGrandFinal ? ["7plus", "Watch AFL"] : ["Kayo Sports", "Foxtel", "7plus", "Watch AFL"];
    subEvent.viewingOptions = subEvent.broadcasterIds.map(providerId => ({
      providerId,
      serviceId:providerId,
      territory:"AU",
      accessType:["kayo", "foxtel"].includes(providerId) ? "subscription" : "free",
      liveOrReplay:"live",
      rightsScope:"competition",
      sourceUrl:"https://www.afl.com.au/matches/broadcast-guide/broadcast-rights",
      verifiedAt:"2026-08-25T00:00:00.000Z",
    }));
    subEvent.summary = canonicalEvent.startTimeUtc
      ? `Official AFL schedule: ${canonicalEvent.displayName} at ${venueLabel(canonicalEvent.venueName)}.`
      : subEvent.summary;
  });
  return catalogue;
}

function reconcileCatalogue(catalogue, canonical, reference = new Date()){
  return majorEvents.reconcileLifecycle(reconcileAflFinals(catalogue, canonical), { reference });
}

function main(){
  const checkOnly = process.argv.slice(2).includes("--check");
  const original = fs.readFileSync(CATALOGUE_PATH, "utf8");
  const reconciled = reconcileCatalogue(readJson(CATALOGUE_PATH), readJson(CANONICAL_PATH), new Date());
  const next = `${JSON.stringify(reconciled, null, 2)}\n`;
  if (checkOnly){
    if (original !== next) throw new Error("Major Events catalogue is stale against the canonical AFL Finals Series.");
    console.log("Major Events AFL Finals Series matches the canonical schedule.");
    return;
  }
  if (original !== next) fs.writeFileSync(CATALOGUE_PATH, next);
  console.log("Major Events AFL Finals Series reconciled with the canonical schedule.");
}

if (require.main === module) main();

module.exports = { reconcileAflFinals, reconcileCatalogue, scheduledName, venueLabel };
