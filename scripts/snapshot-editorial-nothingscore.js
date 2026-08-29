#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { supabaseServiceRoleConfig } = require("../lib/supabase-server");

const OUTPUT_PATH = path.resolve("data/editorial-nothingscore-snapshot.v1.json");
const FEED_PATH = path.resolve("feeds/incoming/events.json");
const FIXTURE_PATH = process.env.NS_EDITORIAL_SNAPSHOT_FIXTURE ? path.resolve(process.env.NS_EDITORIAL_SNAPSHOT_FIXTURE) : null;

function readJson(filePath){ return JSON.parse(fs.readFileSync(filePath, "utf8")); }
function writeJson(filePath, value){ fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`); }
function eventId(event){ return String(event?.canonicalEventId || event?.eventId || event?.id || ""); }
function contributorCount(aggregate){ return Number(aggregate?.uniqueContributors ?? aggregate?.contributorCount ?? 0); }
function safeTags(aggregate){
  return (Array.isArray(aggregate?.leadingTags) ? aggregate.leadingTags : [])
    .map(item => typeof item === "string" ? item : item?.tag)
    .map(String)
    .filter(Boolean)
    .slice(0, 3);
}
function safeAggregate(aggregate){
  if (!aggregate || aggregate.building || aggregate.score == null) return null;
  return {
    score:Number(aggregate.score),
    support:Number(aggregate.support || 0),
    uniqueContributorCount:contributorCount(aggregate),
    leadingTags:safeTags(aggregate),
  };
}
function safeSignal(snapshot, capturedAt){
  const anticipation = safeAggregate(snapshot?.aggregates?.heat);
  const pulse = safeAggregate(snapshot?.aggregates?.pulse);
  const impact = safeAggregate(snapshot?.aggregates?.impact);
  return {
    sourceEventId:String(snapshot?.canonicalEventId || snapshot?.eventId || ""),
    anticipation,
    pulse:pulse ? { ...pulse, active:snapshot?.phase === "pulse" } : null,
    impact,
    capturedAt,
  };
}
function validateSnapshot(document){
  const issues = [];
  if (document?.schemaVersion !== "editorial-nothingscore-snapshot.v1") issues.push("invalid snapshot schemaVersion");
  if (!Number.isFinite(Date.parse(document?.capturedAt || ""))) issues.push("snapshot capturedAt must be an ISO date-time");
  if (!Array.isArray(document?.signals)) issues.push("snapshot signals must be an array");
  (document?.signals || []).forEach((signal, index) => {
    if (!signal.sourceEventId) issues.push(`signals[${index}] needs sourceEventId`);
    const encoded = JSON.stringify(signal);
    if (/\b(?:userId|user_id|profileId|profile_id|persona|rawRatings|ratings|contributors)\b/.test(encoded)) issues.push(`signals[${index}] contains identity or raw-rating data`);
  });
  return issues;
}
async function capture({ now = new Date(), snapshotsImpl } = {}){
  const feed = readJson(FEED_PATH);
  const ids = [...new Set((feed.events || []).map(eventId).filter(Boolean))];
  const snapshots = FIXTURE_PATH
    ? readJson(FIXTURE_PATH).snapshots || []
    : await snapshotsImpl(ids, { now });
  const capturedAt = now.toISOString();
  const document = {
    schemaVersion:"editorial-nothingscore-snapshot.v1",
    capturedAt,
    source:FIXTURE_PATH ? "fixture" : "supabase-aggregate",
    signals:snapshots.map(snapshot => safeSignal(snapshot, capturedAt)).filter(signal => signal.sourceEventId),
  };
  const issues = validateSnapshot(document);
  if (issues.length) throw new Error(`Unsafe Nothingscore editorial snapshot:\n- ${issues.join("\n- ")}`);
  return document;
}
async function main(){
  const write = process.argv.includes("--write");
  const check = process.argv.includes("--check");
  let document = fs.existsSync(OUTPUT_PATH) ? readJson(OUTPUT_PATH) : null;
  if (FIXTURE_PATH || supabaseServiceRoleConfig().configured){
    const snapshotsImpl = require("../lib/nothingscore-server").snapshots;
    try{
      document = await capture({ snapshotsImpl });
      if (write) writeJson(OUTPUT_PATH, document);
    }catch(error){
      if (!document) throw error;
      console.warn(`Nothingscore aggregate refresh unavailable; retaining the last safe snapshot. ${error.message}`);
    }
  } else {
    console.log("Nothingscore service credentials are unavailable; retaining the last safe aggregate snapshot.");
  }
  const issues = validateSnapshot(document);
  if (issues.length) throw new Error(`Editorial Nothingscore snapshot invalid:\n- ${issues.join("\n- ")}`);
  if (check && write) throw new Error("Use either --write or --check, not both.");
  console.log(`${write ? "Captured or preserved" : "Validated"} ${document.signals.length} privacy-safe Nothingscore aggregate signal(s).`);
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });

module.exports = { capture, safeAggregate, safeSignal, validateSnapshot };
