#!/usr/bin/env node

"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const { encryptSnapshot, readSnapshot } = require("../lib/follow-snapshot");

function cleanBaseUrl(value){
  return String(value || "").trim().replace(/\/+$/, "");
}

function anonymisedProfileId(userId){
  return crypto.createHash("sha256").update(`nothingsport-follow-audit:${userId}`).digest("hex").slice(0, 8);
}

function activeEntityFollows(preferences){
  const graph = preferences?.preferenceGraph || preferences?.preference_graph || {};
  return (Array.isArray(graph.entityFollows) ? graph.entityFollows : Array.isArray(graph.entity_follows) ? graph.entity_follows : [])
    .filter(follow => ["follow", "priority", "mute"].includes(String(follow?.followLevel || "")))
    .map(follow => ({ participantId:String(follow.participantId), followLevel:String(follow.followLevel) }))
    .filter(follow => follow.participantId)
    .sort((first, second) => first.participantId.localeCompare(second.participantId));
}

function serviceHeaders(key){
  const serverKey = String(key || "").trim();
  const headers = { apikey:serverKey, Accept:"application/json" };
  if (serverKey && !serverKey.startsWith("sb_secret_")){
    headers.Authorization = `Bearer ${serverKey}`;
  }
  return headers;
}

async function fetchProfiles({ fetchImpl = fetch, url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY } = {}){
  const baseUrl = cleanBaseUrl(url);
  if (!baseUrl || !key) throw new Error("SUPABASE_URL and a Supabase server secret are required for the server-only follow snapshot");
  const endpoint = `${baseUrl}/rest/v1/nothingsports_user_state?select=user_id,preferences&order=updated_at.asc`;
  const response = await fetchImpl(endpoint, {
    headers:serviceHeaders(key),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Supabase follow snapshot failed (${response.status})`);
  const rows = JSON.parse(body);
  return rows.map(row => ({
    profileHash:anonymisedProfileId(row.user_id),
    entityFollows:activeEntityFollows(row.preferences),
  }));
}

async function main(){
  const outputPath = process.env.FOLLOW_SNAPSHOT_PATH;
  if (!outputPath) throw new Error("FOLLOW_SNAPSHOT_PATH is required");
  const preloadedPath = process.env.FOLLOW_SNAPSHOT_PRELOADED_PATH;
  const preloadedKey = process.env.FOLLOW_SNAPSHOT_PRELOADED_KEY;
  if (preloadedPath || preloadedKey){
    if (!preloadedPath || !preloadedKey) throw new Error("Both preloaded snapshot path and key are required");
    const payload = readSnapshot(preloadedPath, preloadedKey);
    if (payload.schemaVersion !== "follow-snapshot.v1" || !Array.isArray(payload.profiles)) throw new Error("Preloaded follow snapshot is invalid");
    fs.writeFileSync(outputPath, `${JSON.stringify(encryptSnapshot(payload))}\n`, { encoding:"utf8", mode:0o600 });
    fs.chmodSync(outputPath, 0o600);
    console.log(`Encrypted connector follow snapshot validated for ${payload.profiles.length} anonymised profiles.`);
    return;
  }
  const profiles = await fetchProfiles();
  const payload = {
    schemaVersion:"follow-snapshot.v1",
    capturedAt:new Date().toISOString(),
    profiles,
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(encryptSnapshot(payload))}\n`, { encoding:"utf8", mode:0o600 });
  fs.chmodSync(outputPath, 0o600);
  console.log(`Encrypted follow snapshot captured for ${profiles.length} anonymised profiles.`);
}

if (require.main === module){
  main().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { activeEntityFollows, anonymisedProfileId, fetchProfiles, serviceHeaders };
