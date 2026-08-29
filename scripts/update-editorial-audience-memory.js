#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { validateKnowledge } = require("./lib/editorial-narrative");

const DAY_MS = 86400000;
const KNOWLEDGE_PATH = path.resolve("data/editorial-knowledge.v1.json");
const SNAPSHOT_PATH = path.resolve("data/editorial-nothingscore-snapshot.v1.json");
const FEED_PATH = path.resolve("feeds/incoming/events.json");
const MAJOR_PATH = path.resolve("data/major-events.v1.json");

function readJson(filePath){ return JSON.parse(fs.readFileSync(filePath, "utf8")); }
function writeJson(filePath, value){ fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`); }
function identitySet(record){ return new Set([record?.id, record?.eventId, record?.canonicalEventId].map(String).filter(Boolean)); }
function recordTime(record){
  const direct = Date.parse(record?.startTimeUtc || "");
  if (Number.isFinite(direct)) return direct;
  const day = record?.startDate || record?.date;
  if (!day) return NaN;
  return Date.parse(`${day}T${record?.time || "00:00"}:00+10:00`);
}
function endTime(record){
  const direct = Date.parse(record?.endTimeUtc || "");
  if (Number.isFinite(direct)) return direct;
  const majorEnd = record?.endDate ? Date.parse(`${record.endDate}T23:59:59+10:00`) : NaN;
  if (Number.isFinite(majorEnd)) return majorEnd;
  const start = recordTime(record);
  return Number.isFinite(start) ? start + Math.max(1, Number(record?.liveWindow) || 3) * 3600000 : NaN;
}
function targetRecords(feed, major){
  return [...(feed.events || []), ...(major.events || [])];
}
function recordForProjection(projection, records){
  return records.find(record => projection.targetIds.some(id => identitySet(record).has(String(id)))) || null;
}
function projectionForSource(knowledge, sourceEventId){
  return knowledge.eventProjections.find(projection => projection.targetIds.includes(sourceEventId)) || null;
}
function nextLinkedProjection(knowledge, sourceProjection, records){
  const sourceRecord = recordForProjection(sourceProjection, records);
  const sourceTime = recordTime(sourceRecord);
  if (!Number.isFinite(sourceTime)) return null;
  const linkedThreads = new Set(sourceProjection.threadIds);
  return knowledge.eventProjections
    .filter(projection => projection.id !== sourceProjection.id && projection.threadIds.some(id => linkedThreads.has(id)))
    .map(projection => ({ projection, time:recordTime(recordForProjection(projection, records)) }))
    .filter(item => Number.isFinite(item.time) && item.time > sourceTime)
    .sort((left, right) => left.time - right.time || left.projection.id.localeCompare(right.projection.id))[0]?.projection || null;
}
function updateAudienceMemories(knowledge, snapshot, feed, major, now = new Date()){
  const records = targetRecords(feed, major);
  const nowMs = now.getTime();
  const active = (knowledge.audienceMemories || []).filter(memory => Date.parse(memory.expiresAt) > nowMs);
  const memoryBySource = new Map(active.map(memory => [memory.sourceEventId, memory]));
  for (const signal of snapshot.signals || []){
    const impact = signal.impact;
    if (!impact || Number(impact.uniqueContributorCount) < 3 || !Number.isFinite(Number(impact.score))) continue;
    const sourceProjection = projectionForSource(knowledge, signal.sourceEventId);
    if (!sourceProjection) continue;
    const carryProjection = nextLinkedProjection(knowledge, sourceProjection, records);
    const capturedAt = signal.capturedAt || snapshot.capturedAt;
    const ninetyDayExpiry = Date.parse(capturedAt) + 90 * DAY_MS;
    const carryRecord = carryProjection ? recordForProjection(carryProjection, records) : null;
    const carryEnd = endTime(carryRecord);
    const expiresAt = new Date(Number.isFinite(carryEnd) ? Math.min(ninetyDayExpiry, carryEnd) : ninetyDayExpiry).toISOString();
    const threadIds = [...sourceProjection.threadIds];
    const subjectIds = [...new Set(threadIds.flatMap(id => knowledge.narrativeThreads.find(thread => thread.id === id)?.subjectIds || []))];
    memoryBySource.set(signal.sourceEventId, {
      id:`audience-memory:${signal.sourceEventId}`,
      sourceEventId:signal.sourceEventId,
      linkedThreadIds:threadIds,
      subjectIds,
      impactScore:Number(impact.score),
      uniqueContributorCount:Number(impact.uniqueContributorCount),
      leadingTags:(impact.leadingTags || []).slice(0, 3),
      capturedAt,
      expiresAt,
      carryProjectionId:carryProjection?.id || null,
    });
  }
  const memories = [...memoryBySource.values()].filter(memory => Date.parse(memory.expiresAt) > nowMs);
  const validMemoryIds = new Set(memories.map(memory => memory.id));
  knowledge.eventProjections.forEach(projection => { if (projection.audienceMemoryId && !validMemoryIds.has(projection.audienceMemoryId)) delete projection.audienceMemoryId; });
  memories.forEach(memory => {
    const sourceProjection = projectionForSource(knowledge, memory.sourceEventId);
    if (sourceProjection) sourceProjection.audienceMemoryId = memory.id;
    const carryProjection = knowledge.eventProjections.find(projection => projection.id === memory.carryProjectionId);
    if (carryProjection) carryProjection.audienceMemoryId = memory.id;
  });
  const capturedAt = Date.parse(snapshot.capturedAt || "") > Date.parse(knowledge.updatedAt || "") ? snapshot.capturedAt : knowledge.updatedAt;
  return { ...knowledge, audienceMemories:memories, updatedAt:capturedAt };
}
function main(){
  const write = process.argv.includes("--write");
  const knowledge = readJson(KNOWLEDGE_PATH);
  const updated = updateAudienceMemories(knowledge, readJson(SNAPSHOT_PATH), readJson(FEED_PATH), readJson(MAJOR_PATH));
  const issues = validateKnowledge(updated);
  if (issues.length) throw new Error(`Editorial memory update invalid:\n- ${issues.join("\n- ")}`);
  if (write) writeJson(KNOWLEDGE_PATH, updated);
  console.log(`${write ? "Updated" : "Validated"} ${updated.audienceMemories.length} qualifying Sentiment memory record(s).`);
}

if (require.main === module){ try { main(); } catch (error){ console.error(error.message); process.exitCode = 1; } }
module.exports = { nextLinkedProjection, updateAudienceMemories };
