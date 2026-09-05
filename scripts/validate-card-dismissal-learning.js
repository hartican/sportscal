#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const eventActionIdentity = require("../config/event-action-identity");

const html = fs.readFileSync("index.html", "utf8");
const userStateSchema = JSON.parse(fs.readFileSync("schemas/user-state.schema.json", "utf8"));
const nativeEditionBeforeCorrection = {
  id: "event:fixture:123",
  eventId: "event:fixture:123",
  canonicalEventId: "event:fixture:123",
  date: "2026-08-28",
  time: "19:30",
};
const nativeEditionAfterCorrection = {
  ...nativeEditionBeforeCorrection,
  time: "20:00",
};
assert.equal(
  eventActionIdentity.stableKey(nativeEditionBeforeCorrection),
  eventActionIdentity.stableKey(nativeEditionAfterCorrection),
  "the same native card edition must stay dismissed after a schedule correction"
);

const seededEditionBeforeRefresh = {
  id: "major-event:australian-grand-prix-2027",
  eventId: "major-event:australian-grand-prix-2027",
  date: "2027-03-05",
  time: "12:30",
};
const seededEditionAfterRefresh = {
  ...seededEditionBeforeRefresh,
  date: "2027-03-06",
  time: "14:00",
};
assert.equal(
  eventActionIdentity.stableKey(seededEditionBeforeRefresh),
  eventActionIdentity.stableKey(seededEditionAfterRefresh),
  "the same seeded Events edition must stay dismissed when its next child fixture changes"
);
assert.notEqual(
  eventActionIdentity.stableKey(nativeEditionBeforeCorrection),
  eventActionIdentity.stableKey({ ...nativeEditionBeforeCorrection, canonicalEventId:"event:fixture:123:2027", eventId:"event:fixture:123:2027", id:"event:fixture:123:2027" }),
  "a genuinely different future edition must remain eligible"
);

const legacyActions = {
  "event:fixture:123:2026-08-28T19:30": {
    eventId:"event:fixture:123",
    dismissed:false,
    lastActionAt:"2026-08-28T01:00:00.000Z",
  },
  "event:fixture:123:2026-08-28T20:00": {
    eventId:"event:fixture:123",
    dismissed:true,
    dismissedAt:"2026-08-28T02:00:00.000Z",
    lastActionAt:"2026-08-28T02:00:00.000Z",
  },
};
const migratedActions = eventActionIdentity.migrateActions(legacyActions);
assert.deepEqual(Object.keys(migratedActions), ["event:fixture:123"], "legacy schedule keys must consolidate to the stable edition key");
assert.equal(eventActionIdentity.actionFor(nativeEditionAfterCorrection, migratedActions).dismissed, true, "the most recent legacy action must survive migration");
const restoredActions = eventActionIdentity.writeAction(migratedActions, nativeEditionAfterCorrection, {
  ...eventActionIdentity.actionFor(nativeEditionAfterCorrection, migratedActions),
  dismissed:false,
  dismissedAt:null,
  dismissalSource:"hidden_restore",
});
assert.equal(eventActionIdentity.actionFor(nativeEditionBeforeCorrection, restoredActions).dismissed, false, "Hidden recovery must write through the stable identity");
assert.equal(restoredActions["event:fixture:123"].actionKey, "event:fixture:123");

const actionProperties = userStateSchema.$defs.eventAction.properties;
assert(actionProperties.actionKey, "event actions must persist their stable identity key");
assert(actionProperties.canonicalEventId, "event actions must retain canonical edition aliases when available");
assert(actionProperties.dismissed, "event actions must persist exact-card dismissal state");
assert(actionProperties.isDismissed, "event actions must persist Events-only dismissal state");
assert(actionProperties.isMinimised, "event actions must persist card minimisation independently");
assert(actionProperties.dismissedAt, "event actions must persist when an exact card was dismissed");
assert(actionProperties.eventsDismissedAt, "Events dismissal ordering must not overwrite the Feed dismissal timestamp");
assert.match(html, /function dismissEventCard\(/, "Feed and Events must share one exact-card dismissal path");
require("./app-shell-test-utils").assertShellModule(html,"config/event-action-identity.js");
assert.match(html, /direction === "negative" && getEventAction\(ev\)\.dismissed/, "repeat dislikes must be idempotent");
assert.match(html, /function restoreDismissedEvent\(/, "dismissed cards must have a durable restoration path");
assert.match(html, /PREFERENCE_SYSTEM\.applyLearningSignal/, "Feed feedback must update the durable learning graph");
assert.match(html, /PREFERENCE_SYSTEM\?\.softLearningScore/, "card enrichment must consume bounded soft learning");
assert.match(html, /!getEventAction\(ev\)\.dismissed/, "main Feed filtering must remove dismissed cards");
assert.match(html, /activeMajorRecords = visible\.events\.filter\(record => !getEventAction\(majorEventActionEvent\(record\)\)\.isDismissed\)/, "Events must isolate its own dismissal marker");
assert.match(html, /buildDismissedEventStub/, "Events must render dismissed editions as restorable stubs");
assert.match(html, /eventsOnly:true/, "Events dismiss and restore controls must not write the Feed dismissal marker");
assert.match(html, /eventsDismissedAt:dismissedAt/, "Events dismissal must use its own stable timestamp");
assert.match(html, /renderHiddenEventsSettings/, "Settings must expose dismissed cards for restoration");
assert.match(html, /showToast\([^\n]+\{[^}]*actionLabel:\s*"Undo"/, "dismissal must offer immediate Undo");
assert.doesNotMatch(html, /bindHorizontalLearningSwipe\(/, "Feed and Events cards must not capture horizontal Tinder-style gestures");
const swipeHandler = html.match(/function applyCuratedEventSwipe\([\s\S]*?\n\}/)?.[0] || "";
assert.doesNotMatch(
  swipeHandler,
  /document\.querySelectorAll/,
  "dismissal must animate the exact initiating card instead of the first duplicate event card in the document"
);
assert.match(swipeHandler, /\{ card = null \}/, "the dismissal handler must receive the exact initiating card");
assert.match(html, /applyCuratedEventSwipe\(ev,"positive",\{card:button\.closest\("\.event-card"\)\}\)/, "suggestion Like must target its own card");

console.log("Card dismissal valid: exact-card persistence, bounded button learning, Undo and Hidden recovery are wired.");
