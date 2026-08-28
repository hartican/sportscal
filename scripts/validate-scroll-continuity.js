#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const assert = require("assert").strict;
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const worker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");

function sourceOf(name){
  const marker = `function ${name}(`;
  const start = html.indexOf(marker);
  assert.notEqual(start, -1, `${name} must exist`);
  const signatureEnd = html.slice(start).match(/\)\s*\{/);
  assert(signatureEnd, `Unable to find ${name} body`);
  const bodyStart = start + signatureEnd.index + signatureEnd[0].lastIndexOf("{");
  let depth = 0;
  for (let index = bodyStart; index < html.length; index += 1){
    if (html[index] === "{"){
      depth += 1;
    }else if (html[index] === "}"){
      depth -= 1;
      if (depth === 0) return html.slice(start, index + 1);
    }
  }
  throw new Error(`Unable to read ${name}`);
}

assert.match(html, /function mutateWithScrollContinuity\(/, "all expandable lists need the shared anchored-mutation transaction");
const transaction = sourceOf("mutateWithScrollContinuity");
assert.match(transaction, /requestAnimationFrame/, "the transaction must measure after one animation frame");
assert.match(transaction, /scrollBy/, "the transaction must compensate the measured anchor movement");
assert.match(transaction, /preventScroll:\s*true/, "the transaction must restore focus without scrolling");
assert.match(transaction, /maxScrollY/, "the transaction must clamp compensation at the document end");
const anchorSelection = sourceOf("scrollContinuityAnchorFor");
assert.match(anchorSelection, /targetRect\.top >= viewportTop[\s\S]*targetRect\.bottom <= viewportBottom/, "a fully visible tapped card must be the preferred anchor");
assert.match(anchorSelection, /candidate !== target[\s\S]*candidate\.getBoundingClientRect\(\)\.top >= downstreamTop/, "a covered or off-screen target must fall forward to a different stable downstream item");
assert.match(anchorSelection, /!target\?\.contains\?\.\(candidate\)/, "the fallback anchor must not select a keyed detail row nested inside the expanding target");

const mathContext = {};
vm.createContext(mathContext);
vm.runInContext(`${sourceOf("scrollOffsetToPreserveAnchor")}\n${sourceOf("scrollCorrectionForAnchor")}\nglobalThis.correct = scrollCorrectionForAnchor;`, mathContext);
assert.equal(mathContext.correct(100, 138, 250, 1000), 38, "anchor movement must translate to the same scroll correction");
assert.equal(mathContext.correct(100, 300, 950, 1000), 50, "bottom clamping must not overscroll the document");
assert.equal(mathContext.correct(200, 100, 25, 1000), -25, "top clamping must not produce a negative scroll position");

const setCardState = sourceOf("setCardState");
assert.doesNotMatch(setCardState, /cardViewStates\s*=\s*\{\s*\[eventId\]/, "opening one event card must not collapse other cards");
assert.match(setCardState, /\.\.\.cardViewStates/, "event expansion state must be keyed independently");

assert.match(html, /data-scroll-key/, "expandable items need stable scroll identities");
const reconciliation = sourceOf("reconcileKeyedScrollNodes");
assert.match(reconciliation, /patchElementInPlace\(previous, replacement\)/, "re-rendered keyed items must patch their original DOM node");
assert.match(reconciliation, /replacement\.replaceWith\(previous\)/, "the original keyed DOM node must be restored after a list rebuild");
assert.match(sourceOf("preserveStableDescendants"), /img,picture/, "identity media must stay mounted across expansion");
assert.match(html, /overflow-anchor:\s*none/, "participating list roots must opt out of native anchoring");
assert.doesNotMatch(html, /\.event-card,\s*\n\.major-event-card,\s*\n\.joint-tournament-card\s*\{\s*\n\s*content-visibility:\s*auto;\s*\n\s*contain-intrinsic-size:\s*440px;/, "variable-height cards must not share an inaccurate intrinsic height");
assert.doesNotMatch(html, /\.event-card\s*\{[^}]*transition:\s*all/s, "event cards must not transition layout properties");
assert.match(html, /\.code-inspector-fixture[^}]*content-visibility:\s*auto[^}]*contain-intrinsic-size:\s*auto 92px/s, "fixed compact Inspector rows keep a matching intrinsic size");

[
  "replaceCardPreservingViewport",
  "retainCollapsedCardSpace",
  "clearPendingCardRetractionSpace",
  "scheduleCardRetractionSpaceCleanup",
  "captureViewportRetractionAnchor",
  "collapseCardsOutsideActiveViewport",
  "collapseAllCardStates",
].forEach(name => assert.doesNotMatch(html, new RegExp(`function ${name}\\(`), `${name} legacy correction must be removed`));
assert.doesNotMatch(html, /setTimeout\([^)]*restore(?:Position|Viewport)/s, "expansion must not use timer-based viewport correction");

assert.match(html, /const codeInspectorExpandedFixtureIds\s*=\s*new Set/, "Inspector fixtures need independent session expansion state");
assert.match(html, /const expandedFollowSportIds\s*=\s*new Set/, "Follow groups need independent session expansion state");
assert.match(html, /expandedTeamIds/, "directory teams need independent session expansion state");
assert.match(html, /expandedTeamId/, "legacy single expandedTeamId state must still be normalised");
const normalizationContext = {};
vm.createContext(normalizationContext);
vm.runInContext(`${sourceOf("normalizeExpandedTeamIds")}\nglobalThis.normalize = normalizeExpandedTeamIds;`, normalizationContext);
assert.deepEqual(Array.from(normalizationContext.normalize({ expandedTeamId:"legacy-team" })), ["legacy-team"], "legacy single-team session state must migrate normally");
assert.deepEqual(Array.from(normalizationContext.normalize({ expandedTeamIds:["a", "a", "b"] })), ["a", "b"], "new session state must retain several unique expanded teams");

assert.match(html, /window\.addEventListener\("scrollend", flushScrollIdleMutation/, "native scrollend must flush queued background updates");
assert.match(sourceOf("noteScrollMomentum"), /setTimeout\(flushScrollIdleMutation, 150\)/, "browsers without scrollend need the 150ms idle fallback");

assert.match(html, /content="159"/, "the app shell version must advance to 159");
assert.match(worker, /nothingsport-shell-v159/, "the service-worker cache must advance with the app shell");

console.log("Scroll continuity validation passed.");
