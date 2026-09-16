#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const SCHEMA_VERSION = "chat-fixture-registry.v1";
const ROOT = path.resolve(__dirname, "..");
const MANIFEST_PATH = "data/code-inspector/manifest.json";
const OUTPUT_PATH = "data/chat-fixtures.v1.json";

function values(items){
  return [...new Set(items.map(value => String(value || "").trim()).filter(Boolean))];
}

function aliasesFor(event){
  return values([
    event?.canonicalEventId,
    event?.eventId,
    event?.id,
    ...(Array.isArray(event?.sourceEventIds) ? event.sourceEventIds : []),
  ]);
}

function compactFixture(event){
  const aliases = aliasesFor(event);
  const canonicalEventId = String(event?.canonicalEventId || event?.eventId || event?.id || aliases[0] || "").trim();
  if (!canonicalEventId) return null;
  return {
    canonicalEventId,
    eventId:String(event?.eventId || event?.id || canonicalEventId),
    id:String(event?.id || event?.eventId || canonicalEventId),
    sourceEventIds:values([canonicalEventId, ...aliases]),
    name:String(event?.displayTitleCompact || event?.name || "Fixture"),
    sport:String(event?.sport || event?.key || event?.codeId || "Sport"),
    competitionId:event?.competitionId || null,
    startTimeUtc:event?.startTimeUtc || null,
    sessionStartTimeUtc:event?.sessionStartTimeUtc || event?.timelineSortTimeUtc || null,
    timePrecision:event?.timePrecision || null,
    sequenceInSession:Number.isFinite(Number(event?.sequenceInSession)) ? Number(event.sequenceInSession) : null,
    date:event?.date || null,
    time:event?.time || null,
    venue:event?.venueDisplayName || event?.venue || null,
    broadcaster:event?.broadcaster || null,
    liveWindow:Number(event?.liveWindow || 3),
    sourceName:event?.canonicalSourceName || event?.sourceName || null,
    sourceUrl:event?.canonicalSourceUrl || event?.sourceUrl || null,
    sourceCheckedAt:event?.canonicalSourceCheckedAt || event?.sourceCheckedAt || null,
    status:event?.status || null,
    scheduleStatus:event?.scheduleStatus || null,
    statusUpdatedAt:event?.statusUpdatedAt || null,
    resultPublishedAt:event?.resultPublishedAt || null,
  };
}

function mergeFixture(first, second){
  const merged = { ...first };
  for (const [key, value] of Object.entries(second)){
    if (key === "sourceEventIds") continue;
    if (value !== null && value !== undefined && value !== "") merged[key] = value;
  }
  merged.canonicalEventId = first.canonicalEventId;
  merged.sourceEventIds = values([...first.sourceEventIds, ...second.sourceEventIds, first.canonicalEventId]);
  return merged;
}

function buildRegistry({ rootDir = ROOT } = {}){
  const readJson = relative => JSON.parse(fs.readFileSync(path.join(rootDir, relative), "utf8"));
  const manifest = readJson(MANIFEST_PATH);
  if (manifest?.schemaVersion !== "code-inspector.v1" || !Array.isArray(manifest.codes)){
    throw new Error("The Code Inspector manifest is unavailable or unsupported.");
  }
  const fixtures = new Map();
  const aliasOwners = new Map();
  for (const code of manifest.codes){
    if (!code.followSchedulePath) continue;
    const document = readJson(code.followSchedulePath);
    for (const event of document.fixtures || []){
      const fixture = compactFixture(event);
      if (!fixture) continue;
      const owners = values(fixture.sourceEventIds.map(alias => aliasOwners.get(alias)));
      const key = owners[0] || fixture.canonicalEventId;
      let next = fixtures.has(key) ? fixtures.get(key) : { ...fixture, canonicalEventId:key };
      for (const owner of owners.slice(1)){
        if (!fixtures.has(owner)) continue;
        next = mergeFixture(next, fixtures.get(owner));
        fixtures.delete(owner);
      }
      next = mergeFixture(next, fixture);
      fixtures.set(key, next);
      next.sourceEventIds.forEach(alias => aliasOwners.set(alias, key));
    }
  }
  const records = [...fixtures.values()].sort((left, right) => {
    const leftTime = Date.parse(left.startTimeUtc || left.sessionStartTimeUtc || "");
    const rightTime = Date.parse(right.startTimeUtc || right.sessionStartTimeUtc || "");
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return leftTime - rightTime;
    if (Number.isFinite(leftTime) !== Number.isFinite(rightTime)) return Number.isFinite(leftTime) ? -1 : 1;
    return left.canonicalEventId.localeCompare(right.canonicalEventId);
  });
  return {
    schemaVersion:SCHEMA_VERSION,
    generatedAt:manifest.generatedAt || null,
    fixtureCount:records.length,
    aliasCount:new Set(records.flatMap(record => record.sourceEventIds)).size,
    fixtures:records,
  };
}

function writeRegistry({ rootDir = ROOT, outputPath = OUTPUT_PATH } = {}){
  const registry = buildRegistry({ rootDir });
  fs.writeFileSync(path.join(rootDir, outputPath), `${JSON.stringify(registry)}\n`);
  return registry;
}

if (require.main === module){
  const registry = writeRegistry();
  console.log(`Chat fixture registry built: ${registry.fixtureCount} fixtures, ${registry.aliasCount} aliases.`);
}

module.exports = { SCHEMA_VERSION, aliasesFor, buildRegistry, compactFixture, mergeFixture, writeRegistry };
