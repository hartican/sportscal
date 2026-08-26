#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("index.html", "utf8");
const userStateSchema = JSON.parse(fs.readFileSync("schemas/user-state.schema.json", "utf8"));

const actionProperties = userStateSchema.$defs.eventAction.properties;
assert(actionProperties.dismissed, "event actions must persist exact-card dismissal state");
assert(actionProperties.dismissedAt, "event actions must persist when an exact card was dismissed");
assert.match(html, /function dismissEventCard\(/, "Feed and Events must share one exact-card dismissal path");
assert.match(html, /function restoreDismissedEvent\(/, "dismissed cards must have a durable restoration path");
assert.match(html, /PREFERENCE_SYSTEM\.applyLearningSignal/, "Feed feedback must update the durable learning graph");
assert.match(html, /PREFERENCE_SYSTEM\?\.softLearningScore/, "card enrichment must consume bounded soft learning");
assert.match(html, /!getEventAction\(ev\)\.dismissed/, "main Feed filtering must remove dismissed cards");
assert.match(html, /visible\.events\.filter\(record => !getEventAction\(majorEventActionEvent\(record\)\)\.dismissed\)/, "Events must remove dismissed editions");
assert.match(html, /renderHiddenEventsSettings/, "Settings must expose dismissed cards for restoration");
assert.match(html, /showToast\([^\n]+\{[^}]*actionLabel:\s*"Undo"/, "dismissal must offer immediate Undo");
assert.match(html, /bindHorizontalLearningSwipe\(card, direction => applyCuratedEventSwipe/, "Feed and Events cards must use the same left-dismiss and right-like gesture language");

console.log("Card dismissal valid: exact-card persistence, bounded learning, Feed/Events gestures, Undo and Hidden recovery are wired.");
