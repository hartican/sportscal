#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const feedControls = require("../config/feed-controls");
const { projectionForTarget, validateKnowledge } = require("./lib/editorial-narrative");

const DAY_MS = 86400000;
const OUTPUT_PATH = path.resolve("data/editorial-research-queue.v1.json");
function readJson(filePath){ return JSON.parse(fs.readFileSync(filePath, "utf8")); }
function writeJson(filePath, value){ fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`); }
function stakesFor(record){ return Number(record?.storyline?.stakes || record?.stakesScore || 0); }
function idFor(record){ return String(record?.canonicalEventId || record?.eventId || record?.id || ""); }
function eventTime(record){
  if (record?.startDate && !record?.date) return Date.parse(`${record.startDate}T00:00:00+10:00`);
  return feedControls.eventStart(record)?.getTime() ?? NaN;
}
function targetKey(targetType, record){ return `${targetType}:${idFor(record)}`; }
function buildQueue({ knowledge, feed, majorEvents, signals, reference = new Date() }){
  const now = reference.getTime();
  const earliest = now - 7 * DAY_MS;
  const latest = now + 30 * DAY_MS;
  const rolling = (feed.events || []).filter(record => {
    const start = eventTime(record);
    return stakesFor(record) >= 2 && Number.isFinite(start) && start >= earliest && start <= latest;
  }).map(record => ({ targetType:"feed-event", record, reason:"rolling-stakes-2-plus" }));
  const feedMarquees = (feed.events || [])
    .filter(record => stakesFor(record) === 5 && record.status !== "completed")
    .map(record => ({ targetType:"feed-event", record, reason:"surfaced-stakes-5" }));
  const majorMarquees = (majorEvents.events || [])
    .filter(record => record.stakesScore === 5 && record.lifecycleStatus !== "retired" && record.kind !== "ticket_sale")
    .map(record => ({ targetType:"major-event", record, reason:"surfaced-stakes-5" }));
  const uniqueTargets = new Map();
  [...rolling, ...feedMarquees, ...majorMarquees].forEach(target => {
    const key = targetKey(target.targetType, target.record);
    const previous = uniqueTargets.get(key);
    uniqueTargets.set(key, previous ? { ...previous, reason:`${previous.reason}+${target.reason}` } : target);
  });
  const signalById = new Map((signals.signals || []).map(signal => [signal.sourceEventId, signal]));
  const entries = [...uniqueTargets.values()].map(({ targetType, record, reason }) => {
    const projection = projectionForTarget(knowledge, targetType, record);
    const signal = signalById.get(idFor(record));
    const anticipationPriority = Number(signal?.anticipation?.score) >= 4 && Number(signal?.anticipation?.support) >= 3;
    const pulseUrgent = signal?.pulse?.active === true;
    const start = eventTime(record);
    const end = Number.isFinite(Date.parse(record.endTimeUtc || ""))
      ? Date.parse(record.endTimeUtc)
      : Number.isFinite(start) ? start + Math.max(1, Number(record.liveWindow) || 3) * 3600000 : NaN;
    const acceleratedDeadline = anticipationPriority ? new Date(now + 6 * 3600000).toISOString()
      : pulseUrgent && Number.isFinite(end) ? new Date(end + 60 * 60000).toISOString()
        : projection?.refreshAfter || null;
    return {
      targetType,
      targetId:idFor(record),
      title:record.name,
      stakes:stakesFor(record),
      startsAt:Number.isFinite(start) ? new Date(start).toISOString() : null,
      reason,
      projectionId:projection?.id || null,
      coverage:projection ? "covered" : "missing",
      priority:pulseUrgent ? "urgent-post-event" : anticipationPriority ? "audience-accelerated" : stakesFor(record) === 5 ? "marquee" : "rolling",
      refreshDeadline:acceleratedDeadline,
    };
  }).sort((left, right) => {
    const rank = { "urgent-post-event":0, "audience-accelerated":1, marquee:2, rolling:3 };
    return rank[left.priority] - rank[right.priority] || Date.parse(left.startsAt || "9999-12-31") - Date.parse(right.startsAt || "9999-12-31") || left.targetId.localeCompare(right.targetId);
  });
  return {
    schemaVersion:"editorial-research-queue.v1",
    generatedAt:reference.toISOString(),
    timeZone:"Australia/Sydney",
    rollingWindow:{ previousDays:7, nextDays:30, minimumStakes:2 },
    entries,
  };
}
function main(){
  const write = process.argv.includes("--write");
  const reference = new Date(process.env.NS_EDITORIAL_REFERENCE || Date.now());
  if (Number.isNaN(reference.getTime())) throw new Error("NS_EDITORIAL_REFERENCE must be a valid date when supplied");
  const knowledge = readJson("data/editorial-knowledge.v1.json");
  const issues = validateKnowledge(knowledge);
  if (issues.length) throw new Error(`Editorial knowledge invalid:\n- ${issues.join("\n- ")}`);
  const queue = buildQueue({
    knowledge,
    feed:readJson("feeds/incoming/events.json"),
    majorEvents:readJson("data/major-events.v1.json"),
    signals:readJson("data/editorial-nothingscore-snapshot.v1.json"),
    reference,
  });
  if (write) writeJson(OUTPUT_PATH, queue);
  const missing = queue.entries.filter(entry => entry.coverage === "missing");
  if (missing.length) throw new Error(`Editorial release gate blocked: ${missing.length} required card(s) lack substantive projections: ${missing.map(item => item.targetId).join(", ")}`);
  console.log(`${write ? "Built" : "Validated"} editorial queue: ${queue.entries.length} required targets, 100% covered.`);
}

if (require.main === module){ try { main(); } catch (error){ console.error(error.message); process.exitCode = 1; } }
module.exports = { buildQueue, eventTime, stakesFor };
