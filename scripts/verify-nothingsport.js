#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("index.html", "utf8");
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
assert(scriptMatch, "index.html must contain an inline app script");
assert.doesNotThrow(() => new Function(scriptMatch[1]), "the full inline app script must parse");

const tabOrder = Array.from(html.matchAll(/class="tab-btn(?: active)?" data-tab="([^"]+)"/g), match => match[1]);
assert.deepEqual(tabOrder, ["calendar", "nevermiss", "watchlater", "archived"], "primary tabs must match the nothingSports contract");
assert(html.includes("<title>nothingSports</title>"), "the document title must use the nothingSports brand");
assert(html.includes("nothing sport of expectations."), "the requested nothingSports slogan must be present");
assert(html.includes('class="brand-colosseum"'), "the wordmark must include an outline colosseum glyph");
assert(!html.includes("Weekly Briefing"), "Weekly Briefing must not exist");
assert(!html.includes("data-tab=\"catchup\""), "Catch-up must be replaced by Watch Later");
assert(html.includes("ns_event_user_state_v1"), "versioned event user state must be persisted separately");
assert(html.includes("ns_event_spoiler_state_v1"), "spoiler state must be persisted separately from event user state");
assert(html.includes("id=\"globalSpoilerSwitch\""), "Settings must expose a global spoiler control");
assert(html.includes('id="settingsModal"'), "Settings must use a dedicated main screen");
assert(html.includes('data-settings-section="${section}"'), "Settings must expose exitable submenus from its main screen");
assert(html.includes('id="sportsChoiceGrid"'), "Settings must restore the sports selector");
assert(html.includes('if (firstRun) draftPreferences.followedSports = []'), "first-time setup must start with every sport deselected");
assert(html.includes('["day", "night", "system"]'), "Settings must support Day, Night, and System themes");
assert(!html.includes('id="suggestBtn"') && !html.includes('id="feedbackModal"'), "Feedback must live inside Settings rather than a separate header action or modal");
assert(html.includes('class="filing-cabinet-icon"') && !html.includes("🗄️"), "Archived must use a traced filing cabinet glyph rather than emoji");
assert(html.includes('selectionActionsMarkup("sports"') && html.includes('selectionActionsMarkup("providers"') && html.includes('selectionActionsMarkup("venues"'), "every setup multi-select must expose Select all and Deselect all controls");
assert(html.includes("maximum-scale=1.0, user-scalable=no"), "the app viewport must suppress pinch zoom");
assert(html.includes('document.addEventListener("gesturestart"'), "native-app gesture handling must suppress Safari pinch gestures");
assert(html.includes('id="jumpTodayBtn"'), "Calendar must expose a floating Jump to Today control");
assert(html.includes('anchor.id = "calendarTodayAnchor"'), "Calendar must render a Today timeline anchor");
assert(html.includes("scheduleInitialCalendarJump()"), "Calendar must default the viewport to Today");
assert(html.includes('anchor.id = "neverMissTodayAnchor"'), "Never Miss must render a Today timeline anchor");
assert(html.includes("scheduleInitialNeverMissJump()"), "Never Miss must default the viewport to Today");
assert(html.includes('activeTab !== "calendar" && activeTab !== "nevermiss"'), "Jump to Today must remain available on Calendar and Never Miss");
assert(html.includes('className = `date-group${dateStr < todayStr ? " is-past-date" : ""}`'), "past date groups must receive subdued styling");
assert(html.includes('window.addEventListener("scroll"'), "expanded cards must respond to viewport scrolling");
assert(html.includes('card.dataset.eventId = ev.eventId || ev.id'), "expanded cards must expose their event identity for viewport retraction");
assert(html.includes('const compactResult = buildCompactResult(ev)'), "compact cards must render revealed result summaries");
assert(html.includes('if (state !== "opened")'), "compact results must hand off to full result detail at the opened level");
assert(html.includes("LOCAL GAME"), "cards must support the LOCAL GAME tag");
assert(html.includes("🎟️ Tickets"), "local games must expose a Tickets link");
assert(html.includes('function spoilerOutcomeCopy(outcome)'), "empty or structured outcome data must not break revealed PAST cards");
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
assert(fifaCards.every(event => ["official", "reputable"].includes(event.sourceType)), "FIFA rewrites must retain explicit source provenance");
assert.equal(fifaCards.find(event => event.id === "fifa-r32-australia-egypt-2026").time, "04:00", "Australia v Egypt must use FIFA's corrected Sydney time");
assert(fifaCards.filter(event => event.date < "2026-07-16").every(event => event.score && event.outcomeText && event.recapText), "verified past FIFA matches must carry score, outcome and analysis");
assert.equal(semifinalTwo.score, "England 1-2 Argentina", "England v Argentina must carry the consensus final score");
assert.match(semifinalTwo.recapText, /Fernandez.+Martinez/i, "England v Argentina must carry a consensus synopsis");
assert.equal(semifinalTwo.sourceType, "reputable", "the consensus result must not be mislabelled as an official FIFA update");
assert.deepEqual(fifaCards.find(event => event.id === "fifa-third-place-2026").matchupParticipants.map(participant => participant.name), ["France", "England"], "the third-place card must carry the resolved contestants");
assert.deepEqual(fifaCards.find(event => event.id === "fifa-final-2026").matchupParticipants.map(participant => participant.name), ["Spain", "Argentina"], "the final card must carry the resolved contestants");

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
  mergePreferences,
  normalizeThemePreference,
  setEvents(events){ activeEvents = events; normalizeEvents(activeEvents); },
  setActions(actions){ eventActions = actions; },
  setSpoilerState(state){ eventSpoilerState = state; },
  getSpoilerStateSnapshot(){ return structuredClone(eventSpoilerState); },
  setRatings(next){ ratings = next; },
  setPreferences(next){ userPreferences = mergePreferences({ followedSports: Object.keys(SPORTS_LIBRARY), selectedBroadcasters: Object.keys(BROADCASTER_LIBRARY), ...next }); },
  setFilter(filter){ activeFilter = filter; },
  eventActionKey,
  cardStateForEvent,
  setCardState,
  collapseCardStates,
  collapseAllCardStates,
  isCardActivelyViewed,
  getFilteredEvents,
  getEventAction,
  getEventSpoilerState,
  neverMissBuckets,
  neverMissTimelineEvents,
  updateEventAction,
  isSpoilerVisible,
  clearHiddenSpoilerOverrides,
  clearShownSpoilerOverrides,
  applyGlobalSpoilerPolicy,
  hasSpoilerSensitiveContent,
  compactResultForEvent,
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
assert.equal(app.normalizeThemePreference("day"), "day", "Day must be a valid theme preference");
assert.equal(app.normalizeThemePreference("night"), "night", "Night must be a valid theme preference");
assert.equal(app.normalizeThemePreference("system"), "system", "System must be a valid theme preference");
assert.equal(app.normalizeThemePreference("sepia"), "system", "unknown themes must safely fall back to System");
assert.equal(app.mergePreferences({ theme: "day" }).theme, "day", "theme choice must survive preference merging");
assert.deepEqual(Array.from(app.mergePreferences(null).followedSports), [], "new profiles must start with every sport deselected");
app.setPreferences({});

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
  event("recent-top", -6, 5),
  event("recent-worth", -2, 3),
  event("expired-top", -8, 5),
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
const neverMissTimeline = app.neverMissTimelineEvents();
assert.deepEqual(Array.from(neverMissTimeline, ev => ev.id), ["recent-top", "recent-worth", "top-week", "worth-week"], "Never Miss must combine Top Storylines and Worth Checking Out across the seven days around Today");
assert(!neverMissTimeline.some(ev => ev.id === "expired-top"), "Never Miss must exclude events more than seven days in the past");
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
const scoredPast = { ...event("compact-result", -1, 4), score: "Home 2-1 Away", outcomeText: "Home advanced to the final." };
assert.equal(app.compactResultForEvent(scoredPast), null, "compact cards must not leak results while spoilers are protected");
app.setPreferences({ showSpoilers: true });
assert.equal(app.compactResultForEvent(scoredPast).score, "Home 2-1 Away", "compact cards must show scores when spoilers are enabled");
assert.equal(app.compactResultForEvent(scoredPast).outcome, "Home advanced to the final.", "compact cards must show a short outcome when spoilers are enabled");
app.setPreferences({ showSpoilers: false });
app.setCardState(pastA, "opened");
assert.equal(app.cardStateForEvent(pastA), "opened", "the actively viewed card must retain its expanded state");
app.setCardState(pastB, "selected");
assert.equal(app.cardStateForEvent(pastA), "compact", "opening a new card must retract the previous card");
assert.equal(app.cardStateForEvent(pastB), "selected", "the new active card must remain selected");
assert.equal(app.isCardActivelyViewed({ top: 120, bottom: 520, height: 400 }, 100, 700), true, "a meaningfully visible card must stay expanded");
assert.equal(app.isCardActivelyViewed({ top: -400, bottom: 30, height: 430 }, 100, 700), false, "a card scrolled above the active viewport must retract");
assert.equal(app.collapseCardStates([pastB.eventId]), true, "scroll retraction must clear the expanded card state");
assert.equal(app.cardStateForEvent(pastB), "compact", "a retracted card must return to compact");
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

app.setSpoilerState({
  [app.eventActionKey(pastA)]: { override: "hide" },
  [app.eventActionKey(pastB)]: { override: "hide" },
});
assert.equal(app.clearHiddenSpoilerOverrides(), 2, "turning spoilers on must clear stale per-event protections");
assert.equal(Object.keys(app.getSpoilerStateSnapshot()).length, 0, "cleared protections must not remain in saved spoiler state");
assert.equal(app.compactResultForEvent(scoredPast).score, "Home 2-1 Away", "global spoiler-on must restore compact results after clearing stale protections");
assert.equal(app.spoilerSafeDisplayTitle(nextRound), "Winner A vs Winner B", "global spoiler-on must restore next-round contestants");
assert.equal(app.hasSpoilerSensitiveContent({ ...pastA, fullSpiel: "A decisive post-event review." }), true, "post-event spiels must participate in spoiler protection and reveal logic");

app.setSpoilerState({
  [app.eventActionKey(pastA)]: { override: "show" },
  [app.eventActionKey(pastB)]: { override: "hide" },
});
assert.equal(app.applyGlobalSpoilerPolicy(false, true), 1, "changing the global setting to OFF must clear every earlier per-event reveal");
assert.equal(app.getSpoilerStateSnapshot()[app.eventActionKey(pastA)], undefined, "global OFF must return previously revealed events to inherited protection");
assert.equal(app.getSpoilerStateSnapshot()[app.eventActionKey(pastB)].override, "hide", "global OFF may retain already-protected events");
app.setPreferences({ showSpoilers: false });
assert.equal(app.isSpoilerVisible(pastA), false, "a global OFF reset must hide spoiler-bearing events immediately");
app.markSpoilerRevealed(pastA);
assert.equal(app.isSpoilerVisible(pastA), true, "an event may be deliberately revealed after the global OFF reset");
assert.equal(app.applyGlobalSpoilerPolicy(false, false), 0, "saving unrelated settings must not erase a later individual reveal");
assert.equal(app.isSpoilerVisible(pastA), true, "an individual reveal must persist until the global spoiler setting changes again");

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
assert.match(feedbackMessage, /^NOTHINGSPORTS FEEDBACK/);
assert.match(feedbackMessage, /Category: Bug report/);
assert.match(feedbackMessage, /Sent from nothingSports$/);
assert.match(app.buildFeedbackSmsUrl("Bug report", "Calendar card overlaps", new Date("2026-07-16T10:00:00Z")), /^sms:0437041326\?&body=/);

console.log("nothingSports phase rules verified");
