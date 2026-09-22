#!/usr/bin/env node

"use strict";

const fs = require("node:fs");

const SOURCE_PATH = "data/canonical/afl-nrl-2026.json";
const FEED_PATH = "data/events.json";
const TARGET_PATH = "data/canonical/afl-nrl-finals-2026.json";
const CHECK_ONLY = process.argv.includes("--check");
const KNOWN_VENUE_CITIES = Object.freeze({ SCG: "Sydney", MCG: "Melbourne" });

function readJson(file){
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function aliases(event){
  return [event?.id, event?.eventId, event?.canonicalEventId, ...(event?.sourceEventIds || [])]
    .map(value => String(value || "").trim())
    .filter(Boolean);
}

function indexByAlias(events){
  const index = new Map();
  for (const event of events || []) for (const id of aliases(event)) index.set(id, event);
  return index;
}

function copyDefined(target, source, fields){
  for (const field of fields) if (source[field] !== undefined && source[field] !== null) target[field] = structuredClone(source[field]);
}

function knownVenueCity(...events){
  for (const event of events){
    const venue = String(event?.venue || event?.venueName || "").trim().toUpperCase();
    if (KNOWN_VENUE_CITIES[venue]) return KNOWN_VENUE_CITIES[venue];
  }
  return null;
}

function syncFixture(fixture, source, feedEvent){
  const next = { ...fixture };
  copyDefined(next, source, [
    "name", "displayName", "date", "time", "timePrecision", "startTimeUtc", "endTimeUtc",
    "venue", "venueName", "status", "scheduleStatus", "participantIds", "liveWindow", "broadcaster",
    "broadcasterIds", "broadcastOptions", "viewingOptions", "sourceUrl", "sourceName",
    "sourceType", "sourceCheckedAt", "sourceRefs", "canonicalSourceId", "canonicalSourceName",
    "canonicalSourceUrl", "canonicalSourceCheckedAt",
  ]);
  copyDefined(next, feedEvent, ["participants", "participantSlots", "homeParticipantId", "awayParticipantId", "liveWindow"]);
  if (source.startTimeUtc){
    next.schedulePrecision = "exact";
    next.timePrecision = "exact";
    delete next.weekAnchorDate;
    delete next.displayDateLabel;
  }
  const venueCity = source.venueCity || knownVenueCity(source, feedEvent);
  if (venueCity) next.venueCity = venueCity;
  if (source.name && source.venue && source.date){
    next.summary = `${source.name} at ${source.venue}${source.time ? `, ${source.date} ${source.time}` : ` on ${source.date}`}.`;
  }

  const narrative = feedEvent?.editorialNarrative || source.editorialNarrative;
  if (narrative){
    next.editorialNarrative = structuredClone(narrative);
    next.storyline = {
      ...(next.storyline || {}),
      stakes: Number(next.stakesScore || next.storyline?.stakes || 5),
      hookSpoilerOff: narrative.hook,
      hookSpoilerOn: narrative.hook,
      synopsisSpoilerOff: narrative.synopsis,
      synopsisSpoilerOn: narrative.synopsis,
      arcStage: "preview",
      lastReviewedAt: narrative.researchedAt || next.storyline?.lastReviewedAt,
    };
  }
  return next;
}

function main(){
  const source = readJson(SOURCE_PATH);
  const feed = readJson(FEED_PATH);
  const target = readJson(TARGET_PATH);
  // The regular-season NRL provider stops at Round 27. Reviewed official
  // finals announcements are the canonical source for its bracket slots.
  const sourceIndex = indexByAlias([...source.events, ...readJson("data/canonical/nrl-finals-published-2026.json").events.map(({status, ...schedule}) => schedule)]);
  const feedIndex = indexByAlias(feed.events);
  let updated = 0;
  const next = {
    ...target,
    phases: (target.phases || []).map(phase => ({
      ...phase,
      fixtures: (phase.fixtures || []).map(fixture => {
        const canonical = sourceIndex.get(fixture.id);
        if (!canonical) return fixture;
        updated += 1;
        return syncFixture(fixture, canonical, feedIndex.get(fixture.id));
      }),
    })),
  };
  const serialized = `${JSON.stringify(next, null, 2)}\n`;
  const original = fs.readFileSync(TARGET_PATH, "utf8");
  if (CHECK_ONLY){
    if (serialized !== original) throw new Error("AFL/NRL finals Code-phase fixtures are stale; run sync-finals-code-phase.js.");
    console.log(`Finals Code-phase sync valid: ${updated} canonical fixtures current.`);
    return;
  }
  if (serialized !== original) fs.writeFileSync(TARGET_PATH, serialized);
  console.log(`Finals Code-phase synchronized: ${updated} canonical fixtures checked.`);
}

main();
