#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const identities = require("../config/national-team-identities");

const inputPath = path.resolve(process.cwd(), process.argv[2] || "data/events.json");
const bundlePath = process.argv[3] ? path.resolve(process.cwd(), process.argv[3]) : null;
const document = JSON.parse(fs.readFileSync(inputPath, "utf8"));
let applied = 0;

function stripTeamFlagEmoji(value){
  return String(value || "").replace(/\s*\p{Regional_Indicator}{2}\s*/gu, " ").replace(/\s{2,}/g, " ").trim();
}

function enrich(value){
  if (Array.isArray(value)) return value.map(enrich);
  if (!value || typeof value !== "object") return value;
  let next = value;
  const participantIds = identities.participantIdsForEvent(value);
  if (participantIds.length === 2){
    next = {
      ...value,
      participantIds,
      ...(value.name ? { name:stripTeamFlagEmoji(value.name) } : {}),
      ...(value.displayTitleCompact ? { displayTitleCompact:stripTeamFlagEmoji(value.displayTitleCompact) } : {}),
      ...(Array.isArray(value.participantSlots) ? {
        participantSlots:value.participantSlots.map((slot, index) => ({
          ...slot,
          participantId:participantIds[index] || slot.participantId || null,
          logoUrl:identities.teamForId(participantIds[index])?.assetPath || slot.logoUrl || null,
        })),
      } : {}),
    };
    applied += 1;
  }
  return Object.fromEntries(Object.entries(next).map(([key, child]) => [key, enrich(child)]));
}

const output = enrich(document);
fs.writeFileSync(inputPath, `${JSON.stringify(output, null, 2)}\n`);
if (bundlePath){
  const events = Array.isArray(output) ? output : output.events;
  if (!Array.isArray(events)) throw new Error(`${path.relative(process.cwd(), inputPath)} cannot be emitted as an event bundle`);
  fs.writeFileSync(bundlePath, `/* Generated and enriched with canonical national-team identities. Do not edit directly. */\nglobalThis.NOTHINGSPORTS_EVENTS = ${JSON.stringify(events, null, 2)};\n`);
}
console.log(`Applied canonical national-team participant IDs to ${applied} records in ${path.relative(process.cwd(), inputPath)}.`);
