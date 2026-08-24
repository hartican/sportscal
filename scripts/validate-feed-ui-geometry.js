#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

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
assert(html.includes('logo.loading = "lazy"') && html.includes('image.loading = eager ? "eager" : "lazy"'), "feed and Inspector identities must lazy-load outside their immediate view");
assert(html.includes("identity.replaceChildren(fallback)") && html.includes("logo.hidden = true") && html.includes("fallback.remove()"), "image failure and load handling must prevent a visible image/fallback collision");
assert(html.includes("function auditFeedUiGeometry"), "the app must expose deterministic live geometry checks for responsive browser QA");
assert(html.includes('type: "horizontal-overflow"') && html.includes('type: "identity-escape"') && html.includes('type: "identity-overlap"') && html.includes('type: "image-fallback-collision"'), "the live geometry audit must reject every required collision class");
assert(html.includes("content-visibility:auto") && html.includes("contain-intrinsic-size"), "fixture-heavy cards must reserve off-screen geometry");

console.log(`Feed UI geometry contract valid across ${framedRoles.length} identity roles.`);
