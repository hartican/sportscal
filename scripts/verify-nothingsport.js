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
assert(html.includes("b.textContent = \"Coming Up\""), "future cards must use the Coming Up status tag");
assert(html.includes("b.textContent = \"PAST\""), "completed cards must use the PAST status tag");

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
  setFilter(filter){ activeFilter = filter; },
  eventActionKey,
  getFilteredEvents,
  getEventAction,
  neverMissBuckets,
  updateEventAction,
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

const archived = phaseOneEvents[0];
app.updateEventAction(archived, { archived: true });
assert(!app.getFilteredEvents().some(ev => ev.id === archived.id), "archived events must leave active feeds");
assert.equal(app.getEventAction(archived).archived, true, "archive state must persist");

console.log("NothingSport phase rules verified");
