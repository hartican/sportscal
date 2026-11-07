#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const gifCss = fs.readFileSync(path.join(root, "config/chat-media-ui.css"), "utf8");
const nativeShell = require("../config/native-shell");

assert.deepEqual(nativeShell.RESAMPLE_DELAYS_MS, [0, 80, 240]);
assert.deepEqual(nativeShell.deriveChatViewport({
  visualHeight:844,
  visualWidth:390,
  offsetTop:0,
  offsetLeft:0,
  layoutHeight:844,
  layoutWidth:390,
  baselineHeight:844,
}), {
  height:844,
  width:390,
  offsetTop:0,
  offsetLeft:0,
  coveredHeight:0,
  keyboardOpen:false,
});
assert.deepEqual(nativeShell.deriveChatViewport({
  visualHeight:500,
  visualWidth:390,
  offsetTop:44,
  offsetLeft:0,
  layoutHeight:844,
  layoutWidth:390,
  baselineHeight:844,
}), {
  height:500,
  width:390,
  offsetTop:44,
  offsetLeft:0,
  coveredHeight:300,
  keyboardOpen:true,
});

assert.match(html, /<body data-active-tab="feed">/);
assert.match(html, /id="topBarSpacer"/);
assert.match(html, /id="chatComposerHost"/);
assert.match(html, /body\[data-active-tab="feed"\] header\.top\s*\{[^}]*position:fixed/s);
assert.match(html, /body\[data-active-tab="feed"\] \.top-bar-spacer\s*\{[^}]*height:var\(--sticky-top-bar-height/s);
assert.match(html, /\.chat-drawer\s*\{[^}]*width:100%[^}]*height:100%/s);
assert.match(html, /\.chat-composer-host\s*\{[^}]*flex:0 0 auto/s);
assert.match(html, /\.chat-room-composer textarea\s*\{[^}]*font-size:16px/s);
assert.match(html, /event\.key !== "Enter" \|\| !\(event\.metaKey \|\| event\.ctrlKey\)/);
assert.match(html, /visualViewport\?\.addEventListener\("resize"/);
assert.match(html, /visualViewport\?\.addEventListener\("scroll"/);
assert.match(html, /document\.addEventListener\("focusin"/);
assert.match(html, /document\.addEventListener\("focusout"/);
assert.match(html, /RESAMPLE_DELAYS_MS/);
assert.match(gifCss, /--chat-viewport-height/);
assert.doesNotMatch(html, /height:min\(86dvh, 760px\)/);
assert.doesNotMatch(html, /header-compact-[123]/);
assert.doesNotMatch(html, /scheduleFirstCardViewportFit/);

console.log("Native mobile shell valid: full-screen Chat, settled keyboard geometry and frozen Feed chrome passed.");
