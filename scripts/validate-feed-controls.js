#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const feedControls = require("../config/feed-controls.js");
const preferences = require("../config/preference-system.js");
const { cardForFixture } = require("./refresh-premier-league-cards.js");

const schema = JSON.parse(fs.readFileSync("schemas/feed-controls.schema.json", "utf8"));
const html = fs.readFileSync("index.html", "utf8");
const serviceWorker = fs.readFileSync("service-worker.js", "utf8");

assert.equal(schema.properties.schemaVersion.const, feedControls.SCHEMA_VERSION);
assert.deepEqual(feedControls.MIX_TARGETS.balanced, { direct: 0.75, adjacent: 0.20, discovery: 0.05 });
assert.equal(feedControls.EXPERIMENT_FLAGS.balancedDiscovery, true);
assert.equal(feedControls.EXPERIMENT_FLAGS.firstImpressionDiscoveryCap, 1);
assert.deepEqual(feedControls.normalize({ froth: "invalid", scope: "invalid" }), feedControls.DEFAULT_CONTROLS);
assert.equal(feedControls.eventStart({ date: "2026-08-13", time: "19:00" }).toISOString(), "2026-08-13T09:00:00.000Z", "legacy local times must be interpreted in Australia/Sydney");
assert.equal(feedControls.eventStart({ date: "2026-08-13", timeTbc: true }), null, "time-TBC records must not receive a timing state");
assert.equal(feedControls.eventStart({ date: "2026-08-13", dateOnly: true }), null, "date-only records must not receive a timing state");

const timedEvent = { startTimeUtc:"2026-08-13T09:00:00.000Z", endTimeUtc:"2026-08-13T11:00:00.000Z", liveWindow:4 };
assert.equal(feedControls.timingState(timedEvent, new Date("2026-08-13T07:59:59.999Z")), null);
assert.equal(feedControls.timingState(timedEvent, new Date("2026-08-13T08:00:00.000Z")).key, "starts-soon", "Starts Soon begins exactly 60 minutes before start");
assert.equal(feedControls.timingState(timedEvent, new Date("2026-08-13T09:00:00.000Z")).key, "live-now", "Live Now begins at the exact start");
assert.equal(feedControls.timingState(timedEvent, new Date("2026-08-13T11:00:00.000Z")).key, "just-finished", "an explicit end immediately becomes Just Finished");
assert.equal(feedControls.timingState(timedEvent, new Date("2026-08-13T13:59:59.999Z")).key, "just-finished");
assert.equal(feedControls.timingState(timedEvent, new Date("2026-08-13T14:00:00.000Z")), null, "Just Finished expires exactly three hours after the end");
assert.equal(feedControls.timingState({ startTimeUtc:timedEvent.startTimeUtc, liveWindow:2 }, new Date("2026-08-13T11:00:00.000Z")).key, "just-finished", "liveWindow supplies the derived end");
["cancelled", "canceled", "postponed"].forEach(status => assert.equal(feedControls.timingState({ ...timedEvent, status }, new Date("2026-08-13T09:30:00.000Z")), null));

const viewingEvent = {
  date: "2026-08-13",
  time: "19:00",
  startTimeUtc: "2026-08-13T09:00:00.000Z",
  stakesScore: 4,
  broadcasts: [
    { accessType: "free" },
    { platformType: "streaming" },
    { platformType: "ppv" },
  ],
};
assert.deepEqual(feedControls.accessTypes(viewingEvent), ["free", "included", "ppv"]);
assert(feedControls.matchesAvailability(viewingEvent, "free"));
assert(feedControls.matchesAvailability(viewingEvent, "included"));
assert(feedControls.matchesAvailability(viewingEvent, "ppv"));
assert(feedControls.matchesTiming(viewingEvent, "tonight", new Date("2026-08-13T08:00:00.000Z")));
assert(feedControls.matchesTiming(viewingEvent, "this_week", new Date("2026-08-13T08:00:00.000Z")));
assert(!feedControls.matchesEvent({ ...viewingEvent, stakesScore: 2 }, { froth: "balanced" }), "Balanced must keep low-stakes noise out by default");
assert(feedControls.matchesEvent({ ...viewingEvent, stakesScore: 2 }, { froth: "balanced" }, { explicitCoverage: true }), "explicit all-fixture coverage must survive feed-density controls");
const eplFixture = { ...viewingEvent, key: "premier-league", competitionId: "competition:premier-league", name: "Arsenal v Chelsea" };
assert(!feedControls.matchesEvent({ ...eplFixture, stakesScore: 3 }, { froth: "balanced" }, { explicitCoverage: true }), "balanced EPL must ignore broad all-fixture coverage below 4/5");
assert(feedControls.matchesEvent({ ...eplFixture, stakesScore: 4 }, { froth: "balanced" }), "balanced EPL must surface 4/5 fixtures");
assert(feedControls.matchesEvent({ ...eplFixture, stakesScore: 2 }, { froth: "balanced" }, { followedParticipant: true }), "balanced EPL must surface followed teams");
assert(feedControls.matchesEvent({ ...eplFixture, stakesScore: 2 }, { froth: "balanced" }, { explicitlyAdded: true }), "balanced EPL must surface explicitly added fixtures");
const completedEpl = cardForFixture({
  id: 1,
  status: "C",
  kickoff: { millis: Date.parse("2026-08-21T19:00:00Z") },
  provisionalKickoff: { millis: Date.parse("2026-08-21T19:00:00Z") },
  gameweek: { gameweek: 1 },
  ground: { name: "Emirates Stadium" },
  teams: [
    { team: { name: "Arsenal", club: { id: 1 } }, score: 3 },
    { team: { name: "Coventry City", club: { id: 5 } }, score: 0 },
  ],
}, "2026-08-23T05:30:00Z");
assert.equal(completedEpl.score, "Arsenal 3-0 Coventry City");
assert.equal(completedEpl.outcomeText, "Arsenal defeated Coventry City 3-0.");
assert.match(completedEpl.recapText, /3-goal win/);

assert.equal(feedControls.classifyRecommendation({ directInterest: true }).classification, "direct");
assert.equal(feedControls.classifyRecommendation({ directInterest: true, explicitUnfollow: true }).classification, "suppressed", "explicit unfollows must win over direct interest");
assert.equal(feedControls.classifyRecommendation({ stakes: 5 }).classification, "discovery");
assert.equal(feedControls.classifyRecommendation({ learningScore: 10 }).classification, "adjacent");
assert.equal(feedControls.classifyRecommendation({ learningScore: 10, negativeContextCount: 2 }).classification, "suppressed", "repeated negative context must suppress rediscovery");

const items = [
  ...Array.from({ length: 20 }, (_value, index) => ({ id: `direct:${index}`, classification: "direct", score: 90 - index, startsAt: index })),
  ...Array.from({ length: 10 }, (_value, index) => ({ id: `adjacent:${index}`, classification: "adjacent", score: 70 - index, startsAt: index + 1 })),
  ...Array.from({ length: 10 }, (_value, index) => ({ id: `discovery:${index}`, classification: "discovery", score: 100 - index, startsAt: index + 1 })),
];
const balanced = feedControls.selectRecommendationMix(items, { froth: "balanced", scope: "for_you" });
assert.equal([...balanced].filter(id => id.startsWith("discovery:")).length, 1, "Balanced must retain rare discovery");
assert.equal([...balanced].filter(id => id.startsWith("adjacent:")).length, 5);
assert(items.filter(item => item.classification === "direct").every(item => balanced.has(item.id)), "discovery must never displace followed events");
const followingOnly = feedControls.selectRecommendationMix(items, { froth: "maximum", scope: "following" });
assert([...followingOnly].every(id => id.startsWith("direct:")), "Following scope must contain only direct interests");

let graph = preferences.createPreferenceGraph({ profileId: "profile:feed-control-test", domainIds: ["sport:nrl"] });
for (let index = 0; index < 2; index += 1){
  graph = preferences.applyLearningSignal(graph, {
    targetType: "event",
    targetId: "event:test",
    value: -1,
    source: "feed",
  }, {
    recordedAt: new Date(Date.UTC(2026, 7, 13, 0, index)).toISOString(),
    contextReferences: [{ targetType: "competition", targetId: "competition:test" }],
  });
}
assert.equal(preferences.negativeContextCount(graph, [{ targetType: "competition", targetId: "competition:test" }]), 2);

assert(
  !html.includes('id="tuneControlGrid"')
    && html.includes('id="tuneBrowseList"')
    && !html.includes('id="draftFeedControls"')
    && html.includes("function renderFollowView")
    && html.includes("function setCodeInspectorFixtureAdded")
    && html.includes('addedFixture:snapshot'),
  "Standings & Fixtures may pin a concrete one-off fixture while Follow remains the only automatic eligibility control"
);
assert(html.includes("function renderFeedControls()") && html.includes("function eventRecommendationProfile(ev)"));
assert(!html.includes('b.textContent = "Coming Up"') && !html.includes('b.textContent = "PAST"'), "generic Coming Up and Past badges must stay removed");
assert.match(html, /dateLine\.appendChild\(dateChip\);[\s\S]+buildEventTimingStateChip\(ev, timingState\)[\s\S]+dateLine\.appendChild\(timingChip\)/, "timing state must sit immediately beside the start-time rail, including matchup cards");
assert.match(html, /\.event-timing-state\.starts-soon[\s\S]+\.event-timing-state\.live-now[\s\S]+\.event-timing-state\.just-finished/, "all three semantic timing states need distinct visible treatments");
assert.match(html, /\.event-timing-state\.live-now::before[\s\S]+background:#ff3b4d/, "Live Now needs a restrained red dot");
assert.match(html, /@media \(prefers-reduced-motion:reduce\)[\s\S]+\.event-timing-state\.live-now\{ animation:none/, "reduced-motion users must keep the static red state without pulse animation");
assert(html.includes("FOLLOW_FIRST?.toggleFeedback") && html.includes("targetType:target.targetType"), "curated swipes must retain weighted target metadata with reversible likes");
assert(!html.includes('className = "badge discovery"') && !html.includes('className = "badge availability"'), "discovery and availability classifications must both stay behind the scenes");
assert(html.includes('sessionOpenedEventIds.add(') && !html.includes('label.className = "new-tag"'), "open signals must remain session-local without exposing a New metadata label");
assert(html.includes('rect.top <= window.innerHeight'), "the contextual jump must count Today as visible anywhere in the viewport");
assert(!/buildJointTournamentMustWatchAction|jointTournamentIsMustWatch|action\.mustWatch \? 12/.test(html), "the removed Must Watch feature must not affect tournament actions or recommendation scoring");
const shellVersion = html.match(/name="app-shell-version" content="(\d+)"/)?.[1];
assert(shellVersion && serviceWorker.includes(`const CACHE_NAME = "nothingsport-shell-v${shellVersion}"`));
assert(html.includes('button.dataset.jumpTarget = eventsTimeline ? "event-now" : "today"') && html.includes('delete button.dataset.jumpTarget;'), "the contextual jump control must use Today in Feed, card-local Now in Events, and hide when its target is visible");
assert(!html.includes('scrollActiveFeedToMustWatch'), "the removed queue must have no jump target");
assert(serviceWorker.includes('"/config/feed-controls.js"') && serviceWorker.includes('"/config/personalised-feed.js"') && serviceWorker.includes('"/schemas/feed-controls.schema.json"'));

console.log("Feed controls valid: follow-first UI, Sydney timing, availability, legacy mix compatibility, and weighted feedback metadata passed.");
