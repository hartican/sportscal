#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const preferences = fs.readFileSync(path.join(ROOT, "config/follow-first.js"), "utf8");
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

// Cards expose only the current action or a durable receipt; aggregate/social detail stays in the drawer.
const cardSummary = section(html, "function buildNothingscoreSummary(ev)", "function openNothingscoreLeaderboard");
assert.match(cardSummary, /currentUser\?\.submissions\?\.\[snapshot\.phase\]/);
assert.match(cardSummary, /buildNothingscoreReceipt\(receipt, phaseCopy\.name\)/);
assert.match(cardSummary, /Submit \$\{phaseCopy\.name\}/);
for (const retiredCardMeta of ["Building", "aggregate", "contributor", "like", "Watching Now"]){
  assert(!cardSummary.includes(retiredCardMeta), `NSC card summary must not contain ${retiredCardMeta}`);
}
const receipt = section(html, "function buildNothingscoreReceipt(receipt, phaseName)", "function nothingscoreStatus");
assert.match(receipt, /Submitted · \$\{phaseName\} \$\{Number\(receipt\?\.rating \|\| 0\)\}\/5 · \+\$\{points\} NSC/);
assert.match(receipt, /receipt\?\.pointsAwarded/);
assert.match(receipt, /leaderboard\.textContent = "Leaderboard"/);
assert.match(receipt, /openNothingscoreLeaderboard\(\)/);

// Heat/Impact selections are local drafts. Only Submit writes; Pulse retains its immediate mutable action.
const choices = section(html, "function buildNothingscoreChoices(ev, snapshot, panel)", "function buildNothingscoreContributors");
assert.match(choices, /let draftRating = snapshot\.phase === "pulse"/);
assert.match(choices, /if \(snapshot\.phase === "pulse"\)[\s\S]*?action:"pulse"[\s\S]*?return;/);
assert.match(choices, /draftRating = value/);
assert.match(choices, /submit\.disabled = false/);
assert.equal((choices.match(/action:"submit"/g) || []).length, 1, "Heat/Impact must have one explicit submission path");
assert.doesNotMatch(choices, /action:"(?:rate|tag)"/, "draft score and tag changes must not write");
assertOrder(choices, [
  'submit.addEventListener("click"',
  'snapshot.phase === "impact" ? prepareNothingscoreAudio() : null',
  "submitNothingscoreAction({",
  'action:"submit"',
  'phase:snapshot.phase',
], "Impact submission gesture");

// Sound defaults on, prepares synchronously from the click, and never replays for an idempotent retry.
const soundPreference = section(html, "function nothingscoreSoundEnabled()", "function prepareNothingscoreAudio");
assert.match(soundPreference, /getItem\(NOTHINGSCORE_SOUND_KEY\) !== "off"/);
assert.match(soundPreference, /catch\(_error\)\{ return true; \}/);
const submitAction = section(html, "async function submitNothingscoreAction", "function buildNothingscoreChoices");
assertOrder(submitAction, [
  "await serverSyncClient.nothingscoreRequest",
  "result.phase",
  "result.replayed === false",
  "playNothingscoreImpactSound(preparedAudio)",
], "new Impact receipt and sound");
assert.match(submitAction, /submittedPhase === "impact" && result\.replayed === false/, "the server-confirmed Impact phase must drive the cue");
assert.match(submitAction, /\[submittedPhase\]:\{/, "the server-confirmed phase must own the durable receipt");
assert.equal((submitAction.match(/playNothingscoreImpactSound/g) || []).length, 1, "submission must play at most one cue");
const drawer = section(html, "function renderNothingscoreDrawer()", "async function loadNothingscoreLeaderboard");
assert.match(drawer, /Impact sound<\/strong>On by default/);
assert.match(drawer, /soundInput\.addEventListener\("change", async \(\) =>/);
assert.match(drawer, /playNothingscoreImpactSound\(prepareNothingscoreAudio\(\)\)/, "enabling sound must play a preview");
assert.match(drawer, /Tap to enable sound/);

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
const chatPushIdentitySync = section(html, "async function syncPermittedChatPushInstallation()", "function notificationEventUrl");
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

// Narrative v3 chooses the result-aware consequence only for completed, spoiler-visible cards.
const narrativeGate = section(html, "function editorialNarrativeReadyForCard(narrative)", "function editorialNarrativeHookForDisplay");
assert.match(narrativeGate, /editorial-narrative\\\.v\(\?:1\|2\|3\)/);
assert.match(narrativeGate, /generationMode !== "researched"/);
assert.match(narrativeGate, /editorial-consequence\.v1/);
const narrativeHook = section(html, "function editorialNarrativeHookForDisplay(record)", "function editorialNarrativeCopyForDisplay");
assert.match(narrativeHook, /editorialNarrativeReadyForCard\(narrative\)/);
const consequence = section(html, "function editorialConsequenceForDisplay(record)", "function appendEditorialConsequence");
assert.match(consequence, /narrative\?\.schemaVersion !== "editorial-narrative\.v3"/);
assert.match(consequence, /consequence\?\.schemaVersion !== "editorial-consequence\.v1"/);
assert.match(consequence, /completed && isSpoilerVisible\(record\)/);
assertOrder(consequence, [
  "if (completed && isSpoilerVisible(record))",
  "consequence.spoilerOnSentence",
  "return consequence.previewSentence",
], "spoiler-aware consequence selection");
assert.match(html, /buildEditorialL0Hook\(editorialNarrativeHookForDisplay\([^)]*\), editorialConsequenceForDisplay\(/, "cards must render the consequence as a dedicated second sentence");

console.log("NSC, alerts, badges and editorial consequence UI validation passed.");
