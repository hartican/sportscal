#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("index.html", "utf8");
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
assert(scriptMatch, "index.html must contain an inline app script");

const tabOrder = Array.from(html.matchAll(/class="tab-btn(?: active)?" data-tab="([^"]+)"/g), match => match[1]);
assert.deepEqual(tabOrder, ["calendar", "nevermiss", "watchlater", "archived"], "primary tabs must match the NothingSport contract");
assert(!html.includes("Weekly Briefing"), "Weekly Briefing must not exist");
assert(!html.includes("data-tab=\"catchup\""), "Catch-up must be replaced by Watch Later");
assert(html.includes("ns_event_user_state_v1"), "versioned event user state must be persisted separately");
assert(html.includes("ns_event_spoiler_state_v1"), "spoiler state must be persisted separately from event user state");
assert(html.includes("id=\"globalSpoilerSwitch\""), "Settings must expose a global spoiler control");
assert(html.includes("LOCAL GAME"), "cards must support the LOCAL GAME tag");
assert(html.includes("🎟️ Tickets"), "local games must expose a Tickets link");
assert(html.includes('facts.outcome && typeof facts.outcome === "object"'), "empty outcome data must not break revealed PAST cards");
assert(html.includes('id="exportSectionChoices"'), "Never Miss export must expose section choices");
assert(html.includes('id="feedbackForm"'), "Feedback must use a structured SMS form");
assert(html.includes("Add a competition") && html.includes("Feature request"), "Feedback must expose the standard categories");
assert(html.includes("0437 041 326"), "Feedback UI must identify the configured SMS recipient");
assert(html.includes("b.textContent = \"Coming Up\""), "future cards must use the Coming Up status tag");
assert(html.includes("b.textContent = \"PAST\""), "completed cards must use the PAST status tag");

const publishedFeed = JSON.parse(fs.readFileSync("data/events.json", "utf8"));
const fifaCards = publishedFeed.events.filter(event => event.key === "fifa");
assert.equal(fifaCards.length, 9, "published feed must contain the source-backed FIFA rewrite set");
assert(!fifaCards.some(event => /if advanced/i.test(event.name)), "stale conditional FIFA placeholders must be removed");
const semifinalOne = fifaCards.find(event => event.id === "fifa-sf-1-2026");
const semifinalTwo = fifaCards.find(event => event.id === "fifa-sf-2-2026");
assert.deepEqual(semifinalOne.matchupParticipants.map(participant => participant.name), ["France", "Spain"]);
assert.deepEqual(semifinalTwo.matchupParticipants.map(participant => participant.name), ["England", "Argentina"]);
assert.equal(semifinalOne.displayTitleCompact, "World Cup Semifinal 1", "recent semifinal default title must stay spoiler-safe");
assert.equal(semifinalTwo.displayTitleCompact, "World Cup Semifinal 2", "same-day semifinal default title must stay spoiler-safe");
assert(fifaCards.every(event => event.sourceType === "official"), "FIFA rewrites must retain official-source provenance");

const appPrelude = scriptMatch[1].split("/* ============ LIVE CLOCK ============ */")[0];
const storage = new Map();
const sandbox = {
  console,
  structuredClone,
  localStorage: {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
  },
};
vm.createContext(sandbox);

const expose = `
globalThis.__test = {
  SCORE_BANDS,
  setEvents(events){ activeEvents = events; normalizeEvents(activeEvents); },
  setActions(actions){ eventActions = actions; },
  setSpoilerState(state){ eventSpoilerState = state; },
  setRatings(next){ ratings = next; },
  setPreferences(next){ userPreferences = mergePreferences(next); },
  setFilter(filter){ activeFilter = filter; },
  eventActionKey,
  getFilteredEvents,
  getEventAction,
  getEventSpoilerState,
  neverMissBuckets,
  updateEventAction,
  isSpoilerVisible,
  markSpoilerRevealed,
  hideSpoilersForEvent,
  resetSpoilerOverride,
  isLocalGame,
  matchedLocalVenue,
  preferredTicketUrlForEvent,
  setEventRating,
  getActual,
  archiveEvent,
  spoilerSafeDisplayTitle,
  retrospectiveSignificanceForEvent,
  shouldSuggestWatchLater,
  getNeverMissExportSections,
  selectedNeverMissExportEvents,
  formatFeedbackTimestamp,
  buildFeedbackMessage,
  buildFeedbackSmsUrl,
  sortUpcomingFirst,
};`;
vm.runInContext(`${appPrelude}\n${expose}`, sandbox, { filename: "index.html" });
const app = sandbox.__test;

assert.equal(app.SCORE_BANDS.minimumStakes, 3, "global feed floor must be stakes 3/5");
assert.equal(app.SCORE_BANDS.topStorylines.minStakes, 4, "Top Storylines must start at stakes 4/5");
assert.equal(app.SCORE_BANDS.worthCheckingOut.minStakes, 3, "Worth Checking Out must be stakes 3/5");

function dateAtOffset(days){
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(12, 0, 0, 0);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function event(id, days, stakes){
  return {
    id,
    eventId: id,
    sport: "F1",
    key: "f1",
    name: id,
    date: dateAtOffset(days),
    time: "12:00",
    broadcaster: "Kayo Sports",
    expected: stakes >= 4 ? 8 : stakes === 3 ? 6 : 4,
    stakesScore: stakes,
    liveWindow: 3,
  };
}

const phaseOneEvents = [
  event("top-week", 2, 4),
  event("worth-week", 3, 3),
  event("around", 10, 5),
  event("too-far", 31, 5),
  event("below-floor", 4, 2),
];
app.setEvents(phaseOneEvents);
app.setActions({});
app.setFilter("all");

const buckets = app.neverMissBuckets();
assert.deepEqual(Array.from(buckets.topStorylines, ev => ev.id), ["top-week"]);
assert.deepEqual(Array.from(buckets.worthCheckingOut, ev => ev.id), ["worth-week"]);
assert.deepEqual(Array.from(buckets.aroundTheCorner, ev => ev.id), ["around"]);
assert(!app.getFilteredEvents().some(ev => ev.id === "below-floor"), "events below stakes 3/5 must be excluded");

const exportedTopOnly = app.selectedNeverMissExportEvents({
  topStorylines: true,
  worthCheckingOut: false,
  aroundTheCorner: false,
});
assert.deepEqual(Array.from(exportedTopOnly, ev => ev.id), ["top-week"], "export must include only selected Never Miss sections");
const exportedWorthAndAround = app.selectedNeverMissExportEvents({
  topStorylines: false,
  worthCheckingOut: true,
  aroundTheCorner: true,
});
assert.deepEqual(Array.from(exportedWorthAndAround, ev => ev.id), ["worth-week", "around"], "multi-section export must preserve section order");

const archived = phaseOneEvents[0];
app.updateEventAction(archived, { archived: true });
assert(!app.getFilteredEvents().some(ev => ev.id === archived.id), "archived events must leave active feeds");
assert.equal(app.getEventAction(archived).archived, true, "archive state must persist");

const localGame = {
  ...event("local-nrl", 2, 3),
  key: "nrl",
  sport: "NRL",
  venue: "GIO Stadium Canberra",
};
app.setPreferences({ showSpoilers: false });
assert.equal(app.isLocalGame(localGame), true, "GIO Stadium must be local by default");
assert.equal(app.matchedLocalVenue(localGame).label, "GIO Stadium");
assert.equal(app.preferredTicketUrlForEvent(localGame), "https://www.nrl.com/tickets");

const manukaGame = {
  ...event("local-cricket", 3, 3),
  key: "cricket",
  sport: "Cricket",
  venue: "Corroboree Group Oval, Manuka",
};
assert.equal(app.isLocalGame(manukaGame), true, "Manuka venue aliases must match the default local venue");
assert.equal(app.preferredTicketUrlForEvent(manukaGame), "https://www.cricket.com.au/tickets");

const pastA = event("past-a", -3, 4);
const pastB = event("past-b", -2, 3);
const nextRound = {
  ...event("next-round", 5, 5),
  matchupParticipants: [
    { name: "Winner A", sourceEventId: "past-a" },
    { name: "Winner B", sourceEventId: "past-b" },
  ],
};
app.setEvents([pastA, pastB, nextRound, localGame, manukaGame]);
app.setActions({});
app.setRatings({});
app.setSpoilerState({});
app.setPreferences({ showSpoilers: false });
assert.equal(app.isSpoilerVisible(pastA), false, "PAST events must be spoiler-protected by default");
nextRound.spoilerSafeTitle = "World Cup Semifinal";
assert.equal(app.spoilerSafeDisplayTitle(nextRound), "World Cup Semifinal", "unrevealed knockout branches must retain a useful generic title");

app.markSpoilerRevealed(pastA);
assert.equal(app.isSpoilerVisible(pastA), true, "per-event reveal must override global protection");
assert.equal(app.spoilerSafeDisplayTitle(nextRound), "Winner A vs Opponent hidden", "only a legitimately revealed knockout side may be named");

app.setPreferences({ showSpoilers: true });
assert.equal(app.isSpoilerVisible(pastB), true, "global spoiler-on must reveal inherited events");
app.hideSpoilersForEvent(pastB);
assert.equal(app.isSpoilerVisible(pastB), false, "per-event hide must override global spoiler-on");
app.resetSpoilerOverride(pastB);
assert.equal(app.isSpoilerVisible(pastB), true, "reset must restore the global spoiler policy");

app.setPreferences({ showSpoilers: false });
app.setEventRating(pastB, 9);
assert.equal(app.getActual("past-b"), 9, "rating must be stored");
assert.equal(app.isSpoilerVisible(pastB), true, "rating a PAST event must reveal it");
assert.equal(app.shouldSuggestWatchLater(pastB), true, "a completed event rated above 8/10 must be suggested for Watch Later");
assert.equal(app.retrospectiveSignificanceForEvent(pastB).effectiveStakes, 4, "retrospective quality must raise derived significance without changing canonical stakes");
const chronologicalPast = app.sortUpcomingFirst([pastB, pastA]).filter(event => event.id.startsWith("past"));
assert.deepEqual(Array.from(chronologicalPast, event => event.id), ["past-a", "past-b"], "retrospective quality must not reorder past events");
app.updateEventAction(pastB, { watchLater: true });
assert.equal(app.shouldSuggestWatchLater(pastB), false, "the retrospective prompt must clear after saving to Watch Later");
app.archiveEvent(pastA);
assert.equal(app.getEventAction(pastA).archived, true, "archive action must persist");
assert.equal(app.isSpoilerVisible(pastA), true, "archiving a PAST event must reveal it");

const winterTimestamp = app.formatFeedbackTimestamp(new Date("2026-07-16T10:00:00Z"));
const summerTimestamp = app.formatFeedbackTimestamp(new Date("2026-12-16T10:00:00Z"));
assert.match(winterTimestamp, /AEST$/, "winter feedback timestamps must use AEST");
assert.match(summerTimestamp, /AEDT$/, "summer feedback timestamps must use AEDT");
const feedbackMessage = app.buildFeedbackMessage("Bug report", "Calendar card overlaps", new Date("2026-07-16T10:00:00Z"));
assert.match(feedbackMessage, /^NOTHINGSPORT FEEDBACK/);
assert.match(feedbackMessage, /Category: Bug report/);
assert.match(feedbackMessage, /Sent from NothingSport$/);
assert.match(app.buildFeedbackSmsUrl("Bug report", "Calendar card overlaps", new Date("2026-07-16T10:00:00Z")), /^sms:0437041326\?&body=/);

console.log("NothingSport phase rules verified");
