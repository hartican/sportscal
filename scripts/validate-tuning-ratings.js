#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const fineTuning = require("../config/fine-tuning.js");
const preferenceSystem = require("../config/preference-system.js");
const ratingSystem = require("../config/rating-system.js");
const canonicalTaxonomy = require("../config/canonical-sports-taxonomy.js");
require("../config/selector-taxonomy.js");
const selectorTaxonomy = globalThis.NOTHINGSPORTS_SELECTOR_TAXONOMY;

const canonicalFiles = [
  "data/canonical/afl-nrl-2026.json",
  "data/canonical/f1-context-2026.json",
  "data/canonical/tennis-context-2026.json",
  "data/canonical/cycling-context-2026.json",
  "data/canonical/nba-context-2026.json",
  "data/canonical/cwg-context-2026.json",
];
const canonical = canonicalFiles.map(file => JSON.parse(fs.readFileSync(file, "utf8")));
const sportIds = new Set(canonicalTaxonomy.sportDomains.map(item => item.id));
const selectorIds = new Set([
  ...(selectorTaxonomy.specialEvents || []),
  ...(selectorTaxonomy.commonwealthDisciplines || []),
].map(item => item.id));
const competitionIds = new Set(canonical.flatMap(bundle => bundle.competitions || []).map(item => item.id));
const participantIds = new Set(canonical.flatMap(bundle => bundle.participants || []).map(item => item.id));

assert.equal(fineTuning.SCHEMA_VERSION, "fine-tuning.v1");
assert.deepEqual(
  fineTuning.sections.map(section => section.id),
  ["broad", "teams", "people"],
  "Tune must progress from broad choices through competitions and teams to players and event families"
);
assert(fineTuning.sections.every(section => section.targets.length >= 8), "each Tune array must offer enough recognisable choices");
assert(fineTuning.sections[0].targets.some(target => target.targetType === "sport"));
assert(fineTuning.sections[0].targets.some(target => target.targetType === "event_family"));
assert(fineTuning.sections[1].targets.some(target => target.targetType === "competition"));
assert(fineTuning.sections[1].targets.some(target => target.targetType === "team"));
assert(fineTuning.sections[2].targets.some(target => target.targetType === "player"));
assert(fineTuning.sections[2].targets.some(target => target.targetType === "event_family"));

fineTuning.targets.forEach(target => {
  assert(sportIds.has(target.domainId), `Tune domain must be canonical: ${target.domainId}`);
  if (target.targetType === "sport") assert(sportIds.has(target.targetId), `Tune sport must be canonical: ${target.targetId}`);
  if (target.targetType === "competition") assert(competitionIds.has(target.targetId), `Tune competition must be canonical: ${target.targetId}`);
  if (["team", "player"].includes(target.targetType)) assert(participantIds.has(target.targetId), `Tune participant must be canonical: ${target.targetId}`);
  if (target.targetType === "event_family") assert(selectorIds.has(target.targetId), `Tune event family must use the canonical selector: ${target.targetId}`);
});

let graph = preferenceSystem.createPreferenceGraph({ profileId: "profile:tune-test" });
fineTuning.targets.slice(0, 8).forEach((target, index) => {
  graph = preferenceSystem.applyTuningSignal(graph, {
    targetType: target.targetType,
    targetId: target.targetId,
    value: index % 2 ? -1 : 1,
  }, {
    domainId: index < 4 ? "sport:nrl" : "sport:afl",
    recordedAt: new Date(Date.UTC(2026, 7, 11, 1, index)).toISOString(),
  });
});
assert.equal(graph.learning.tuningInteractionCount, 8);
assert.equal(graph.learning.tuningDomainIds.length, 2);
assert.equal(preferenceSystem.isMeaningfullyTuned(graph), true);
assert(graph.learning.signals.every(signal => signal.source === "tune"), "fine-tuning signals must remain distinguishable from swipes and calibration");

assert.deepEqual([1, 2, 3, 4, 5].map(ratingSystem.starToStoredScore), [2, 4, 6, 8, 10]);
assert.equal(ratingSystem.storedScoreToStars(null), null, "an unrated event must not be announced as a half-star rating");
assert.deepEqual([1, 3, 5, 7, 9].map(ratingSystem.storedScoreToStars), [0.5, 1.5, 2.5, 3.5, 4.5], "odd legacy scores must remain readable as half stars");

let promptState = ratingSystem.startSession(null, "session_rating_0001");
assert.equal(ratingSystem.canPrompt(promptState, "event:one", { sessionId: "session_rating_0001" }), true);
promptState = ratingSystem.recordPrompt(promptState, "event:one", { sessionId: "session_rating_0001" });
assert.equal(ratingSystem.canPrompt(promptState, "event:two", { sessionId: "session_rating_0001" }), false, "only one rating prompt may appear in a session");
for (let session = 2; session <= 4; session += 1){
  const sessionId = `session_rating_000${session}`;
  promptState = ratingSystem.startSession(promptState, sessionId);
  assert.equal(ratingSystem.canPrompt(promptState, "event:one", { sessionId }), true, "an unrated prompt may survive three later sessions");
  promptState = ratingSystem.recordPrompt(promptState, "event:one", { sessionId });
}
promptState = ratingSystem.startSession(promptState, "session_rating_0005");
assert.equal(ratingSystem.canPrompt(promptState, "event:one", { sessionId: "session_rating_0005" }), false, "an unrated prompt must auto-hide after three later sessions");

const html = fs.readFileSync("index.html", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
const shellVersion = html.match(/<meta name="app-shell-version" content="(\d+)">/)?.[1];
const workerVersion = worker.match(/const CACHE_NAME = "nothingsport-shell-v(\d+)"/)?.[1];
assert(html.includes('src="config/fine-tuning.js"') && html.includes('src="config/rating-system.js"'), "Tune and rating contracts must load before app state");
assert(html.includes('settingsMenuItem("tune"') && html.includes("renderFineTuningSettings"), "Tune must remain reachable from Settings");
assert(html.includes("applyTuningSignal") && html.includes("completeTuningSession"), "every Tune choice and completed session must persist through the v4 graph");
assert(html.includes('eventName: "tune_session"') && html.includes('surface: "tune"'), "Tune sessions must use the fixed pilot event contract");
assert(html.includes("for (let i=1;i<=5;i++)") && !html.includes("for (let i=1;i<=10;i++)"), "actual spectacle must use five one-tap stars");
assert(html.includes("starToStoredScore") && html.includes("half-filled"), "five-star input must retain 1-10 storage compatibility and half-star display");
assert(html.includes("ensureSessionRatingPrompt(filtered)") && html.includes("sessionRatingPromptSelectionFinalized"), "the feed must select at most one post-event rating prompt per session");
assert(html.includes("suppressSessionRatingPrompt();") && html.includes("if (showTunePrompt) suppressSessionRatingPrompt()"), "Tune and rating prompts must never stack");
assert(shellVersion, "the HTML shell version must be declared");
assert.equal(workerVersion, shellVersion, "the service-worker cache must match the HTML shell version");
assert(worker.includes('"/config/fine-tuning.js"') && worker.includes('"/config/rating-system.js"'));

console.log("Fine-tuning and ratings valid: canonical three-stage Tune, meaningful suppression, compatible five-star ratings, and bounded session prompts passed.");
