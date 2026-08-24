#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const followFirst = require("../config/follow-first");

const meta = followFirst.normalizeMeta({
  sports:["afl", "football", "unknown"],
  majorEvents:["afl-finals"],
  offerInterests:["tickets-live"],
  location:{ label:"Sydney", latitude:-33.8688, longitude:151.2093, radiusKm:999, source:"places" },
});
assert.deepEqual(meta.sports, ["afl", "football"]);
assert.equal(meta.location.radiusKm, 300);
assert.equal(meta.location.latitude, -33.87);
assert.equal(meta.location.longitude, 151.21);
assert.equal(meta.personalisedOffersConsent, false);

const seeded = followFirst.applyMetaSeed({}, meta);
assert.equal(seeded.changed, true);
assert.deepEqual(seeded.preferences.selectedSelectorEntityIds, ["sport:afl", "sport:football"]);
assert.deepEqual(seeded.preferences.followFirst.australiansOnlySportIds, ["afl", "football"]);
assert.equal(followFirst.applyMetaSeed(seeded.preferences, meta).changed, false);

const followed = followFirst.migratePreferences({
  followedSports:["afl"],
  preferenceGraph:{ entityFollows:[{ participantId:"team:afl:test", followLevel:"follow" }] },
});
assert.equal(followFirst.reasonForEvent({ key:"afl", participantIds:["team:afl:test"] }, followed, { participantLabel:() => "Test Club" }).label, "Because you follow Test Club");
assert.equal(followFirst.reasonForEvent({ key:"afl", australianInterest:true }, followed).label, "Because you follow Aussies Only");
assert.equal(followFirst.reasonForEvent({ key:"afl" }, followed).label, "Because you follow Aussies Only");
assert.equal(followFirst.reasonForEvent({ key:"football", majorEventId:"fifa-world-cup", venue:"Leeds" }, { ...followed, followedSports:["football"] }, { locationMatches:true }), null, "sport, event and location metadata must not independently make a Feed card eligible");
assert.equal(followFirst.stageLabel({ stage:"Preliminary Final" }), "Prelim");
assert.equal(followFirst.stageLabel({ roundLabel:"Quarter-finals" }), "QF");

const feedback = followFirst.appendFeedback(followed, { eventId:"event:1", direction:"negative", targetId:"team:afl:test" });
assert.equal(feedback.followFirst.feedback.entries.length, 1);
assert.equal(feedback.followFirst.feedback.entries[0].direction, "negative");
assert.equal(feedback.followFirst.feedback.entries[0].weight, -1);

let opened = followed;
for (const id of ["one", "two", "three"]) opened = followFirst.registerOpen(opened, id);
assert.equal(followFirst.shouldPromptRefinement(opened), true);

const html = fs.readFileSync("index.html", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
const notificationApi = fs.readFileSync("api/notifications.js", "utf8");
const dispatchApi = fs.readFileSync("api/notification-dispatch.js", "utf8");
const locationApi = fs.readFileSync("api/location.js", "utf8");
const userMetaApi = fs.readFileSync("api/user-meta.js", "utf8");
const serverSync = fs.readFileSync("config/server-sync.js", "utf8");
const migration = fs.readFileSync("supabase/follow-first-user-meta-and-notifications.sql", "utf8");
const vercel = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
const manifest = JSON.parse(fs.readFileSync("manifest.webmanifest", "utf8"));
const packageDocument = JSON.parse(fs.readFileSync("package.json", "utf8"));
const followFirstSource = fs.readFileSync("config/follow-first.js", "utf8");
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
assert(scriptMatch);
assert.doesNotThrow(() => new Function(scriptMatch[1]), "the browser application must parse");
assert.match(html, />Feed</);
assert.match(html, />Follow</);
assert.match(html, /Standings &amp; Fixtures/);
assert.doesNotMatch(html, /<span class="tab-label">Inspector<\/span>/);
const navLabels = Array.from(html.matchAll(/<span class="tab-label">([^<]+)<\/span>/g), match => match[1]);
assert.deepEqual(navLabels.slice(0, 4), ["Feed", "Events", "Follow", "Standings &amp; Fixtures"]);
assert(html.includes('window.scrollTo({ top: 0, behavior: "auto" })'), "tab and inspector navigation must reset the viewport");

const settingsMenu = html.match(/function renderSettingsMenu\(body\)\{[\s\S]*?\n\}/)?.[0] || "";
assert.deepEqual(
  Array.from(settingsMenu.matchAll(/settingsMenuItem\("[^"]+",\s*"[^"]+",\s*"([^"]+)"/g), match => match[1]),
  ["Account", "Subscriptions", "Notifications", "Set location", "Feedback"],
);
assert(!settingsMenu.includes("Froth") && !settingsMenu.includes("Tune") && !settingsMenu.includes("Local venues"));
assert(!html.includes('id="calendarSyncBtn"') && !html.includes('id="calendarSyncModal"'));
assert(!fs.existsSync("api/calendar.js") && !fs.existsSync("lib/calendar-sync.js"));

assert(html.includes('className = "matchup-stage-badge"') && html.includes("FOLLOW_FIRST?.stageLabel"));
assert(html.includes('className = "follow-reason-tag"') && followFirstSource.includes("Because you follow"));
assert(html.includes("appendEventQuickActions") && html.includes("Remind me") && html.includes("<span>View</span>"));
assert(/\.swipe-coaching[\s\S]{0,500}color:\s*#43b9ff/.test(html));
assert(/\.swipe-coaching[\s\S]{0,500}font-size:\s*\.85rem/.test(html));
assert(/\.swipe-coaching[\s\S]{0,500}opacity:\s*\.7/.test(html));
assert(html.includes('data-tab="follow"') && html.includes("renderFollowView"));
assert(html.includes('["all-fixtures", "Timetable"]') && html.includes('["matches", "Matches"]') && html.includes('["players", "Players"]') && html.includes('["standings", "Standings"]'));
assert(html.includes("codeInspectorPlayersExpanded") && html.includes('"Top 3 + followed"'));

assert(html.includes("startupSportsGrid") && html.includes("startupEventsGrid") && html.includes("startupOffersGrid"));
assert(html.includes("personalisedOffersConsent") && html.includes("startupLocationQuery"));
assert(!/startup[^\n]{0,80}(gender|age bracket)/i.test(html), "signup must not ask for gender or age bracket");
assert(html.includes("shouldPromptRefinement") && html.includes("firstSwipeAt"));
assert(serverSync.includes("async loadMeta()") && serverSync.includes("async saveMeta(meta)"));
assert(userMetaApi.includes("nothingsports_user_meta") && userMetaApi.includes("seed_hash"));
assert(migration.includes("force row level security") && migration.includes("protect_nothingsports_offer_consent"));
assert(migration.includes("Gender and full age brackets are intentionally not collected"));

assert(html.includes("LOCALITY_COORDINATES") && html.includes("distanceKm") && html.includes("radiusKm"));
assert(locationApi.includes("GOOGLE_MAPS_API_KEY") && locationApi.includes("FALLBACK_LOCATIONS"));
assert(packageDocument.dependencies["web-push"]);
assert(html.includes("pushInstallationCredentials") && html.includes("ensurePushInstallation"));
assert(notificationApi.includes("remind_at") && notificationApi.includes("15 * 60 * 1000"));
assert(dispatchApi.includes("CRON_SECRET") && dispatchApi.includes("webpush.sendNotification"));
assert(worker.includes('addEventListener("push"') && worker.includes('addEventListener("notificationclick"'));
assert(vercel.crons.some(cron => cron.path === "/api/notification-dispatch"));
assert.equal(manifest.id, "/");

for (const [name, minimum] of [["nrl", 500], ["afl", 650]]){
  const directory = JSON.parse(fs.readFileSync(`data/canonical/${name}-directory.v1.json`, "utf8"));
  assert(directory.teams.length >= (name === "nrl" ? 17 : 18));
  assert(directory.players.length >= minimum, `${name.toUpperCase()} must include current full rosters`);
}

console.log("Follow-first release contract passed: metadata, navigation, cards, location, directories, reminders, and retired UI checks are valid.");
