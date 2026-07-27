#!/usr/bin/env node

const assert = require("node:assert/strict");
const {
  buildCalendarIcs,
  calendarEventIsCurrent,
  calendarSyncQuery,
  eventProviderIds,
  filterCalendarEvents,
  inferProviderIds,
  normalizeCalendarSyncQuery,
} = require("../lib/calendar-sync");
const calendarHandler = require("../api/calendar");

const now = new Date("2026-07-27T10:00:00Z");
const events = [
  {
    id: "afl-froth",
    key: "afl",
    sport: "AFL",
    name: "Fremantle v West Coast",
    date: "2026-08-01",
    time: "19:30",
    broadcaster: "Kayo Sports / Foxtel",
    expected: 2,
    liveWindow: 3,
    venue: "Optus Stadium, Perth",
  },
  {
    id: "nrl-like",
    key: "nrl",
    sport: "NRL",
    name: "Raiders v Broncos",
    date: "2026-08-02",
    time: "18:00",
    broadcaster: "Kayo Sports",
    expected: 4,
    liveWindow: 2,
    venue: "GIO Stadium Canberra",
  },
  {
    id: "nrl-low",
    key: "nrl",
    sport: "NRL",
    name: "Routine fixture",
    date: "2026-08-03",
    time: "18:00",
    broadcaster: "Kayo Sports",
    expected: 2,
  },
  {
    id: "wrong-provider",
    key: "afl",
    sport: "AFL",
    name: "Broadcast elsewhere",
    date: "2026-08-04",
    time: "18:00",
    broadcaster: "Stan Sport",
    expected: 5,
  },
  {
    id: "expired",
    key: "afl",
    sport: "AFL",
    name: "Expired fixture",
    date: "2026-07-01",
    time: "18:00",
    broadcaster: "Kayo Sports",
    expected: 5,
  },
];

const config = normalizeCalendarSyncQuery({
  sports: "afl,nrl",
  providers: "kayo,foxtel",
  all: "afl",
  min: "3",
  reminder: "30",
});
assert.deepEqual(config, {
  sports: ["afl", "nrl"],
  providers: ["kayo", "foxtel"],
  allFixtures: ["afl"],
  minStakes: 3,
  reminderMinutes: 30,
});
assert.deepEqual(inferProviderIds("Kayo Sports / ESPN"), ["kayo"]);
assert.deepEqual(eventProviderIds({
  broadcaster: "Fox Footy / Kayo Sports",
  broadcasterIds: ["kayo", "foxtel"],
}), ["kayo", "foxtel"], "explicit provider ids and broadcaster labels must combine without duplicates");
assert.equal(calendarEventIsCurrent(events.at(-1), now), false, "the calendar feed must honour the same 14-day retention boundary");

const selected = filterCalendarEvents(events, config, now);
assert.deepEqual(selected.map(event => event.id), ["afl-froth", "nrl-like"], "Calendar sync must combine followed sports, Froth depth, provider filters, stakes, and retention");

const calendar = buildCalendarIcs(selected, {
  generatedAt: now,
  reminderMinutes: config.reminderMinutes,
});
assert(calendar.startsWith("BEGIN:VCALENDAR\r\n"));
assert(calendar.endsWith("END:VCALENDAR\r\n"));
assert.equal((calendar.match(/BEGIN:VEVENT/g) || []).length, 2);
assert(calendar.includes("UID:afl-froth@nothingsports"));
assert(calendar.includes("TRIGGER:-PT30M"));
assert(calendar.includes("LOCATION:Optus Stadium\\, Perth"));
assert(!calendar.includes("wrong-provider"));
assert(calendar.split("\r\n").every(line => Buffer.byteLength(line, "utf8") <= 75), "calendar lines must respect the RFC 5545 75-octet limit");

const query = calendarSyncQuery(config);
assert.equal(query, "sports=afl%2Cnrl&providers=foxtel%2Ckayo&all=afl&min=3&reminder=30");

function responseStub(){
  return {
    statusCode: null,
    headers: {},
    body: null,
    setHeader(name, value){ this.headers[name] = value; },
    status(code){ this.statusCode = code; return this; },
    json(value){ this.body = JSON.stringify(value); return this; },
    send(value){ this.body = value; return this; },
  };
}

const missingSportsResponse = responseStub();
calendarHandler({ method: "GET", query: {} }, missingSportsResponse);
assert.equal(missingSportsResponse.statusCode, 400);

const calendarResponse = responseStub();
calendarHandler({
  method: "GET",
  query: { sports: "afl,nrl", providers: "kayo", all: "afl", min: "3", reminder: "60" },
}, calendarResponse);
assert.equal(calendarResponse.statusCode, 200);
assert.equal(calendarResponse.headers["Content-Type"], "text/calendar; charset=utf-8");
assert(calendarResponse.body.startsWith("BEGIN:VCALENDAR\r\n"));
assert(Number(calendarResponse.headers["X-nothingSports-Events"]) >= 1);

console.log(`Calendar sync valid: ${selected.length} filtered fixtures, subscription query and Vercel endpoint passed.`);
