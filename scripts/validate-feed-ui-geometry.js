#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const html = require("./app-shell-test-utils").readCardApplicationSource();

const framedRoles = [
  ".identity-frame",
  ".matchup-team-logo-slot",
  ".event-hero-mark",
  ".major-event-logo",
  ".major-event-marker-logo",
  ".matchup-competition-icon",
  ".event-icon",
];

framedRoles.forEach(selector => {
  assert(html.includes(selector), `${selector} must remain part of the shared identity-frame contract`);
});

assert(
  /\.identity-frame,[\s\S]{0,320}\.event-icon\{[\s\S]{0,180}overflow:\s*hidden;[\s\S]{0,120}contain:\s*paint;/.test(html),
  "every role-specific identity frame must clip overflow and contain paint"
);
assert(
  /\.identity-frame img,[\s\S]{0,340}\.event-icon img\{[\s\S]{0,180}max-width:\s*100%;[\s\S]{0,120}max-height:\s*100%;[\s\S]{0,120}object-fit:\s*contain;/.test(html),
  "identity images must be bounded and use contain sizing"
);
require('./lib/peach-renderer-controls').lazyIdentities();
require('./lib/peach-renderer-controls').identityRecovery();
assert(html.includes("function auditFeedUiGeometry"), "the app must expose deterministic live geometry checks for responsive browser QA");
assert(html.includes('type: "horizontal-overflow"') && html.includes('type: "identity-escape"') && html.includes('type: "identity-overlap"') && html.includes('type: "image-fallback-collision"'), "the live geometry audit must reject every required collision class");
assert(!/\.event-card,\s*\n\.major-event-card,\s*\n\.joint-tournament-card[\s\S]{0,160}contain-intrinsic-size:\s*440px/.test(html), "variable-height feed cards must not use a shared intrinsic estimate");
assert(/\.code-inspector-fixture:not\(\.is-expanded\)\{\s*content-visibility:auto;\s*contain-intrinsic-size:auto 92px;\s*\}/.test(html), "only fixed compact Inspector rows may reserve their measured 92px geometry");
assert(/\.cards-grid\s*>\s*\.event-card\{\s*padding:14px 14px 18px;\s*\}/.test(html), "mobile Feed cards must retain 14px sides and 18px bottom whitespace");
assert(html.includes("height:auto;") && html.includes("max-height:none;") && html.includes("overflow:visible;"), "compact cards must not clip a growing final row");
assert(/\.ticket-sale-card,\.ticket-sale-card \*\{\s*min-width:0;\s*\}/.test(html) && html.includes("overflow-wrap:anywhere"), "ticket-alert detail must wrap safely on iOS");
assert(/\.code-inspector-fixture-side \.code-inspector-feed-action\{[\s\S]{0,140}flex:0 0 var\(--card-action-height\)/.test(html), "Standings fixture pin controls must not stretch to the full mobile row height");

console.log(`Feed UI geometry contract valid across ${framedRoles.length} identity roles.`);
