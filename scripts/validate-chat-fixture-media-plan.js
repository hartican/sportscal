#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const chatHandler = require("../api/chat");
const chatPolicy = require("../config/chat-policy");

const followFixtures = JSON.parse(fs.readFileSync("data/follow-fixtures.v1.json", "utf8")).events;
const findFixture = pattern => followFixtures.find(fixture => pattern.test(fixture.name || ""));
const sabalenka = findFixture(/Sabalenka v (?:Camila )?Osorio/i);
const alcaraz = findFixture(/Safiullin v (?:Carlos )?Alcaraz/i);

assert(sabalenka, "Sabalenka v Osorio must exist in canonical follow fixtures");
assert(alcaraz, "Safiullin v Alcaraz must exist in canonical follow fixtures");
assert.equal(chatPolicy.fixtureEligibility(sabalenka, new Date("2026-08-31T12:00:00Z")).eligible, true);
assert.equal(chatPolicy.fixtureEligibility(alcaraz, new Date("2026-08-31T12:00:00Z")).eligible, true);
assert.equal(chatPolicy.fixtureTiming(alcaraz).timingPrecision, "follows");
assert.equal(chatPolicy.fixtureTiming(alcaraz).startTimeUtc, null, "follows timing must not invent a match start");
assert.equal(chatPolicy.fixtureTiming(alcaraz).sessionStartTimeUtc, "2026-08-31T15:30:00.000Z");

const fixtureMap = chatHandler._test.loadFixtureMap();
assert(fixtureMap.has(alcaraz.canonicalEventId || alcaraz.eventId || alcaraz.id), "Chat's deployed fixture index must include Alcaraz from follow fixtures");
assert.equal(chatHandler._test.fixtureIsUpcomingOrLive(alcaraz, new Date("2026-08-31T12:00:00Z")), true);

assert.equal(chatPolicy.GIF_UNLOCK_POINTS, 25);
assert.deepEqual(chatPolicy.gifCapability(24), { lifetimeNscPoints:24, gifMinimumPoints:25, canUseGifs:false });
assert.deepEqual(chatPolicy.gifCapability(25), { lifetimeNscPoints:25, gifMinimumPoints:25, canUseGifs:true });

const api = fs.readFileSync("api/chat.js", "utf8");
const sql = fs.readFileSync("supabase/private-fixture-chat.sql", "utf8");
const html = fs.readFileSync("index.html", "utf8");
assert.match(api, /nsc_points_required/);
assert.match(api, /lifetimeNscPoints/);
assert.match(api, /gif-search/);
assert.match(api, /api\.giphy\.com\/v1\/gifs\/search/, "configured GIPHY search must remain available");
assert.match(api, /commons\.wikimedia\.org\/w\/api\.php/, "GIF search must have a no-secret production fallback");
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
assert.match(sql, /status[^\n]+closing/i);
assert.match(html, /Game selfie/);
assert.match(html, /Shift\+Enter|shiftKey/);
assert.match(html, /25 NSC points/);
assert.match(html, /Saved game media/);
assert.match(html, /refreshChatMessageStream\(\{ autoScroll:true, preserveScroll:false \}\)/, "optimistic sends must update only the message stream");

console.log("Chat fixture and media plan valid: follows timing, private media and the 25-point GIF gate are enforced.");
