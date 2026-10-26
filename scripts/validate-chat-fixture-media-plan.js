#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path"), os = require("node:os");
const { buildRegistry } = require("./build-chat-fixture-registry");
const chatHandler = require("../api/chat");
const chatPolicy = require("../config/chat-policy");

const followFixtures = JSON.parse(fs.readFileSync("data/follow-fixtures.v1.json", "utf8")).events;
// Timing regression fixtures are deterministic; the rolling Follow window legitimately expires old matches.
const sabalenka = { id:"qa:sabalenka-osorio", name:"Sabalenka v Osorio", status:"confirmed", startTimeUtc:"2026-08-31T15:30:00.000Z" };
const alcaraz = { id:"qa:safiullin-alcaraz", name:"Safiullin v Alcaraz", status:"confirmed", timePrecision:"follows", sessionStartTimeUtc:"2026-08-31T15:30:00.000Z", sequenceInSession:2 };
assert.equal(chatPolicy.fixtureEligibility(sabalenka, new Date("2026-08-31T12:00:00Z")).eligible, true);
assert.equal(chatPolicy.fixtureEligibility(alcaraz, new Date("2026-08-31T12:00:00Z")).eligible, true);
assert.equal(chatPolicy.fixtureTiming(alcaraz).timingPrecision, "follows");
assert.equal(chatPolicy.fixtureTiming(alcaraz).startTimeUtc, null, "follows timing must not invent a match start");
assert.equal(chatPolicy.fixtureTiming(alcaraz).sessionStartTimeUtc, "2026-08-31T15:30:00.000Z");
const fixtureMap = chatHandler._test.loadFixtureMap();
const tennis = followFixtures.filter(f => f.key === "tennis" || f.sport === "tennis");
function assertRegistryIncludes(fixtures, registry){
  for (const fixture of fixtures) assert(registry.has(fixture.canonicalEventId || fixture.eventId || fixture.id), "Chat registry must retain every published tennis Follow fixture");
}
assertRegistryIncludes(tennis,fixtureMap);
// Run the actual schedule-to-registry builder and API reader unconditionally,
// even when the rolling published schedule has no tennis in its current window.
const rootDir=fs.mkdtempSync(path.join(os.tmpdir(),"ns-chat-registry-"));
try{
  fs.mkdirSync(path.join(rootDir,"data/code-inspector"),{recursive:true});
  const fixture={...alcaraz,id:"qa:tennis:source",canonicalEventId:"qa:tennis:canonical",key:"tennis",sourceEventIds:["qa:tennis:alias"]};
  fs.writeFileSync(path.join(rootDir,"data/code-inspector/manifest.json"),JSON.stringify({schemaVersion:"code-inspector.v1",codes:[{followSchedulePath:"data/tennis.json"}]}));
  fs.writeFileSync(path.join(rootDir,"data/tennis.json"),JSON.stringify({fixtures:[fixture]}));
  const registry=buildRegistry({rootDir});assert.equal(registry.fixtureCount,1,"deterministic tennis must enter the actual registry builder");
  const load=fixtures=>chatHandler._test.loadFixtureMap(()=>JSON.stringify({...registry,fixtures}),rootDir),actual=load(registry.fixtures);
  assertRegistryIncludes([fixture],actual);assert.equal(actual.get("qa:tennis:alias").canonicalEventId,fixture.canonicalEventId);
  assert.throws(()=>assertRegistryIncludes([fixture],load([])),/Chat registry must retain/,"removing the registry fixture must genuinely fail the same inclusion gate");
}finally{fs.rmSync(rootDir,{recursive:true,force:true});}
assert.equal(chatHandler._test.fixtureIsUpcomingOrLive(alcaraz, new Date("2026-08-31T12:00:00Z")), true);

assert.equal(chatPolicy.GIF_UNLOCK_POINTS, 25);
assert.deepEqual(chatPolicy.gifCapability(24), { lifetimeNscPoints:24, gifMinimumPoints:25, canUseGifs:false });
assert.deepEqual(chatPolicy.gifCapability(25), { lifetimeNscPoints:25, gifMinimumPoints:25, canUseGifs:true });

const api = fs.readFileSync("api/chat.js", "utf8");
const gifProvider = fs.readFileSync("lib/giphy-provider.js", "utf8");
const sql = fs.readFileSync("supabase/private-fixture-chat.sql", "utf8");
const gifReferenceMigration = fs.readFileSync("supabase/migrations/20260904114104_giphy_external_references.sql", "utf8");
const html = fs.readFileSync("index.html", "utf8");
assert.match(api, /nsc_points_required/);
assert.match(api, /lifetimeNscPoints/);
assert.match(api, /mode === "gif-config"/);
assert.match(api, /async function gifConfig\(user\)[\s\S]{0,300}requireGifCapability\(user\)/, "GIPHY client configuration must remain authenticated and capability-gated");
assert.match(api, /async function createGiphyReference/);
assert.match(api, /case "gif-reference"/);
assert.doesNotMatch(api, /api\.giphy\.com/, "the server must not proxy GIPHY API calls");
assert.match(gifProvider, /api\.giphy\.com\/v1\/gifs\/search/, "the authenticated configuration must name GIPHY's direct search endpoint");
assert.match(gifProvider, /gif_provider_unconfigured/, "a missing provider key must fail explicitly");
assert.match(api, /attachment-upload-url/);
assert.match(api, /attachment-save/);
assert.match(api, /saved-media-delete/);
assert.match(api, /mode === "saved-media"/);
assert.match(api, /sniffAttachmentContentType/);
assert.match(api, /GIF87a/);
assert.match(api, /method:"DELETE", body:\{ prefixes:/);
assert.match(api, /image\/gif/);
assert.match(sql, /nothingsports_chat_attachments/i);
assert.match(sql, /nothingsports_saved_game_media/i);
assert.match(sql, /external_url text/i);
assert.match(sql, /nothingsports_chat_attachments_location_check/i);
assert.match(gifReferenceMigration, /force row level security/i);
assert.match(gifReferenceMigration, /revoke all[^;]+public, anon, authenticated/is);
assert.match(gifReferenceMigration, /grant select, insert, update, delete[^;]+service_role/is);
assert.match(gifReferenceMigration, /giphy\\\.\(com\|net\)/i, "external references must be constrained to trusted GIPHY hosts");
assert.match(sql, /status[^\n]+closing/i);
assert.match(html, /Game selfie/);
assert.match(html, /Shift\+Enter|shiftKey/);
assert.match(html, /Requires 25 points/);
assert.match(html, /Saved game media/);
assert.match(html, /refreshChatMessageStream\(\{ autoScroll:true, preserveScroll:false \}\)/, "optimistic sends must update only the message stream");

const mediaUi = fs.readFileSync("config/chat-media-ui.js", "utf8");
assert.match(mediaUi, /mode:"gif-config"/);
assert.match(mediaUi, /action:"gif-reference"/);
assert.match(mediaUi, /api_key:apiKey/);
assert.match(mediaUi, /https:\/\/api\.giphy\.com/);
assert.match(mediaUi, /credentials:"omit"/);
assert.doesNotMatch(mediaUi, /GIPHY_API_KEY/, "the browser bundle must not hardcode an environment credential");
assert.match(mediaUi, /retryButton\.textContent = "Retry"/);
assert.match(html, /attachment\.saved \|\| attachment\.external/, "direct provider references must not expose the save-to-storage action");

console.log("Chat fixture and media plan valid: follows timing, private uploads, direct GIPHY references and the 25-point GIF gate are enforced.");
