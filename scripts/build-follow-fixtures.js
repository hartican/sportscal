#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const cardLifecycle = require("../config/card-lifecycle");
const baseFeed = require("../data/events.json");
const { readSnapshot } = require("../lib/follow-snapshot");
const { resolveUserFollowFixtures } = require("../lib/follow-fixture-resolver");

const OUTPUT_PATH = path.resolve(__dirname, "../data/follow-fixtures.v1.json");

function eventId(event){
  return String(event?.canonicalEventId || event?.eventId || event?.id || "");
}

function userStateForProfile(profile){
  return {
    preferences:{
      preferenceGraph:{
        domainPreferences:[],
        competitionPreferences:[],
        entityFollows:profile.entityFollows,
      },
    },
  };
}

function buildArtifact(snapshot, { now = new Date(), baseEvents = baseFeed.events } = {}){
  const reference = now instanceof Date ? now : new Date(now);
  const baseIds = new Set(baseEvents.map(eventId));
  const selected = new Map();
  snapshot.profiles.forEach(profile => {
    const resolved = resolveUserFollowFixtures({
      events:baseEvents,
      userState:userStateForProfile(profile),
      includeCompactArtifact:false,
    });
    resolved.events.forEach(event => {
      const id = eventId(event);
      if (!id || baseIds.has(id)) return;
      const state = cardLifecycle.lifecycleState(event, { now:reference }).state;
      if (state === "expired") return;
      selected.set(id, event);
    });
  });
  const events = Array.from(selected.values()).sort((first, second) => (
    String(first.startTimeUtc || `${first.date}T${first.time}`).localeCompare(String(second.startTimeUtc || `${second.date}T${second.time}`))
    || eventId(first).localeCompare(eventId(second))
  ));
  const sources = Array.from(new Map(events.filter(event => event.sourceUrl).map(event => [event.sourceUrl, {
    sourceName:event.sourceName || "Follow fixture source",
    sourceUrl:event.sourceUrl,
    sourceType:event.sourceType || "published",
    checkedAt:event.sourceCheckedAt || null,
  }])).values());
  return {
    schemaVersion:"follow-fixtures.v1",
    generatedAt:reference.toISOString(),
    sources,
    events,
  };
}

function validatePrivacy(payload){
  const serialized = JSON.stringify(payload);
  for (const forbidden of ["user_id", "userId", "profileHash", "entityFollows", "followLevel"]){
    if (serialized.includes(`\"${forbidden}\"`)) throw new Error(`Follow fixture artifact must not contain ${forbidden}`);
  }
  if (payload.schemaVersion !== "follow-fixtures.v1" || !Array.isArray(payload.events)) throw new Error("Follow fixture artifact is invalid");
  const ids = payload.events.map(eventId);
  if (ids.some(id => !id) || new Set(ids).size !== ids.length) throw new Error("Follow fixture artifact must contain unique stable event ids");
  return true;
}

function main(){
  const checkOnly = process.argv.includes("--check");
  if (checkOnly){
    const payload = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8"));
    validatePrivacy(payload);
    console.log(`Follow fixture artifact valid: ${payload.events.length} fixtures and no profile data.`);
    return;
  }
  const snapshot = readSnapshot();
  const payload = buildArtifact(snapshot);
  validatePrivacy(payload);
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Compact follow fixture artifact regenerated: ${payload.events.length} source-backed fixtures.`);
}

if (require.main === module){
  try { main(); }
  catch (error){ console.error(error.message); process.exit(1); }
}

module.exports = { buildArtifact, eventId, userStateForProfile, validatePrivacy };
