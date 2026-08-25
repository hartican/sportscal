#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("index.html", "utf8");

assert.match(
  html,
  /\.header-hydration-slot\s*\{[^}]*position:\s*relative[^}]*height:\s*44px[^}]*\}/s,
  "the top-bar hydration slot must reserve a fixed 44px overlay box",
);
assert.match(
  html,
  /#headerProgressRing\s*,\s*\.header-date-badge\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0[^}]*\}/s,
  "the progress ring and date badge must occupy the same overlay cell",
);
assert.match(
  html,
  /\.header-hydration-slot\s*>\s*\[hidden\]\s*\{\s*display:\s*none\s*!important;?\s*\}/s,
  "hidden top-bar states must be removed from layout despite component display rules",
);

console.log("Header loader overlay contract passed: date and spinner share one fixed 44px slot.");
