#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const followFirst = require("../config/follow-first");
const representativeEvents = require("../config/representative-events");
const selectorTaxonomy = require("../config/selector-taxonomy");
const { fixtureToCard } = require("./sync-canonical-fixtures-to-feed");

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
assert.equal(seeded.preferences.followFirst.australiaInternationalsEnabled, true, "Australia in internationals is one default-on global preference");
assert.equal(followFirst.applyMetaSeed(seeded.preferences, meta).changed, false);

const followed = followFirst.migratePreferences({
  followedSports:["afl", "rugby"],
  followFirst:{ australiansOnlySportIds:["afl", "nrl", "rugby"] },
  preferenceGraph:{ entityFollows:[
    { participantId:"team:afl:test", followLevel:"follow" },
    { participantId:"competitor:rugby:test", followLevel:"follow" },
  ] },
});
assert.equal(followed.followFirst.australiaInternationalsEnabled, true, "legacy per-sport Australia selections migrate to the default global switch");
assert.equal(Object.hasOwn(followed.followFirst, "australiansOnlySportIds"), false, "retired per-sport Australia state must not survive migration");
assert.deepEqual(followFirst.migratePreferences(followed), followed, "the global Australia migration must be idempotent");
const teamReason = followFirst.reasonForEvent({ key:"afl", participantIds:["team:afl:test"] }, followed, { participantLabel:() => "Test Club" });
assert.equal(teamReason.label, "Because you follow Test Club");
assert.equal(teamReason.entityKind, "team");
assert.equal(teamReason.displayTag, false, "team follows remain eligibility-only context");
const playerReason = followFirst.reasonForEvent({ key:"rugby", participantIds:["competitor:rugby:test"] }, followed, { participantLabel:() => "Test Player" });
assert.equal(playerReason.label, "Because you follow Test Player");
assert.equal(playerReason.entityKind, "athlete");
assert.equal(playerReason.displayTag, true, "only a directly followed athlete gets visible context");
assert.equal(followFirst.reasonForEvent({ key:"rugby", competitionScope:"domestic", representativeCountryCodes:["AU"] }, followed), null, "Australian domestic events must not qualify");
assert.equal(followFirst.reasonForEvent({ key:"rugby", competitionScope:"international", representativeCountryCodes:[] }, followed), null, "international metadata still requires explicit Australian representation");
const australiaReason = followFirst.reasonForEvent({ key:"rugby", competitionScope:"international", representativeCountryCodes:["AUS"] }, followed);
assert.equal(australiaReason.entityKind, "national-representation");
assert.equal(australiaReason.displayTag, false);
assert.equal(followFirst.reasonForEvent({ key:"football", majorEventId:"fifa-world-cup", venue:"Leeds" }, { ...followed, followedSports:["football"] }, { locationMatches:true }), null, "sport, event and location metadata must not independently make a Feed card eligible");
const fiveOfFive = { key:"rugby", eventId:"fixture:five", date:"2026-09-01", time:"19:30", stakesScore:5, cardKind:"fixture" };
assert.equal(followFirst.reasonForEvent(fiveOfFive, followed)?.type, "sport-high-stakes", "a followed sport must surface concrete 5/5 fixtures");
assert.equal(followFirst.reasonForEvent({ ...fiveOfFive, tournamentParent:true }, followed), null, "tournament parents must never qualify through a sport follow");
assert.equal(followFirst.reasonForEvent({ ...fiveOfFive, competitionScope:"international", representativeCountryCodes:["AUS"] }, { ...followed, followFirst:{ ...followed.followFirst, australiaInternationalsEnabled:false } }), null, "the global switch suppresses Australia-specific and high-stakes automatic eligibility");
assert.equal(followFirst.reasonForEvent({ ...fiveOfFive, competitionScope:"international", representativeCountryCodes:["AUS"], participantIds:["team:direct"] }, { ...followed, followFirst:{ ...followed.followFirst, australiaInternationalsEnabled:false }, preferenceGraph:{ entityFollows:[{ participantId:"team:direct", followLevel:"follow" }] } })?.entityKind, "team", "direct follows override the global Australia switch");
assert.equal(followFirst.stageLabel({ stage:"Wildcard Final" }), "Wildcard");
assert.equal(followFirst.stageLabel({ stage:"Preliminary Final" }), "Prelim");
assert.equal(followFirst.stageLabel({ roundLabel:"Quarter-finals" }), "QF");
assert.equal(followFirst.stageLabel({ stage:"Semi Final" }), "Semis");
assert.equal(followFirst.stageLabel({ stage:"Grand Final" }), "Finals");
assert.deepEqual(["Round 27", "Wildcard Final", "Qualifying Final", "Elimination Final", "Semi Final", "Preliminary Final", "Grand Final"].sort(followFirst.compareFixtureGroupLabels), ["Round 27", "Wildcard Final", "Elimination Final", "Qualifying Final", "Semi Final", "Preliminary Final", "Grand Final"]);
assert.equal(followFirst.normalizedFixtureGroupLabel("Australia v New Zealand"), "Other fixtures");

const paidViewing = followFirst.viewingLink({ broadcaster:"Nine / Kayo Sports" }, ["nine"]);
assert.equal(paidViewing.providerId, "kayo", "an actual paid stream must be preferred over a free-to-air simulcast");
assert.equal(paidViewing.actionLabel, "Kayo");
assert.equal(followFirst.viewingLink({ broadcaster:"Stan Sport / 9Now" }, ["nine"]).providerId, "stan", "Stan Sport must win over a free-to-air option");
assert.equal(followFirst.viewingLink({ broadcaster:"Provider TBC" }), null, "a viewing action must not invent an unrelated provider");

const feedDocument = JSON.parse(fs.readFileSync("data/events.json", "utf8"));
const explicitAustralianEvents = (feedDocument.events || []).filter(event => representativeEvents.metadataForEventId(event.eventId || event.id));
assert.equal(explicitAustralianEvents.length, 39, "all known title-only Australian representative fixtures require explicit registry metadata");
explicitAustralianEvents.forEach(event => {
  assert.equal(event.competitionScope, "international");
  assert.equal(event.isInternational, true);
  assert(event.representativeCountryCodes.includes("AUS"));
  assert(event.representativeSportKey);
});
const allSportsPreferences = followFirst.migratePreferences({
  followedSports:Array.from(new Set(selectorTaxonomy.exposedSportNodes.filter(node => Number(node.level) === 2).flatMap(node => node.canonicalSportKeys || []))),
  followFirst:{ australiaInternationalsEnabled:true },
  preferenceGraph:{ entityFollows:[] },
});
const allSportsEligible = (feedDocument.events || []).filter(event => followFirst.reasonForEvent({
  ...event,
  stakesScore:event.expected >= 10 ? 5 : event.expected >= 8 ? 4 : event.expected >= 6 ? 3 : event.expected >= 4 ? 2 : 1,
}, allSportsPreferences));
assert(allSportsEligible.some(event => Number(event.expected) >= 10), "an all-sports profile must receive concrete 5/5 sporting cards");
assert(allSportsEligible.some(event => event.representativeCountryCodes?.includes("AUS")), "an all-sports profile must receive explicit Australian internationals by default");

const finalsCard = fixtureToCard({
  id:"event:test:final", sourceId:"source:test", source:{ provider:"Official", sourceUrl:"https://example.com", checkedAt:"2026-08-24T00:00:00Z" },
  sportDomainId:"sport:nrl", competitionId:"competition:test", participantIds:["team:one", "team:two"], homeParticipantId:"team:one", awayParticipantId:"team:two",
  displayName:"One v Two", startTimeUtc:"2026-09-01T09:00:00Z", broadcasters:[], venueName:"Venue", venueCity:"Sydney", status:"scheduled", scheduleStatus:"confirmed",
  roundLabel:"Preliminary Final", stage:"Preliminary Final", competitionScope:"domestic", updatedAt:"2026-08-24T00:00:00Z",
}, new Map([["team:one", { displayName:"One" }], ["team:two", { displayName:"Two" }]]), new Map([["sport:nrl", { key:"nrl", label:"NRL" }]]));
assert.equal(finalsCard.roundLabel, "Preliminary Final");
assert.equal(finalsCard.stage, "Preliminary Final", "generated feed cards must preserve finals metadata");

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
  ["Account", "Subscriptions", "Notifications", "Set location", "Hidden events", "Feedback"],
);
assert(!settingsMenu.includes("Froth") && !settingsMenu.includes("Tune") && !settingsMenu.includes("Local venues"));
assert(!html.includes('id="calendarSyncBtn"') && !html.includes('id="calendarSyncModal"'));
assert(!fs.existsSync("api/calendar.js") && !fs.existsSync("lib/calendar-sync.js"));

assert(html.includes('className = "matchup-stage-badge"') && html.includes("FOLLOW_FIRST?.stageLabel"));
assert(html.includes('className = "follow-reason-tag"') && followFirstSource.includes("Because you follow"));
assert(html.includes("followReason?.displayTag"), "visible follow context must respect the player-only display flag");
assert(html.includes("stakesScore:Number(ev?.stakesScore || stakesScoreForEvent(ev))"), "raw feed cards must derive their 5/5 sporting stakes before follow eligibility is evaluated");
assert(html.includes("toggleAustraliaInternationals") && html.includes("australiaInternationalsEnabled"), "Follow must expose one global Australia-in-internationals switch");
assert(!html.includes("toggleAussiesOnly") && !html.includes("australiansOnlySportIds"), "per-sport Australia toggles must be retired from runtime UI");
assert(!html.includes("<span>AU interest</span>"), "Australia eligibility must stay hidden on Feed cards");
assert(
  html.includes("appendEventQuickActions")
    && html.includes("Remind me")
    && html.includes("buildViewingProviderMark")
    && html.includes('prefix.textContent = `${viewing.liveOrReplay === "replay" ? "Replay" : "Watch"} on`;')
    && html.includes("fallback.textContent = viewing.actionLabel || viewing.label;"),
  "viewing actions must read Watch on / Replay on followed by a provider logo with provider-name text fallback"
);
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
assert(html.includes("localNotificationRegistration") && html.includes("deliverBrowserReminder"));
const quickReminderSource = html.match(/async function toggleQuickReminder[\s\S]*?\n\}/)?.[0] || "";
assert(!quickReminderSource.includes("ensureWebPushReminder") && !quickReminderSource.includes("removeWebPushReminder"), "release reminders must remain local-only");
assert(html.includes("15 minutes before kickoff or race start. Local reminder—keep Nothing Sport open."));
assert(notificationApi.includes("remind_at") && notificationApi.includes("15 * 60 * 1000"));
assert(dispatchApi.includes("CRON_SECRET") && dispatchApi.includes("webpush.sendNotification"));
assert(worker.includes('addEventListener("push"') && worker.includes('addEventListener("notificationclick"'));
assert(vercel.crons.some(cron => cron.path === "/api/notification-dispatch" && cron.schedule === "0 9 * * *"), "Hobby deployment must retain one daily notification-dispatch proof run");
assert.equal(manifest.id, "/");

for (const [name, minimum] of [["nrl", 500], ["afl", 650]]){
  const directory = JSON.parse(fs.readFileSync(`data/canonical/${name}-directory.v1.json`, "utf8"));
  assert(directory.teams.length >= (name === "nrl" ? 17 : 18));
  assert(directory.players.length >= minimum, `${name.toUpperCase()} must include current full rosters`);
}

console.log("Follow-first release contract passed: metadata, navigation, cards, location, directories, reminders, and retired UI checks are valid.");
