#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "data/code-inspector");
const taxonomy = require("../config/canonical-sports-taxonomy");
const followFirst = require("../config/follow-first");
const feed = require("../data/events.json");
const canonicalAflNrl = require("../data/canonical/afl-nrl-2026.json");
const majorEvents = require("../data/major-events.v1.json");
const canonicalParticipantNames = new Map((canonicalAflNrl.participants || []).map(participant => [
  participant.id,
  participant.displayName || participant.canonicalName || participant.shortName || null,
]));

const CODE_KEYS = Object.freeze({
  "sport:afl": ["afl"],
  "sport:nrl": ["nrl"],
  "sport:motorsport": ["f1", "motorsport", "motogp", "lemans", "goodwood", "bathurst"],
  "sport:extreme": ["extreme"],
  "sport:surf": ["surf", "surfing"],
  "sport:rugby-union": ["rugby", "rugby-union"],
  "sport:tennis": ["tennis", "wimbledon"],
  "sport:football": ["football", "soccer", "fifa", "premier-league"],
  "sport:cycling": ["cycling", "tour-de-france"],
  "sport:cricket": ["cricket"],
  "sport:basketball": ["basketball", "nba"],
  "sport:golf": ["golf"],
  "sport:american-football": ["american-football", "nfl"],
  "sport:skiing": ["skiing", "snow"],
  "sport:multi-sport": ["multi-sport", "cwg", "commonwealth-games"],
});

const FINALS_EXPECTED_AT = Object.freeze({
  "major-event:afl-finals-series-2026": [
    "2026-08-24T09:00:00+10:00",
    "2026-08-31T09:00:00+10:00",
    "2026-08-31T09:00:00+10:00",
    "2026-08-31T09:00:00+10:00",
    "2026-08-31T09:00:00+10:00",
    "2026-09-07T09:00:00+10:00",
    "2026-09-07T09:00:00+10:00",
    "2026-09-14T09:00:00+10:00",
    "2026-09-14T09:00:00+10:00",
    "2026-09-21T09:00:00+10:00",
  ],
  "major-event:nrl-finals-series-2026": [
    "2026-09-07T09:00:00+10:00",
    "2026-09-07T09:00:00+10:00",
    "2026-09-07T09:00:00+10:00",
    "2026-09-07T09:00:00+10:00",
    "2026-09-14T09:00:00+10:00",
    "2026-09-14T09:00:00+10:00",
    "2026-09-21T09:00:00+10:00",
    "2026-09-21T09:00:00+10:00",
    "2026-09-28T09:00:00+10:00",
  ],
});

function stableId(event){
  return String(event?.canonicalEventId || event?.eventId || event?.id || "");
}

function eventMatchesCode(event, code){
  if (event?.sportDomainId === code.id) return true;
  const values = [event?.key, event?.sportId, event?.sportKey, event?.sport]
    .filter(Boolean)
    .map(value => String(value).toLowerCase());
  return (CODE_KEYS[code.id] || [code.slug]).some(key => values.some(value => value === key || value.includes(key)));
}

function participantSlots(event){
  if (Array.isArray(event?.participantSlots) && event.participantSlots.length){
    return event.participantSlots.map((slot, index) => ({
      slot: slot.slot || index + 1,
      participantId: slot.participantId || null,
      label: slot.label || canonicalParticipantNames.get(slot.participantId) || null,
    }));
  }
  if (Array.isArray(event?.participantIds) && event.participantIds.length){
    return event.participantIds.slice(0, 2).map((participantId, index) => ({
      slot: index + 1,
      participantId,
      label: canonicalParticipantNames.get(participantId) || null,
    }));
  }
  const matchup = String(event?.name || "").split(" - ").at(-1).split(/\s+v\s+/i);
  if (matchup.length === 2){
    return matchup.map((label, index) => ({ slot: index + 1, participantId: null, label: label.trim() || "TBC" }));
  }
  return [];
}

function sydneyPartsFromUtc(iso){
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function normalizeFixture(event, codeId, extra = {}){
  const slots = participantSlots(event);
  const sydney = sydneyPartsFromUtc(event.startTimeUtc);
  const confirmedParticipants = slots.length > 0 && slots.every(slot => slot.participantId || (slot.label && !/\b(?:winner|loser|\d+(?:st|nd|rd|th)|tbc)\b/i.test(slot.label)));
  const roundLabel = event.roundLabel || event.round || extra.roundLabel || null;
  const stage = event.stage || extra.stage || null;
  return {
    id: stableId(event),
    codeId,
    competitionId: event.competitionId || extra.competitionId || null,
    name: event.name || event.displayName || "TBC",
    date: event.date || sydney?.date || extra.date || null,
    time: event.time || sydney?.time || null,
    startTimeUtc: event.startTimeUtc || null,
    venue: (event.venue || event.venueName) && !/tbc/i.test(event.venue || event.venueName) ? (event.venue || event.venueName) : null,
    status: event.status || "upcoming",
    scheduleStatus: event.scheduleStatus || (event.startTimeUtc && confirmedParticipants ? "confirmed" : "provisional"),
    participantSlots: slots,
    detailsExpectedAt: event.detailsExpectedAt || extra.detailsExpectedAt || null,
    schedulingWindow: event.schedulingWindow || extra.schedulingWindow || null,
    roundNumber: Number.isInteger(event.roundNumber) ? event.roundNumber : null,
    roundLabel,
    stage,
    groupOrder:followFirst.finalsStageRank(roundLabel || stage),
    competitionScope:event.competitionScope || null,
    isInternational:event.isInternational === true || event.competitionScope === "international",
    representativeCountryCodes:Array.isArray(event.representativeCountryCodes) ? event.representativeCountryCodes : [],
    expected: Number(event.expected || event.stakesScore || 0),
    broadcaster: event.broadcaster || (event.broadcasters || []).map(item => item.broadcasterName).filter(Boolean).join(" / ") || null,
    sourceCoverage: extra.sourceCoverage || "published-feed",
  };
}

function finalsPlaceholders(code){
  const matching = (majorEvents.events || []).filter(event => (
    event.sportKeys?.some(key => (CODE_KEYS[code.id] || []).includes(key))
    && Array.isArray(event.subEvents)
  ));
  return matching.flatMap(event => event.subEvents.map((subEvent, index) => normalizeFixture(subEvent, code.id, {
    competitionId: event.competitionId,
    detailsExpectedAt: FINALS_EXPECTED_AT[event.id]?.[index] || null,
    schedulingWindow: { startsOn: event.startDate, endsOn: event.endDate, timeZone: "Australia/Sydney" },
    roundLabel: subEvent.name?.split(" - ")[0] || `Finals fixture ${index + 1}`,
    stage: "finals",
    sourceCoverage: "official-milestone-placeholder",
  })));
}

function mergeFixtureRecords(placeholders, eventRecords, codeId, officialEvents = new Set()){
  const fixtures = new Map(placeholders.map(fixture => [fixture.id, fixture]));
  eventRecords.forEach(event => {
    const id = stableId(event);
    if (!id) return;
    const mergedEvent = { ...(fixtures.get(id) || {}), ...event };
    const hasConfirmedParticipants = Array.isArray(event.participantSlots) && event.participantSlots.length
      || Array.isArray(event.participantIds) && event.participantIds.length;
    if (Array.isArray(event.participantIds) && event.participantIds.length && !Array.isArray(event.participantSlots)){
      delete mergedEvent.participantSlots;
    }
    if (event.startTimeUtc && hasConfirmedParticipants){
      if (event.scheduleStatus === undefined) delete mergedEvent.scheduleStatus;
      if (event.detailsExpectedAt === undefined) mergedEvent.detailsExpectedAt = null;
    }
    fixtures.set(id, normalizeFixture(mergedEvent, codeId, {
      sourceCoverage: officialEvents.has(event) ? "official-canonical" : "published-feed",
    }));
  });
  return Array.from(fixtures.values()).sort((first, second) => (
    String(first.date || first.schedulingWindow?.startsOn || "9999-12-31")
      .localeCompare(String(second.date || second.schedulingWindow?.startsOn || "9999-12-31"))
    || String(first.time || "23:59").localeCompare(String(second.time || "23:59"))
    || first.id.localeCompare(second.id)
  ));
}

function codeFixtures(code){
  const placeholders = finalsPlaceholders(code);
  const published = feed.events.filter(event => eventMatchesCode(event, code));
  const canonical = ["sport:afl", "sport:nrl"].includes(code.id)
    ? canonicalAflNrl.events.filter(event => event.sportDomainId === code.id)
    : [];
  return mergeFixtureRecords(placeholders, [...published, ...canonical], code.id, new Set(canonical));
}

function groupingMode(fixtures){
  if (fixtures.some(fixture => fixture.roundLabel || fixture.roundNumber)) return "round";
  if (fixtures.some(fixture => fixture.stage)) return "stage";
  return "competition-date";
}

function build(){
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const codes = taxonomy.sportDomains.filter(code => code.isActive !== false).map(code => {
    const fixtures = codeFixtures(code);
    const fileName = `${code.slug}.json`;
    const coverageStatus = fixtures.length === 0
      ? "unavailable"
      : ["sport:afl", "sport:nrl"].includes(code.id) ? "complete" : "partial";
    fs.writeFileSync(path.join(OUTPUT_DIR, fileName), `${JSON.stringify({
      schemaVersion: "code-inspector-chunk.v1",
      code: { id: code.id, slug: code.slug, name: code.name },
      coverageStatus,
      groupingMode: groupingMode(fixtures),
      freshAt: feed.publishedAt || null,
      fixtures,
    })}\n`);
    return {
      id: code.id,
      slug: code.slug,
      label: code.name,
      fixtureCount: fixtures.length,
      groupingMode: groupingMode(fixtures),
      coverageStatus,
      freshAt: feed.publishedAt || null,
      chunkPath: `data/code-inspector/${fileName}`,
    };
  });
  const expected = new Set(codes.map(code => `${code.slug}.json`));
  fs.readdirSync(OUTPUT_DIR).filter(name => name.endsWith(".json") && name !== "manifest.json" && !expected.has(name))
    .forEach(name => fs.unlinkSync(path.join(OUTPUT_DIR, name)));
  const manifest = { schemaVersion: "code-inspector.v1", generatedAt: feed.publishedAt || null, codes };
  fs.writeFileSync(path.join(OUTPUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (require.main === module){
  const manifest = build();
  console.log(`Code Inspector built: ${manifest.codes.length} codes, ${manifest.codes.reduce((total, code) => total + code.fixtureCount, 0)} fixtures.`);
}

module.exports = { build, codeFixtures, eventMatchesCode, mergeFixtureRecords, normalizeFixture };
