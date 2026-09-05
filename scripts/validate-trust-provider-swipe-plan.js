#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const productEvents = require("../config/product-events");
const followFirst = require("../config/follow-first");

const reference = new Date("2026-09-01T00:00:00.000Z");
const surveyId = productEvents.weeklyPulseSurveyId();
let state = productEvents.nextWeeklyPulsePromptState(null, { surveyId, dayKey:"2026-09-01" });
state = productEvents.dismissWeeklyPulsePrompt(state, { surveyId, reference });
assert.equal(state.ignoreCount, 1);
assert.equal(state.nextEligibleAt, "2026-09-02T00:00:00.000Z");
state = productEvents.dismissWeeklyPulsePrompt(state, { surveyId, reference:new Date(state.nextEligibleAt) });
assert.equal(state.nextEligibleAt, "2026-09-04T00:00:00.000Z", "second dismissal waits 48 hours");
state = productEvents.dismissWeeklyPulsePrompt(state, { surveyId, reference:new Date(state.nextEligibleAt) });
assert.equal(state.nextEligibleAt, "2026-09-08T00:00:00.000Z", "third dismissal waits 96 hours");
state = productEvents.dismissWeeklyPulsePrompt(state, { surveyId, reference:new Date(state.nextEligibleAt) });
assert.equal(state.nextEligibleAt, "2026-09-15T00:00:00.000Z", "later dismissals cap at seven days");

const stan = followFirst.viewingLink({ key:"tennis", competitionId:"competition:tennis:us-open", name:"US Open" });
assert.equal(stan.providerId, "stan");
assert.equal(stan.url, "https://www.stan.com.au/watch/sport/tennis/us-open");
assert.equal(stan.appScheme, undefined, "primary provider actions must not use an unverified custom scheme");

const html = fs.readFileSync("index.html", "utf8");
assert.match(html, /pilot:\s*\["Trust pulse"/);
assert.match(html, /settingsSection === "pilot"\) renderPilotSettings/);
assert.doesNotMatch(html, /offerProviderWebFallback/);
assert.doesNotMatch(html, /bindHorizontalLearningSwipe\(/);
assert.doesNotMatch(html, /Swipe to (?:like|dislike)/i);
assert.doesNotMatch(html, /Less of this|More of this/, "obsolete reaction controls must stay removed");
assert.doesNotMatch(html, /aria-keyshortcuts="ArrowLeft ArrowRight/);
assert.match(html, /if \(!eventIsHighStakesSuggestion\(ev\)\) return \[\]/, "only a genuine suggestion may expose Like");

console.log("Trust/provider/swipe plan valid: escalating snooze, direct survey routing, HTTPS providers and button-only feedback passed.");
