#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const calibration = require("../config/swipe-calibration.js");
const preferences = require("../config/preference-system.js");

require("../config/selector-taxonomy.js");
const selector = globalThis.NOTHINGSPORTS_SELECTOR_TAXONOMY;
const leagueContext = JSON.parse(fs.readFileSync("data/canonical/afl-nrl-2026.json", "utf8"));
const f1Context = JSON.parse(fs.readFileSync("data/canonical/f1-context-2026.json", "utf8"));

assert.equal(calibration.SCHEMA_VERSION, "swipe-calibration.v1");
assert(calibration.anchors.length > 0 && calibration.anchors.length <= 10, "calibration must expose no more than ten recognisable anchors");
assert.equal(new Set(calibration.anchors.map(anchor => anchor.id)).size, calibration.anchors.length, "calibration anchor ids must be unique");
assert.equal(new Set(calibration.anchors.map(anchor => `${anchor.targetType}:${anchor.targetId}`)).size, calibration.anchors.length, "calibration targets must be unique");

const selectorIds = new Set([
  ...(selector.specialEvents || []).map(item => item.id),
  ...(selector.commonwealthDisciplines || []).map(item => item.id),
]);
const canonicalSportIds = new Set((leagueContext.sportDomains || []).map(item => item.id));
const canonicalParticipantIds = new Set((f1Context.participants || []).map(item => item.id));
calibration.anchors.forEach(anchor => {
  assert(preferences.LEARNING_TARGET_TYPES.includes(anchor.targetType), `${anchor.id} must use a supported preference target type`);
  assert(anchor.label && anchor.detail && anchor.glyph, `${anchor.id} must be recognisable without generic taxonomy copy`);
  if (anchor.canonicalSource.kind === "selector") assert(selectorIds.has(anchor.canonicalSource.id), `${anchor.id} must reference an existing marquee selector`);
  if (anchor.canonicalSource.kind === "canonical-sport") assert(canonicalSportIds.has(anchor.canonicalSource.id), `${anchor.id} must reference an existing canonical sport`);
  if (anchor.canonicalSource.kind === "canonical-participant") assert(canonicalParticipantIds.has(anchor.canonicalSource.id), `${anchor.id} must reference an existing canonical participant`);
});

const wimbledon = { id: "event:wimbledon-final", key: "wimbledon", name: "Wimbledon Men's Final" };
assert.deepEqual(calibration.primaryTargetForEvent(wimbledon), {
  targetType: "event_family",
  targetId: "special:wimbledon",
  label: "Wimbledon",
});
assert(calibration.targetReferencesForEvent(wimbledon).some(reference => reference.targetId === "special:wimbledon"), "Wimbledon cards must inherit the marquee calibration signal");

const piastri = { id: "event:f1-race", key: "f1", name: "British GP Race", fullSpiel: "Oscar Piastri starts from the front row." };
assert.equal(calibration.primaryTargetForEvent(piastri).targetId, "competitor:f1:oscar-piastri", "recognisable canonical players must outrank generic sport targeting");
assert.equal(calibration.primaryTargetForEvent({ id: "event:cricket", key: "cricket", name: "Test match" }).targetId, "sport:cricket", "unconfigured feed cards must still learn against a bounded sport target");

const html = fs.readFileSync("index.html", "utf8");
assert(html.includes('id="startupSportsGrid"') && html.includes('id="startupEventsGrid"'), "startup must collect lightweight follows without a swipe calibration step");
assert(html.includes('event.key === "ArrowRight"') && html.includes('event.key === "ArrowLeft"'), "curated cards must expose keyboard swipe equivalents");
const learningScoreSource = html.match(/function eventLearningScore\(ev\)\{[\s\S]*?\n\}/)?.[0] || "";
assert(!learningScoreSource.includes("feedback") && html.includes("FOLLOW_FIRST?.appendFeedback"), "MVP swipe weights must be stored as feedback without changing ranking or eligibility");
assert(html.includes("cardRetained: true") && !html.includes("sessionDismissedEventIds"), "both swipe directions must retain the visible card list");
assert(html.includes("window.setTimeout(() =>") && html.includes("}, 1400);"), "swipe feedback must remain visible for 1.4 seconds");
assert(html.includes("future feed suggestions will adapt."), "swipe feedback must explain when the learning signal takes effect");
assert(html.includes("swipeCoaching") && html.includes("dismissedAt") && html.includes("swipe-coaching"), "swipe coaching completion and hints must use the durable profile contract");
assert(html.includes("firstSwipeAt") && html.includes("shouldPromptRefinement"), "the first swipe must offer Follow refinement");
assert(html.includes('overlay.setAttribute("role", "status")') && html.includes("prefers-reduced-motion:reduce"), "swipe feedback must be announced politely and honour reduced motion");

console.log("Swipe feedback valid: weighted metadata, retained cards, first-swipe Follow refinement, keyboard access and reduced-motion handling passed.");
