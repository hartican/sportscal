# Native Chat and Frozen Feed Chrome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Chat occupy the complete visible app viewport with reliable iPhone keyboard behaviour, and keep the Feed top bar fixed, stable and continuously visible while the Feed scrolls.

**Architecture:** Add one small, testable viewport-geometry module and keep the product wiring in the existing single-page shell. Chat becomes a three-part full-screen surface—fixed header, independently scrolling messages, and an independently anchored composer—while a Visual Viewport controller resamples around WebKit's delayed keyboard updates. Feed-only fixed chrome is selected through an explicit body state and a measured spacer; the current dynamic header-compaction pass is removed so the header never retracts or changes size during use.

**Tech Stack:** Static HTML/CSS/JavaScript, Node.js `node:assert` validators, Visual Viewport API, CSS safe-area environment variables, service-worker app shell, Vercel.

## Continuation status — 7 November 2026

The later [overnight beta candidate record](../../verification/overnight-beta-20261107.md)
records integration with accepted main, shell 611, both browser engines, installed
upgrade evidence and the remaining serialized publication checks. The following
paragraphs describe the earlier continuation and its blockers at that time.

Continued in the existing repository on `overnight/nothing-sport`, preserving the five implementation commits through `cf84c2fb` and the existing card edits. Tasks 1–5 are implemented. Task 6 has the canonical native-shell validator and the atomic version **272** shell update; release remains blocked.

Continuation commits `90ab1d58` and `2c8fc633` isolate quick-refresh regression fixtures, preserve the real result-completeness gate, prevent delayed sends from reopening the keyboard, retain reader scroll-back, and restore Feed focus after removing the background's inert state. Chromium checks cover four viewport sizes and deferred success/failure responses. Existing Chat presentation checks also pass at four widths.

Final validation has three failing Node gates (`validate-server-feed`, `validate-f1-parent-feed`, `verify-nothingsport`) and a canonical refresh failure in the WRC calendar parser. Physical iPhone Safari/PWA acceptance, live GIF sending and production acceptance remain unrun. GitHub main and Vercel production have not been updated. See [the continuation verification record](../../verification/native-chat-feed-chrome-20261107.md) for exact failures, commands and evidence limits. The checkboxes below retain the original execution recipe; they do not establish release acceptance.

---

## Baseline and scope

- Implement from a fresh worktree based on current `origin/main`. The inspected production baseline is commit `21648e56f91c36a9e807bb9231d072d4b2691aca`, app-shell/service-worker version `223`.
- The supplied iPhone screenshot is the acceptance reference. It shows a blank band above an `86dvh` bottom sheet and a large composer at the end of the message scroll.
- Preserve the working direct GIPHY integration. Do not change `/api/chat`, GIPHY configuration, GIF eligibility, provider URLs, selected-GIF persistence, or Supabase.
- Full screen means the Chat dialog fills the currently visible browser/PWA viewport at every breakpoint. On large screens the message cards remain width-capped for readability, but the Chat surface itself is not a right drawer.
- “Natural keyboard” means Return inserts a newline, the explicit Send button sends, `Ctrl+Enter`/`Command+Enter` is the optional hardware-keyboard shortcut, the composer stays immediately above the software keyboard, and dismissing the keyboard does not reopen it.
- The Feed top bar is fixed only while the Feed tab is active. Other top-level sections retain their current navigation behaviour.

## File map

- Create `config/native-shell.js`: pure viewport calculations and resample timings shared by runtime code and Node validation.
- Create `scripts/validate-native-mobile-shell.js`: regression contract for full-screen Chat, keyboard behaviour, fixed Feed chrome and geometry helpers.
- Modify `index.html`: full-screen Chat structure/styles, composer placement, viewport lifecycle, keyboard semantics, Feed chrome state and stable mobile header.
- Modify `config/chat-media-ui.css`: make the already-working full-screen GIF picker consume the same visible-viewport variables; no provider or request changes.
- Modify `config/chat-media-ui.js`: bump only the stylesheet cache version.
- Modify `scripts/validate-shared-chat-ui.js`: replace the old in-flow-composer expectation with the anchored composer contract.
- Modify `scripts/validate-card-chat-viewport-release.js`: require the complete Visual Viewport event/resample contract.
- Modify `scripts/verify-nothingsport.js`: replace dynamic header-compaction assertions with fixed Feed-header assertions.
- Modify `scripts/update-cards.js`: add the new validator to the canonical chain.
- Modify `service-worker.js`: cache the new helper and atomically bump the shell.

### Task 1: Lock the new behaviour with failing tests

**Files:**
- Create: `scripts/validate-native-mobile-shell.js`
- Modify: `scripts/validate-shared-chat-ui.js`
- Modify: `scripts/validate-card-chat-viewport-release.js`
- Modify: `scripts/verify-nothingsport.js`

- [ ] **Step 1: Create the focused validator**

Create `scripts/validate-native-mobile-shell.js` with this complete test:

```js
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
```

- [ ] **Step 2: Replace the stale shared-Chat expectation**

In `scripts/validate-shared-chat-ui.js`, replace the comment and room-order assertion that require the composer inside `chatBody` with:

```js
// The message scroller and composer are siblings so the keyboard cannot scroll the composer away.
const roomRender = section(html, "function renderOpenChatRoom(", "function mergeChatMessages");
assertOrder(roomRender, [
  "body.replaceChildren()",
  "body.appendChild(renderChatMembersDisclosure(room))",
  "buildChatAlertPrompt()",
  "body.appendChild(buildChatMessageList())",
  "renderChatComposerHost(room",
], "room body and anchored composer layout");
assert.match(html, /id="chatComposerHost"/);
assert.match(html, /\.chat-room-composer\{[\s\S]*?grid-template-areas:[^;]*"tools tools"[^;]*"previews previews"[^;]*"input send"/);
assert.match(html, /\.chat-room-composer textarea\{[\s\S]*?grid-area:input/);
assert.match(html, /\.chat-room-composer \[type="submit"\]\{[\s\S]*?grid-area:send/);
```

Delete the assertions that say “retired fixed drawer composer” and require `.chat-room-composer .btn{ width:100%;`.

- [ ] **Step 3: Strengthen the viewport and header validators**

In `scripts/validate-card-chat-viewport-release.js`, replace the single `visualViewport` assertion with:

```js
assert.match(html, /visualViewport\?\.addEventListener\("resize", scheduleChatViewportSync\)/);
assert.match(html, /visualViewport\?\.addEventListener\("scroll", scheduleChatViewportSync\)/);
assert.match(html, /window\.addEventListener\("orientationchange", scheduleChatViewportSync\)/);
assert.match(html, /document\.addEventListener\("focusin", handleChatFocusIn\)/);
assert.match(html, /document\.addEventListener\("focusout", handleChatFocusOut\)/);
assert.match(html, /NATIVE_SHELL\.RESAMPLE_DELAYS_MS/);
assert.doesNotMatch(html, /body\.style\.position = "fixed"/);
```

In `scripts/verify-nothingsport.js`, replace the `scheduleFirstCardViewportFit()` and `header-compact-*` assertion with:

```js
assert.match(html, /body\[data-active-tab="feed"\] header\.top\s*\{[^}]*position:fixed/s, "Feed chrome must remain fixed to the visible top edge");
assert.match(html, /id="topBarSpacer"/, "fixed Feed chrome must retain measured space in document flow");
assert.doesNotMatch(html, /scheduleFirstCardViewportFit|header-compact-[123]/, "Feed chrome must not retract or resize itself around the first card");
```

- [ ] **Step 4: Run the focused tests and confirm the intended failure**

Run:

```bash
node scripts/validate-native-mobile-shell.js
node scripts/validate-shared-chat-ui.js
node scripts/validate-card-chat-viewport-release.js
node scripts/verify-nothingsport.js
```

Expected: the first test fails with `Cannot find module '../config/native-shell'`; the existing validators fail on the old in-flow composer and dynamic header-compaction contract.

- [ ] **Step 5: Commit the red tests**

```bash
git add scripts/validate-native-mobile-shell.js scripts/validate-shared-chat-ui.js scripts/validate-card-chat-viewport-release.js scripts/verify-nothingsport.js
git commit -m "test: define native chat and feed chrome"
```

### Task 2: Add deterministic visible-viewport geometry

**Files:**
- Create: `config/native-shell.js`
- Modify: `index.html`
- Modify: `service-worker.js`

- [ ] **Step 1: Add the pure geometry module**

Create `config/native-shell.js`:

```js
(function(root, factory){
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.NOTHINGSPORTS_NATIVE_SHELL = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  "use strict";

  const KEYBOARD_THRESHOLD_PX = 96;
  const RESAMPLE_DELAYS_MS = Object.freeze([0, 80, 240]);
  const pixel = value => Math.max(0, Math.round(Number(value) || 0));

  function deriveChatViewport({
    visualHeight,
    visualWidth,
    offsetTop = 0,
    offsetLeft = 0,
    layoutHeight,
    layoutWidth,
    baselineHeight,
  } = {}){
    const height = Math.max(1, pixel(visualHeight) || pixel(layoutHeight) || 1);
    const width = Math.max(1, pixel(visualWidth) || pixel(layoutWidth) || 1);
    const top = pixel(offsetTop);
    const left = pixel(offsetLeft);
    const baseline = Math.max(height + top, pixel(baselineHeight) || pixel(layoutHeight) || height);
    const coveredHeight = Math.max(0, baseline - top - height);
    return Object.freeze({
      height,
      width,
      offsetTop:top,
      offsetLeft:left,
      coveredHeight,
      keyboardOpen:coveredHeight >= KEYBOARD_THRESHOLD_PX,
    });
  }

  return Object.freeze({ KEYBOARD_THRESHOLD_PX, RESAMPLE_DELAYS_MS, deriveChatViewport });
});
```

- [ ] **Step 2: Load and cache the helper**

In `index.html`, add this immediately before `config/chat-contract.js`:

```html
<script src="config/native-shell.js?v=224"></script>
```

Near the other module bindings in the inline script, add:

```js
const NATIVE_SHELL = globalThis.NOTHINGSPORTS_NATIVE_SHELL;
```

In `service-worker.js`, add `"/config/native-shell.js?v=224"` to `APP_SHELL` beside the Chat configuration assets.

- [ ] **Step 3: Run the pure test**

```bash
node scripts/validate-native-mobile-shell.js
```

Expected: geometry assertions pass; the test then fails at the first missing `index.html` structural contract.

- [ ] **Step 4: Commit the helper**

```bash
git add config/native-shell.js index.html service-worker.js
git commit -m "feat: model the visible chat viewport"
```

### Task 3: Turn Chat into a true full-screen surface

**Files:**
- Modify: `index.html`
- Modify: `config/chat-media-ui.css`
- Modify: `config/chat-media-ui.js`

- [ ] **Step 1: Give the composer its own surface**

In the `#chatDrawer` markup, replace the body/new-message tail with:

```html
<div class="chat-body" id="chatBody"></div>
<button class="btn primary chat-new-messages" id="chatNewMessagesBtn" type="button">New messages</button>
<footer class="chat-composer-host" id="chatComposerHost" hidden></footer>
```

Add these helpers before `renderOpenChatRoom`:

```js
function clearChatComposerHost(){
  const host = document.getElementById("chatComposerHost");
  host.replaceChildren();
  host.hidden = true;
}

function renderChatComposerHost(room, { focus = false } = {}){
  const host = document.getElementById("chatComposerHost");
  host.replaceChildren();
  if (!room?.viewer?.canPost){
    host.hidden = true;
    return;
  }
  const reply = buildChatReplyPreview();
  if (reply) host.appendChild(reply);
  host.appendChild(buildChatComposer({ focus }));
  host.hidden = false;
}
```

Call `clearChatComposerHost()` at the start of `renderActiveChats`, `openFixtureChats`, `openChatSetup`, and `renderGuestChatPreview`. In `renderOpenChatRoom`, remove the block that appends the reply and composer to `chatBody`, then call this after the public-profile branch:

```js
renderChatComposerHost(room, { focus:focusComposer });
```

- [ ] **Step 2: Replace drawer and in-flow composer CSS**

Replace the Chat layout rules with:

```css
.chat-backdrop{
  position:fixed;
  top:var(--chat-viewport-offset-top, 0px);
  left:var(--chat-viewport-offset-left, 0px);
  width:var(--chat-viewport-width, 100vw);
  height:var(--chat-viewport-height, 100dvh);
  z-index:260;
  display:none;
  background:var(--panel-bg);
}
.chat-backdrop.show{ display:flex; }
.chat-drawer{
  position:relative;
  width:100%;
  max-width:none;
  height:100%;
  min-height:0;
  display:flex;
  flex-direction:column;
  overflow:hidden;
  border:0;
  border-radius:0;
  background:var(--panel-bg);
  box-shadow:none;
}
.chat-head{
  flex:0 0 auto;
  padding:calc(10px + env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) 10px max(14px, env(safe-area-inset-left));
}
.chat-body{
  min-height:0;
  flex:1 1 auto;
  overflow-y:auto;
  overscroll-behavior:contain;
  -webkit-overflow-scrolling:touch;
  padding:14px max(14px, env(safe-area-inset-right)) 14px max(14px, env(safe-area-inset-left));
}
.chat-body > *{
  width:min(100%, 760px);
  margin-inline:auto;
}
.chat-composer-host{
  flex:0 0 auto;
  max-height:min(46dvh, 360px);
  overflow-y:auto;
  overscroll-behavior:contain;
  padding:10px max(14px, env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left));
  border-top:1px solid var(--border);
  background:color-mix(in srgb, var(--panel-bg) 96%, transparent);
  backdrop-filter:blur(16px) saturate(130%);
}
.chat-composer-host[hidden]{ display:none; }
.chat-keyboard-open .chat-composer-host{ padding-bottom:10px; }
.chat-room-composer{
  width:min(100%, 760px);
  margin:0 auto;
  display:grid;
  grid-template-columns:minmax(0, 1fr) auto;
  grid-template-areas:"tools tools" "previews previews" "input send";
  gap:8px;
}
.chat-attachment-tools{ grid-area:tools; }
.chat-attachment-previews{ grid-area:previews; }
.chat-room-composer textarea{
  grid-area:input;
  box-sizing:border-box;
  width:100%;
  min-height:46px;
  max-height:120px;
  resize:none;
  overflow-y:auto;
  font-size:16px;
}
.chat-room-composer [type="submit"]{
  grid-area:send;
  width:auto;
  min-width:72px;
  min-height:46px;
  align-self:end;
}
body.chat-open{ overflow:hidden; }
```

Delete the mobile `86dvh` drawer override, rounded top corners, top border and bottom-sheet shadow. Keep the existing 44px close/share targets, focus trap and safe-area padding.

- [ ] **Step 3: Keep the GIF picker in the same visible viewport**

In `config/chat-media-ui.css`, replace the `.chat-gif-picker` positioning prefix with:

```css
.chat-gif-picker{position:fixed;top:var(--chat-viewport-offset-top,0px);left:var(--chat-viewport-offset-left,0px);width:var(--chat-viewport-width,100vw);height:var(--chat-viewport-height,100dvh);z-index:280;display:none;flex-direction:column;overflow:hidden;background:var(--panel-bg)}
```

In `config/chat-media-ui.js`, change only the stylesheet URL to `config/chat-media-ui.css?v=224`. Do not change any GIPHY logic.

- [ ] **Step 4: Run the Chat structure tests**

```bash
node scripts/validate-native-mobile-shell.js
node scripts/validate-shared-chat-ui.js
node scripts/validate-private-fixture-chat.js
node scripts/validate-chat-fixture-media-plan.js
```

Expected: the structure tests pass through full-screen/composer assertions; the native validator still fails on missing viewport event wiring.

- [ ] **Step 5: Commit the full-screen Chat surface**

```bash
git add index.html config/chat-media-ui.css config/chat-media-ui.js scripts/validate-shared-chat-ui.js
git commit -m "feat: make fixture chat full screen"
```

### Task 4: Make iPhone keyboard transitions behave naturally

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Replace the body-fixing viewport lock**

Replace `lockChatViewport` and `unlockChatViewport` with this lifecycle. It deliberately listens to both Visual Viewport events and re-reads after 80ms and 240ms because WebKit can publish keyboard geometry after its first event.

```js
let chatViewportFrame = null;
let chatViewportTimers = new Set();
let chatViewportBaselineHeight = 0;
let chatKeepLatestVisible = true;

function applyChatViewport(){
  if (!chatViewportLock) return;
  const viewport = window.visualViewport;
  const metrics = NATIVE_SHELL.deriveChatViewport({
    visualHeight:viewport?.height,
    visualWidth:viewport?.width,
    offsetTop:viewport?.offsetTop,
    offsetLeft:viewport?.offsetLeft,
    layoutHeight:document.documentElement.clientHeight || window.innerHeight,
    layoutWidth:document.documentElement.clientWidth || window.innerWidth,
    baselineHeight:chatViewportBaselineHeight,
  });
  if (!metrics.keyboardOpen) chatViewportBaselineHeight = Math.max(chatViewportBaselineHeight, metrics.height + metrics.offsetTop);
  const style = document.documentElement.style;
  style.setProperty("--chat-viewport-height", `${metrics.height}px`);
  style.setProperty("--chat-viewport-width", `${metrics.width}px`);
  style.setProperty("--chat-viewport-offset-top", `${metrics.offsetTop}px`);
  style.setProperty("--chat-viewport-offset-left", `${metrics.offsetLeft}px`);
  document.body.classList.toggle("chat-keyboard-open", metrics.keyboardOpen);
  if (chatKeepLatestVisible && chatState.currentRoom){
    const body = document.getElementById("chatBody");
    window.requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });
  }
}

function scheduleChatViewportSync(){
  if (!chatViewportLock) return;
  if (chatViewportFrame !== null) window.cancelAnimationFrame(chatViewportFrame);
  chatViewportFrame = window.requestAnimationFrame(() => {
    chatViewportFrame = null;
    applyChatViewport();
  });
  chatViewportTimers.forEach(timer => window.clearTimeout(timer));
  chatViewportTimers.clear();
  NATIVE_SHELL.RESAMPLE_DELAYS_MS.filter(delay => delay > 0).forEach(delay => {
    const timer = window.setTimeout(() => {
      chatViewportTimers.delete(timer);
      applyChatViewport();
    }, delay);
    chatViewportTimers.add(timer);
  });
}

function handleChatFocusIn(event){
  if (!chatViewportLock || !event.target.closest?.("#chatDrawer")) return;
  chatKeepLatestVisible = chatBodyAtBottom();
  scheduleChatViewportSync();
}

function handleChatFocusOut(){
  if (!chatViewportLock) return;
  scheduleChatViewportSync();
}

function setChatBackgroundInert(inert){
  document.querySelectorAll("header.top, #calendarControls, #mainContent, .app-footer, #jumpTodayBtn")
    .forEach(element => { element.inert = inert; });
}

function bindChatViewportEvents(){
  window.visualViewport?.addEventListener("resize", scheduleChatViewportSync);
  window.visualViewport?.addEventListener("scroll", scheduleChatViewportSync);
  window.addEventListener("resize", scheduleChatViewportSync);
  window.addEventListener("orientationchange", scheduleChatViewportSync);
  document.addEventListener("focusin", handleChatFocusIn);
  document.addEventListener("focusout", handleChatFocusOut);
}

function unbindChatViewportEvents(){
  window.visualViewport?.removeEventListener("resize", scheduleChatViewportSync);
  window.visualViewport?.removeEventListener("scroll", scheduleChatViewportSync);
  window.removeEventListener("resize", scheduleChatViewportSync);
  window.removeEventListener("orientationchange", scheduleChatViewportSync);
  document.removeEventListener("focusin", handleChatFocusIn);
  document.removeEventListener("focusout", handleChatFocusOut);
}

function lockChatViewport(){
  if (chatViewportLock) return;
  chatViewportLock = { scrollY:window.scrollY, overflow:document.body.style.overflow };
  const viewport = window.visualViewport;
  chatViewportBaselineHeight = Math.max(
    Math.round(viewport?.height || 0) + Math.round(viewport?.offsetTop || 0),
    document.documentElement.clientHeight,
    window.innerHeight
  );
  chatKeepLatestVisible = true;
  document.body.style.overflow = "hidden";
  setChatBackgroundInert(true);
  bindChatViewportEvents();
  scheduleChatViewportSync();
}

function unlockChatViewport(){
  if (!chatViewportLock) return;
  const lock = chatViewportLock;
  chatViewportLock = null;
  unbindChatViewportEvents();
  if (chatViewportFrame !== null) window.cancelAnimationFrame(chatViewportFrame);
  chatViewportFrame = null;
  chatViewportTimers.forEach(timer => window.clearTimeout(timer));
  chatViewportTimers.clear();
  for (const name of ["--chat-viewport-height", "--chat-viewport-width", "--chat-viewport-offset-top", "--chat-viewport-offset-left"]){
    document.documentElement.style.removeProperty(name);
  }
  document.body.classList.remove("chat-keyboard-open");
  document.body.style.overflow = lock.overflow;
  setChatBackgroundInert(false);
  if (Math.abs(window.scrollY - lock.scrollY) > 1) window.scrollTo({ top:lock.scrollY, left:0, behavior:"instant" });
}
```

- [ ] **Step 2: Restore native Return and focus semantics**

In `buildChatComposer`, add:

```js
input.autocapitalize = "sentences";
input.autocomplete = "off";
input.spellcheck = true;
input.enterKeyHint = "enter";
```

Replace its `keydown` handler with:

```js
input.addEventListener("keydown", event => {
  if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey) || event.isComposing) return;
  event.preventDefault();
  form.requestSubmit();
});
```

At the beginning of `sendChatMessage`, record:

```js
const retainComposerFocus = document.activeElement === input;
```

Replace both unconditional post-send `input.focus({ preventScroll:true })` calls with:

```js
if (retainComposerFocus && document.getElementById("chatBackdrop").classList.contains("show")){
  input.focus({ preventScroll:true });
}
```

This keeps the keyboard open after an intentional Send but never reopens it if the user dismissed it while the request was in flight.

- [ ] **Step 3: Run all Chat and viewport validators**

```bash
node scripts/validate-native-mobile-shell.js
node scripts/validate-card-chat-viewport-release.js
node scripts/validate-shared-chat-ui.js
node scripts/validate-private-fixture-chat.js
node scripts/validate-chat-fixture-media-plan.js
node scripts/validate-events-stakes-giphy-startup-release.js
```

Expected: all commands exit `0`; the GIPHY tests continue to pass unchanged.

- [ ] **Step 4: Commit keyboard handling**

```bash
git add index.html scripts/validate-native-mobile-shell.js scripts/validate-card-chat-viewport-release.js
git commit -m "fix: settle chat above the mobile keyboard"
```

### Task 5: Freeze the Feed top bar without changing its height while scrolling

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add explicit Feed chrome state and measured space**

Change the opening body tag and add the spacer immediately after `</header>`:

```html
<body data-active-tab="feed">
```

```html
<div class="top-bar-spacer" id="topBarSpacer" aria-hidden="true"></div>
```

At the start of `syncTopLevelNavigationState`, add:

```js
document.body.dataset.activeTab = activeTab;
```

- [ ] **Step 2: Fix Feed chrome to the viewport and retain flow**

Add beside the current header rules:

```css
.top-bar-spacer{ display:none; }
body[data-active-tab="feed"] header.top{
  position:fixed;
  inset:0 0 auto;
  width:100%;
  transform:translateZ(0);
  will-change:transform;
}
body[data-active-tab="feed"] .top-bar-spacer{
  display:block;
  height:var(--sticky-top-bar-height, 0px);
}
```

Keep `.feed-filter-dock { top:var(--sticky-top-bar-height) }` so it docks immediately below the frozen bar.

- [ ] **Step 3: Remove dynamic header retraction/compaction**

Delete `firstNormalFeedCard`, `firstCardResidualScroll`, `scheduleFirstCardViewportFit`, both calls to `scheduleFirstCardViewportFit()`, the resize-listener call, and all `body.header-compact-*` CSS.

Replace those changing states with one stable narrow-phone rule:

```css
@media (max-width:420px){
  header.top{
    padding-top:calc(9px + env(safe-area-inset-top));
    padding-bottom:7px;
  }
  .header-brand-logo{ width:70px; }
  .brand .slogan{ display:none; }
  .tabs{ margin-top:8px; }
  .tab-btn{ padding-top:7px; padding-bottom:7px; }
}
```

Do not add a scroll listener that hides, shrinks or translates the header. `ResizeObserver(syncFeedFilterDockOffset)` remains the sole source of the measured `--sticky-top-bar-height`.

- [ ] **Step 4: Run header, scroll and geometry tests**

```bash
node scripts/validate-native-mobile-shell.js
node scripts/validate-header-loader-overlay.js
node scripts/validate-feed-ui-geometry.js
node scripts/validate-scroll-continuity.js
node scripts/validate-feed-sport-reliability-pass.js
node scripts/verify-nothingsport.js
```

Expected: all commands exit `0`, with no dynamic header-compaction symbol left in `index.html`.

- [ ] **Step 5: Commit frozen Feed chrome**

```bash
git add index.html scripts/verify-nothingsport.js
git commit -m "fix: freeze the Feed top bar"
```

### Task 6: Wire the canonical gate, bump the shell and prove production

**Files:**
- Modify: `scripts/update-cards.js`
- Modify: `index.html`
- Modify: `service-worker.js`
- Modify: `config/chat-media-ui.js`

- [ ] **Step 1: Add the validator to the canonical chain**

In `scripts/update-cards.js`, add this beside the existing Chat/mobile validators:

```js
["scripts/validate-native-mobile-shell.js"],
```

- [ ] **Step 2: Atomically bump the release shell**

Set:

```html
<meta name="app-shell-version" content="224">
```

Set:

```js
const CACHE_NAME = "nothingsport-shell-v224";
```

Use `?v=224` for `config/native-shell.js`, `config/chat-media-ui.js`, its loaded CSS, and any other cache-versioned shell asset required by the existing synchronisation validator. Keep `index.html` and `service-worker.js` versions identical.

- [ ] **Step 3: Run the focused and canonical validation chains**

```bash
node scripts/validate-native-mobile-shell.js
node scripts/validate-shared-chat-ui.js
node scripts/validate-card-chat-viewport-release.js
node scripts/validate-private-fixture-chat.js
node scripts/validate-chat-fixture-media-plan.js
node scripts/validate-header-loader-overlay.js
node scripts/validate-feed-ui-geometry.js
node scripts/validate-scroll-continuity.js
node scripts/validate-mobile-reliability-pass.js
node scripts/validate-mobile-feed-events-brand-pass.js
node scripts/verify-nothingsport.js
node scripts/validate-update-cards.js
node scripts/update-cards.js --local-only
git diff --check
```

Expected: every validator exits `0`; the canonical updater reports its complete local chain; `git diff --check` prints nothing.

- [ ] **Step 4: Perform local responsive and keyboard QA**

Serve the clean worktree and verify at 390×844, 430×932, 768×1024 and desktop:

1. Open Feed, scroll at least 1,000px, and confirm `header.top.getBoundingClientRect().top === 0` before and after scrolling.
2. Confirm the Feed header height is unchanged before/after scrolling and the first card/filter dock is never obscured.
3. Open a fixture room and confirm `#chatDrawer` fills the visible viewport with no top gap or rounded sheet edge.
4. Focus the composer, type three lines using Return, and confirm nothing sends until Send is tapped.
5. Confirm `Command+Enter` or `Ctrl+Enter` sends with a hardware keyboard.
6. Open/dismiss the keyboard three times; confirm the composer remains above it, messages remain scrollable, and the app never jumps to Feed scroll position zero.
7. Send a message while the keyboard is open, dismiss the keyboard before the response returns, and confirm it stays dismissed.
8. Open GIF search, search, select and send a GIF; confirm the direct GIPHY integration is unchanged.
9. Close Chat and confirm the exact prior Feed scroll position and trigger focus are restored.

- [ ] **Step 5: Perform physical iPhone acceptance**

Test both installed standalone PWA and ordinary Safari on the same iPhone class shown in the screenshot:

- Portrait and landscape.
- Keyboard open, closed and interactively dismissed.
- Safari toolbar expanded and collapsed.
- Long message history, reply preview, attachment preview and GIF picker.
- Voice dictation and emoji keyboard.
- Large Text at 200%: header and composer controls remain operable and content is not covered.

This physical-device pass is required because current WebKit releases can delay or temporarily misreport Visual Viewport keyboard offsets; desktop emulation is not production proof.

- [ ] **Step 6: Commit and release the exact snapshot**

```bash
git add config/native-shell.js config/chat-media-ui.css config/chat-media-ui.js index.html service-worker.js scripts/validate-native-mobile-shell.js scripts/validate-shared-chat-ui.js scripts/validate-card-chat-viewport-release.js scripts/verify-nothingsport.js scripts/update-cards.js
git commit -m "feat: make mobile navigation feel native"
git push origin HEAD:main
NS_DEPLOY_REF=origin/main ./scripts/deploy-current-commit.sh
```

Accept production only when Vercel reports READY, the public alias resolves to the new deployment, `releaseGitSha` equals the pushed GitHub SHA, and a cache-busted browser reports app-shell `224`.

- [ ] **Step 7: Repeat production device checks**

On `https://nothingsport.vercel.app/?release=<exact-sha>` repeat the Feed scroll, Chat full-screen, three keyboard open/close cycles, newline, Send, GIF send and close-to-original-scroll checks. Test both an already-open PWA upgraded by the service worker and a cold start. Record any iOS version-specific geometry failure with the values of `visualViewport.height`, `visualViewport.offsetTop`, `innerHeight`, and `document.body.getBoundingClientRect().top` before altering the resample timings.

## Acceptance checklist

- Chat has no visible background, blank band, rounded top edge or 86%-height cap at any tested breakpoint.
- Chat header, message list and composer are separate flex regions; only the message list scrolls during normal conversation.
- The composer remains directly above the software keyboard and respects safe areas when the keyboard is closed.
- Return creates a newline; Send and hardware-keyboard modifier+Return send.
- Dismissing the keyboard never causes an asynchronous send response to reopen it.
- Opening and closing Chat preserves Feed scroll and focus.
- Feed top bar remains at top coordinate `0`, retains constant height and never retracts while Feed scrolls.
- Feed filter dock remains directly below the top bar and deep-link/card scroll offsets remain correct.
- GIF search, selection, attribution and sending remain unchanged and pass their existing validators.
- No server API, GIPHY provider, reminder, Feed data, Supabase schema or RLS change is included.

## Implementation references

- WebKit documents that the Visual Viewport API accounts for the onscreen keyboard and can keep overlays clear of it: https://webkit.org/blog/9674/new-webkit-features-in-safari-13/
- WebKit bug 237851 records that `visualViewport.offsetTop` can initially report `0` in installed iOS web apps and become correct after a short delay, which is why the controller takes bounded settled samples: https://bugs.webkit.org/show_bug.cgi?id=237851
- CSS fixed/sticky elements can repaint during scrolling; the fixed Feed header is isolated to the active Feed state and promoted to its own layer: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position
