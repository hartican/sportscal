#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const preferences = fs.readFileSync(path.join(ROOT, "config/follow-first.js"), "utf8");
const enrichment = fs.readFileSync(path.join(ROOT, "config/enrichment-engine.js"), "utf8");
const worker = fs.readFileSync(path.join(ROOT, "service-worker.js"), "utf8");

function section(source, start, end){
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `missing section start: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `missing section end: ${end}`);
  return source.slice(startIndex, endIndex);
}

function assertOrder(source, markers, message){
  let previous = -1;
  markers.forEach(marker => {
    const found = source.indexOf(marker, previous + 1);
    assert.notEqual(found, -1, `${message}: missing ${marker}`);
    assert(found > previous, `${message}: ${marker} is out of order`);
    previous = found;
  });
}

// Standard cards submit a one-tap rating; all Events feed surfaces omit inputs.
const cardSummary=section(html,"function buildNothingscorePeerResults", "function openNothingscoreLeaderboard");
for(const marker of ["buildInlineCrowdRating", "inlineRatingRequests.has(id)", "pointsAwarded", "paint(chosen)", "Early ratings", "No ratings yet"]){assert(cardSummary.includes(marker), marker);}
for(const tip of ["Rate how you think it'll go", "Rate how it's going", "Rate how it went"]){assert(cardSummary.includes(tip),tip);}
assert(cardSummary.includes("activeTab==='events'&&!inDrawer"),'Events feed must omit ratings');
assert(cardSummary.includes("phase==='pulse'?'pulse':'submit'"),'all phases use the server-owned one-tap contract');
assert(cardSummary.includes("prefers-reduced-motion: reduce"),'points animation respects reduced motion');
assert(!cardSummary.includes('draftRating'),'one-tap ratings need no draft or separate Submit');

// Sounds, system alerts, sporting reminders and badges default on while explicit false values survive migration.
const defaults = section(preferences, "function defaultFollowFirst()", "function normalizeCollectionFollows");
for (const key of ["enabled", "sportingRemindersEnabled", "chatAlertsEnabled", "soundsEnabled", "badgesEnabled"]){
  assert.match(defaults, new RegExp(`${key}:true`), `${key} must default on`);
}
const migration = section(preferences, "function migratePreferences(input)", "function setCollectionFollow");
for (const key of ["sportingRemindersEnabled", "chatAlertsEnabled", "soundsEnabled", "badgesEnabled"]){
  assert.match(migration, new RegExp(`${key}:prior\\.notifications\\?\\.${key} !== false`), `${key} must preserve an explicit off choice`);
}
const notificationSettings = section(html, "function renderNotificationSettings(body)", "function renderSelectorOptInPrompt");
for (const control of ["chatAlertsEnabled", "sportingRemindersEnabled", "notificationSoundsEnabled", "notificationBadgesEnabled"]){
  assert.match(notificationSettings, new RegExp(`id="${control}"[\\s\\S]*?!== false \\? "checked"`));
}
assert.match(notificationSettings, /id="notificationPermissionBtn"/);
assertOrder(notificationSettings, [
  'getElementById("notificationPermissionBtn").addEventListener("click"',
  "await ensurePushInstallation()",
], "notification permission user gesture");
assert.equal((html.match(/Notification\.requestPermission\(\)/g) || []).length, 1, "browser permission must have one controlled request path");
assert.match(notificationSettings, /blocked[\s\S]+browser or device Settings/i);
assert.match(notificationSettings, /iPhone or iPad[\s\S]+Home Screen[\s\S]+reopen a guest room link/i);
const chatAlertPrompt = section(html, "function buildChatAlertPrompt()", "function chatMessageById");
assert.match(chatAlertPrompt, /Enable system alerts/);
assertOrder(chatAlertPrompt, [
  'enable.addEventListener("click"',
  "prepareChatAudio()",
  "ensurePushInstallation({ requestPermission:true })",
], "chat alert permission and audio user gesture");
assert.match(html, /function openFixtureChats\(event\)\{\s+prepareChatAudio\(\)/, "fixture-room entry must resume audio from its opening gesture");
const chatPushIdentitySync = section(html, "async function syncPermittedChatPushInstallation()", "async function notificationDiagnosticsCommand");
assert.match(chatPushIdentitySync, /Notification\.permission !== "granted"/);
assert.match(chatPushIdentitySync, /notifications\.enabled === false \|\| notifications\.chatAlertsEnabled === false/, "identity activation must preserve an explicit system/chat-alert opt-out");
assert.match(chatPushIdentitySync, /ensurePushInstallation\(\{ requestPermission:false \}\)/, "an already-permitted chat identity must re-register without prompting");
assert.doesNotMatch(chatPushIdentitySync, /PUSH_INSTALLATION_STORAGE_KEY|readStorage/, "identity rebinding must also recreate missing local installation credentials");
const pushInstallation = section(html, "async function ensurePushInstallation", "async function disablePushInstallation");
assertOrder(pushInstallation, [
  "registration.pushManager.getSubscription()",
  "!storedCredentials",
  "subscription.unsubscribe()",
  "subscription = null",
  "registration.pushManager.subscribe",
], "missing installation credentials must replace the orphaned browser subscription without another permission prompt");
const chatSessionSync = section(html, "function syncChatSessionState(previousOwnerId, nextOwnerId)", "function syncNothingscoreSessionState");
assert.match(chatSessionSync, /syncPermittedChatPushInstallation\(\)/, "account and restored guest identity activation must rebind push");
const badge = section(html, "function updateUnreadAppBadge(unread)", "function chatConnection");
assert.match(badge, /badgesEnabled !== false/);
assert.match(badge, /navigator\.setAppBadge\?\.\(Number\(unread\)\)/);
assert.match(badge, /navigator\.clearAppBadge\?\.\(\)/);
assert.match(worker, /payload\.kind === "chat"[\s\S]+setAppBadge/);

// Narrative compatibility is independent from the optional v3 consequence.
const narrativeGate = section(html, "function editorialNarrativeReadyForCard(narrative)", "function editorialNarrativeHookForDisplay");
assert.match(narrativeGate, /ENRICHMENT_ENGINE\?\.editorialNarrativeReadyForCard/, "the shell must use the shared narrative compatibility predicate");
assert.match(enrichment, /function editorialNarrativeReadyForCard\(narrative\)[\s\S]*editorial-narrative\\\.v\(\?:1\|2\|3\)/);
assert.match(enrichment, /generationMode !== "researched"[\s\S]*factIds[\s\S]*sourceIds/, "researched editorial must require source provenance rather than a consequence backfill");
const narrativeHook = section(html, "function editorialNarrativeHookForDisplay(record)", "function isValidatedEditorialCopy");
assert.match(narrativeHook, /editorialNarrativeReadyForCard\(narrative\)/);
const consequence = section(html, "function editorialConsequenceForDisplay(record)", "function buildEventTimingStateChip");
assert.match(consequence, /ENRICHMENT_ENGINE\?\.editorialConsequenceReadyForCard/, "only the optional consequence must use the stricter consequence predicate");
assert.match(consequence, /completed && isSpoilerVisible\(record\)/);
assertOrder(consequence, [
  "if (completed && isSpoilerVisible(record))",
  "consequence.spoilerOnSentence",
  "return consequence.previewSentence",
], "spoiler-aware consequence selection");
assert.match(html, /buildEditorialL0Hook\(editorialNarrativeHookForDisplay\([^)]*\), editorialConsequenceForDisplay\(/, "cards must render the consequence as a dedicated second sentence");

console.log("NSC, alerts, badges and editorial consequence UI validation passed.");
