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
assert(html.includes('id="jumpTodayBtn"'), "Calendar must expose a floating Jump to Today control");
assert(html.includes('anchor.id = "calendarTodayAnchor"'), "Calendar must render a Today timeline anchor");
assert(html.includes("scheduleInitialCalendarJump()"), "Calendar must default the viewport to Today");
assert(html.includes('className = `date-group${dateStr < todayStr ? " is-past-date" : ""}`'), "past date groups must receive subdued styling");
assert(html.includes("LOCAL GAME"), "cards must support the LOCAL GAME tag");
assert(html.includes("🎟️ Tickets"), "local games must expose a Tickets link");
assert(html.includes('facts.outcome && typeof facts.outcome === "object"'), "empty outcome data must not break revealed PAST cards");
assert(html.includes('id="exportSectionChoices"'), "Never Miss export must expose section choices");
assert(html.includes('id="feedbackForm"'), "Feedback must use a structured SMS form");
assert(html.includes("Add a competition") && html.includes("Feature request"), "Feedback must expose the standard categories");
assert(html.includes("0437 041 326"), "Feedback UI must identify the configured SMS recipient");
assert(html.includes("b.textContent = \"Coming Up\""), "future cards must use the Coming Up status tag");
assert(html.includes("b.textContent = \"PAST\""), "completed cards must use the PAST status tag");
const spoilerControlSource = html.match(/function buildSpoilerOverrideControl\(ev\)\{[\s\S]*?\n\}/)?.[0] || "";
assert(spoilerControlSource, "an individual spoiler control must exist");
assert(!/getEventStatus\(ev\)\s*!==\s*["']past["']/.test(spoilerControlSource), "individual spoiler controls must not be limited to past events");

const publishedFeed = JSON.parse(fs.readFileSync("data/events.json", "utf8"));
assert(!JSON.stringify(publishedFeed).includes("Preserved from the existing Sportscal card set until a newer source supersedes it."), "published cards must not contain legacy placeholder copy");
const fifaCards = publishedFeed.events.filter(event => event.key === "fifa");
assert.equal(fifaCards.length, 20, "published feed must contain all Australia matches and every Round-of-16-onward FIFA card");
assert(!fifaCards.some(event => /if advanced/i.test(event.name)), "stale conditional FIFA placeholders must be removed");
assert.equal(fifaCards.filter(event => /australia/i.test(event.name)).length, 4, "all four Australia World Cup matches must be present");
assert.equal(fifaCards.filter(event => event.id.startsWith("fifa-r16-")).length, 8, "all eight Round of 16 matches must be present");
const semifinalOne = fifaCards.find(event => event.id === "fifa-sf-1-2026");
const semifinalTwo = fifaCards.find(event => event.id === "fifa-sf-2-2026");
assert.deepEqual(semifinalOne.matchupParticipants.map(participant => participant.name), ["France", "Spain"]);
assert.deepEqual(semifinalTwo.matchupParticipants.map(participant => participant.name), ["England", "Argentina"]);
assert.equal(semifinalOne.displayTitleCompact, "World Cup Semifinal 1", "recent semifinal default title must stay spoiler-safe");
assert.equal(semifinalTwo.displayTitleCompact, "World Cup Semifinal 2", "same-day semifinal default title must stay spoiler-safe");
assert(fifaCards.every(event => event.sourceType === "official"), "FIFA rewrites must retain official-source provenance");
assert.equal(fifaCards.find(event => event.id === "fifa-r32-australia-egypt-2026").time, "04:00", "Australia v Egypt must use FIFA's corrected Sydney time");
assert(fifaCards.filter(event => event.date < "2026-07-16").every(event => event.score && event.outcomeText && event.recapText), "verified past FIFA matches must carry score, outcome and analysis");
assert(!semifinalTwo.score, "England v Argentina must remain unscored until FIFA publishes a verified result");

const wimbledonCards = publishedFeed.events.filter(event => event.key === "wimbledon");
assert.equal(wimbledonCards.length, 32, "Wimbledon must contain the two retained R3 matches plus all 30 singles matches from R4 onward");
assert.equal(wimbledonCards.filter(event => event.id.startsWith("wimbledon-r4-")).length, 16, "all 16 fourth-round singles matches must be present");
assert.equal(wimbledonCards.filter(event => event.id.startsWith("wimbledon-qf-")).length, 8, "all eight Wimbledon quarterfinals must be present");
assert.equal(wimbledonCards.filter(event => event.id.startsWith("wimbledon-sf-")).length, 4, "all four Wimbledon semifinals must be present");
assert.equal(wimbledonCards.filter(event => event.id.startsWith("wimbledon-final-")).length, 2, "both Wimbledon singles finals must be present");
assert(wimbledonCards.every(event => event.score && event.outcomeText && event.recapText), "every restored Wimbledon match must carry score, outcome and analysis");
assert.equal(wimbledonCards.find(event => event.id === "wimbledon-final-noskova-muchova-2026").time, "01:00", "women's final must use its verified Sydney time");
assert.equal(wimbledonCards.find(event => event.id === "wimbledon-final-sinner-zverev-2026").date, "2026-07-13", "men's final must use the following Sydney calendar day");
assert(wimbledonCards.filter(event => event.timeTbc).every(event => /Order of play/.test(event.displayTimeLabel)), "non-exact Wimbledon starts must be labelled as order-of-play sessions");

const melbourneCards = publishedFeed.events.filter(event => event.id.startsWith("f1-australian-gp-2027-"));
assert.equal(melbourneCards.length, 2, "the 2027 Melbourne date and ticket alert cards must be present");
assert(melbourneCards.every(event => event.horizonException && event.ticketUrl), "Melbourne cards must be explicit horizon exceptions with official ticket actions");
assert(melbourneCards.every(event => event.ticketSaleStatus === "waitlist-open-date-not-announced"), "Melbourne cards must not invent an unconfirmed ticket-sale week");
assert.equal(melbourneCards.find(event => event.timeTbc)?.calendarExportEligible, false, "the date-TBC Melbourne card must not create a false calendar appointment");

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
  calendarTimelineEvents,
  eventDateLabel,
  eventTimeLabel,
};`;
vm.runInContext(`${appPrelude}\n${expose}`, sandbox, { filename: "index.html" });
const icsSource = scriptMatch[1].match(/function pad2\(n\)[\s\S]*?(?=\nfunction downloadICS)/);
assert(icsSource, "calendar export functions must be present");
vm.runInContext(`${icsSource[0]}\nglobalThis.__test.generateICS = generateICS;`, sandbox, { filename: "index.html" });
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
  { ...event("horizon-exception", 200, 5), horizonException: true, calendarExportEligible: false },
  event("too-far", 31, 5),
  event("below-floor", 4, 2),
];
app.setEvents(phaseOneEvents);
app.setActions({});
app.setFilter("all");

const buckets = app.neverMissBuckets();
assert.deepEqual(Array.from(buckets.topStorylines, ev => ev.id), ["top-week"]);
assert.deepEqual(Array.from(buckets.worthCheckingOut, ev => ev.id), ["worth-week"]);
assert.deepEqual(Array.from(buckets.aroundTheCorner, ev => ev.id), ["around", "horizon-exception"]);
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
assert.deepEqual(Array.from(exportedWorthAndAround, ev => ev.id), ["worth-week", "around"], "calendar export must omit a date-TBC horizon exception");
const globallyChronologicalExport = app.selectedNeverMissExportEvents(
  { topStorylines: true, worthCheckingOut: true, aroundTheCorner: false },
  {
    topStorylines: [event("late-top", 5, 5)],
    worthCheckingOut: [event("early-worth", 1, 3)],
    aroundTheCorner: [],
  }
);
assert.deepEqual(Array.from(globallyChronologicalExport, ev => ev.id), ["early-worth", "late-top"], "selected export events must be globally chronological");
const selectedIcs = app.generateICS(exportedWorthAndAround);
assert.equal((selectedIcs.match(/BEGIN:VEVENT/g) || []).length, 2, "calendar file must contain only the selected events");
assert.match(selectedIcs, /^BEGIN:VCALENDAR/);
assert.match(selectedIcs, /TZID:Australia\/Sydney/);
assert.match(selectedIcs, /END:VCALENDAR$/);
assert.match(selectedIcs, /UID:worth-week@sportscal/);
assert.match(selectedIcs, /UID:around@sportscal/);
assert.doesNotMatch(selectedIcs, /UID:horizon-exception@sportscal/);
assert.doesNotMatch(selectedIcs, /UID:top-week@sportscal/);

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
assert.deepEqual(Array.from(app.calendarTimelineEvents([nextRound, pastB, pastA]), event => event.id), ["past-a", "past-b", "next-round"], "Calendar timeline must place past events above Today and future events below it");
assert.equal(app.isSpoilerVisible(pastA), false, "PAST events must be spoiler-protected by default");
assert.equal(app.isSpoilerVisible(nextRound), false, "future events must inherit global spoiler protection");
nextRound.spoilerSafeTitle = "World Cup Semifinal";
assert.equal(app.spoilerSafeDisplayTitle(nextRound), "World Cup Semifinal", "unrevealed knockout branches must retain a useful generic title");

app.markSpoilerRevealed(pastA);
assert.equal(app.isSpoilerVisible(pastA), true, "per-event reveal must override global protection");
assert.equal(app.spoilerSafeDisplayTitle(nextRound), "Winner A vs Opponent hidden", "only a legitimately revealed knockout side may be named");
app.markSpoilerRevealed(nextRound);
assert.equal(app.isSpoilerVisible(nextRound), true, "per-event reveal must work before an event starts");
app.hideSpoilersForEvent(nextRound);
assert.equal(app.isSpoilerVisible(nextRound), false, "per-event protection must work before an event starts");

assert.equal(app.eventDateLabel({ date: "2027-03-07", displayDateLabel: "Date TBC - 2027" }), "Date TBC - 2027");
assert.equal(app.eventTimeLabel({ time: "15:00", timeTbc: true }), "Time TBC");
assert.equal(app.eventTimeLabel({ time: "20:00", displayTimeLabel: "Order of play; session from 8:00pm AEST" }), "Order of play; session from 8:00pm AEST");

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
