#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync("index.html", "utf8");
const notificationSource = fs.readFileSync("api/notification-dispatch.js", "utf8");
const userStateSource = fs.readFileSync("api/user-state.js", "utf8");
const resetUiSource = fs.readFileSync("config/preference-reset-ui.js", "utf8");
const updateCardsSource = fs.readFileSync("scripts/update-cards.js", "utf8");
const failures = [];

function check(label, work){
  try{
    work();
  }catch(error){
    failures.push(`${label}: ${String(error.message || error).split("\n")[0]}`);
  }
}

check("chat state is normalised at every ownership boundary", () => {
  assert.match(html, /function createChatState\(/);
  assert.match(html, /function normalizeChatState\(/);
  assert.match(html, /chatState\s*=\s*createChatState\(\)/);
  const sessionSync = html.slice(html.indexOf("function syncChatSessionState"), html.indexOf("function syncNothingscoreSessionState"));
  assert.match(sessionSync, /chatState\s*=\s*createChatState\(\)/);
  assert.doesNotMatch(sessionSync, /chatState\s*=\s*\{\s*isAdmin:/);
  const factory = html.slice(html.indexOf("function createChatState"), html.indexOf("function normalizeChatState"));
  ["pendingAttachments", "messages", "rooms", "capabilities"].forEach(key => assert.match(factory, new RegExp(`${key}:`)));
});

check("card expander has fixed Read more and Show less affordances", () => {
  assert.match(html, /className\s*=\s*"card-expand-label"/);
  assert.match(html, /textContent\s*=\s*state\s*===\s*"opened"\s*\?\s*"Show less"\s*:\s*"Read more"/);
  assert.match(html, /\.card-expand-control\{[^}]*min-width:/s);
});

check("stakes flames have a contrast plate", () => {
  assert.match(html, /\.stakes-flames\{[^}]*background:\s*(?:#|var\()/s);
  assert.match(html, /\.stakes-flame\.is-empty/);
  assert.match(html, /STAKES \$\{score\}\/5/);
});

check("thumbs-down is left and thumbs-up is right", () => {
  assert.match(html, /row\.append\(negative,\s*buildStakesMeter\(ev\),\s*positive\)/);
});

check("one rollback-safe optimistic mutation helper is shared", () => {
  const optimistic = require("../config/optimistic-mutation");
  assert.equal(typeof optimistic.run, "function");
  assert.equal(typeof optimistic.isLostResponse, "function");
});

check("reminders, chat reactions, attachment Save and NSC use optimistic mutation", () => {
  const reminder = html.slice(html.indexOf("async function toggleQuickReminder"), html.indexOf("function codeIdForEvent"));
  const reaction = html.slice(html.indexOf("async function toggleChatReaction"), html.indexOf("function buildChatReactionSummary"));
  const attachment = html.slice(html.indexOf("async function saveChatAttachment"), html.indexOf("function chatMessageElement"));
  const nsc = html.slice(html.indexOf("async function submitNothingscoreAction"), html.indexOf("function buildNothingscoreChoices"));
  [reminder, reaction, attachment, nsc].forEach(source => assert.match(source, /runOptimisticMutation\(/));
});

check("notification copy puts the matchup first", () => {
  assert.match(notificationSource, /title:\s*reminder\.title/);
  assert.match(notificationSource, /Broadcast starts at \$\{startLabel\}; this match follows\. Tap to open Nothing Sport\./);
  assert.match(notificationSource, /Starts at \$\{startLabel\}\. Tap to open Nothing Sport\./);
  assert.doesNotMatch(notificationSource, /title:sessionStart\s*\?\s*`Session starts now:/);
});

check("low Heat and Impact ratings expose their agreed tags", () => {
  const nsc = require("../config/nothingscore");
  assert.equal(typeof nsc.tagsFor, "function");
  assert.deepEqual(nsc.tagsFor("heat", 2), ["Rising storyline", "Emerging talent", "Low expectations", "Bog standard", "Too one-sided", "Hard to care"]);
  assert.deepEqual(nsc.tagsFor("impact", 3), ["Boring", "Standard", "Mediocre", "Underwhelming", "One-sided", "Disappointing"]);
  assert.deepEqual(nsc.validTags("heat", 2, ["Bog standard", "Box office"]), ["Bog standard"]);
});

check("NSC submission visibly confirms, rolls back and retries", () => {
  assert.match(html, /Submitted — confirming…/);
  assert.match(html, /Retry/);
  assert.match(html, /nsc-submission-receipt/);
  assert.match(html, /replayed/);
  assert.match(html, /activeNothingscoreContributionError/);
  assert.match(html, /Your draft has not been changed\./);
});

check("Why it matters rejects boilerplate and only renders validated editorial", () => {
  const editorial = html.slice(html.indexOf("function buildEventWhyItMatters"), html.indexOf("function nothingscoreActionLabelForEvent"));
  assert.doesNotMatch(editorial, /selectedSentenceForDisplay/);
  assert.doesNotMatch(editorial, /eventSpielForDisplay/);
  assert.match(html, /function isValidatedEditorialCopy\(/);
  assert.match(html, /Pinned from|Official (?:AFL )?schedule/);
});

check("preference reset is protected and recoverable", () => {
  assert.doesNotMatch(html, /id="resetPreferencesBtn"/);
  assert.match(html, /loadDeferredScript\("config\/preference-reset-ui\.js\?v=213"\)/);
  assert.match(resetUiSource, /Data & recovery/);
  assert.match(resetUiSource, /Reset all preferences…/);
  assert.match(resetUiSource, /type RESET/);
  assert.match(resetUiSource, /Undo reset/);
  assert.match(userStateSource, /reset-preferences/);
  assert.match(userStateSource, /undo-preferences-reset/);
  assert.match(userStateSource, /preferenceRecovery/);
  const migrations = fs.existsSync(path.join("supabase", "migrations"))
    ? fs.readdirSync(path.join("supabase", "migrations")).filter(name => name.endsWith("_preference_reset_recovery.sql"))
    : [];
  assert.ok(migrations.length, "the preference recovery migration must exist");
  const sql = fs.readFileSync(path.join("supabase", "migrations", migrations.at(-1)), "utf8");
  assert.match(sql, /force row level security/i);
  assert.match(sql, /revoke all[^;]+authenticated/i);
  assert.match(sql, /interval '7 days'/i);
  assert.match(sql, /nothingsports_reset_preferences/i);
  assert.match(sql, /nothingsports_undo_preferences_reset/i);
});

check("the canonical card pipeline enforces this regression suite", () => {
  assert.match(updateCardsSource, /validate-interaction-card-reliability\.js/);
});

if (failures.length){
  console.error(`Interaction and card reliability failed (${failures.length}):`);
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Interaction and card reliability valid: chat state, card affordances, optimistic rollback, notification copy, NSC tags, editorial and protected reset passed.");
