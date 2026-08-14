#!/usr/bin/env node

const assert = require("node:assert/strict");
const {
  buildCalendarIcs,
  calendarSportSelectionMatchesEvent,
  calendarEventIsCurrent,
  calendarSyncQuery,
  eventCommonwealthDiscipline,
  eventParticipantIds,
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
  {
    id: "f1-followed",
    key: "f1",
    sport: "Formula 1",
    name: "Routine practice session",
    date: "2026-08-05",
    time: "18:00",
    broadcaster: "Kayo Sports",
    participantIds: ["competitor:f1:test-driver"],
    expected: 2,
  },
  {
    id: "f1-unfollowed",
    key: "f1",
    sport: "Formula 1",
    name: "Routine session without a follow match",
    date: "2026-08-05",
    time: "20:00",
    broadcaster: "Kayo Sports",
    participantIds: ["competitor:f1:other-driver"],
    expected: 2,
  },
  {
    id: "muted-high-stakes",
    key: "afl",
    sport: "AFL",
    name: "Muted team final",
    date: "2026-08-06",
    time: "18:00",
    broadcaster: "Kayo Sports",
    participantIds: ["team:afl:muted"],
    expected: 5,
  },
  {
    id: "excluded-competition",
    key: "nrl",
    sport: "NRL",
    name: "Excluded competition final",
    date: "2026-08-06",
    time: "20:00",
    broadcaster: "Kayo Sports",
    competitionId: "competition:nrl:disabled",
    expected: 5,
  },
  {
    id: "cwg-swimming-followed",
    key: "cwg",
    sport: "Swimming",
    commonwealthDiscipline: "swimming",
    name: "Swimming heats",
    date: "2026-08-07",
    time: "18:00",
    broadcaster: "Kayo Sports",
    participantIds: ["competitor:cwg:test-swimmer"],
    expected: 2,
  },
  {
    id: "cwg-athletics-major",
    key: "cwg",
    sport: "Athletics",
    commonwealthDiscipline: "athletics",
    name: "Athletics final",
    date: "2026-08-07",
    time: "20:00",
    broadcaster: "Kayo Sports",
    expected: 5,
  },
];

const config = normalizeCalendarSyncQuery({
  sports: "afl,nrl,f1,cwg",
  providers: "kayo,foxtel",
  all: "afl",
  majorFollowed: "f1,cwg",
  follow: "competitor:f1:test-driver,competitor:cwg:test-swimmer",
  mute: "team:afl:muted",
  excludeCompetition: "competition:nrl:disabled",
  cwg: "swimming",
  min: "3",
  reminder: "30",
});
assert.deepEqual(config, {
  sports: ["afl", "nrl", "f1", "cwg"],
  providers: ["kayo", "foxtel"],
  allFixtures: ["afl"],
  majorFollowedSports: ["f1", "cwg"],
  followedParticipantIds: ["competitor:f1:test-driver", "competitor:cwg:test-swimmer"],
  mutedParticipantIds: ["team:afl:muted"],
  excludedCompetitionIds: ["competition:nrl:disabled"],
  cwgDisciplines: ["swimming"],
  minStakes: 3,
  reminderMinutes: 30,
});
assert.deepEqual(inferProviderIds("Kayo Sports / ESPN"), ["kayo"]);
assert.deepEqual(eventProviderIds({
  broadcaster: "Fox Footy / Kayo Sports",
  broadcasterIds: ["kayo", "foxtel"],
}), ["kayo", "foxtel"], "explicit provider ids and broadcaster labels must combine without duplicates");
assert.deepEqual(eventParticipantIds({
  participantIds: ["competitor:f1:test-driver"],
  homeParticipantId: "team:afl:home",
  awayParticipantId: "team:afl:away",
}), ["competitor:f1:test-driver", "team:afl:home", "team:afl:away"]);
assert.equal(eventCommonwealthDiscipline({ sport: "Track and Field" }), "athletics");
assert.equal(calendarEventIsCurrent(events.find(event => event.id === "expired"), now), false, "the calendar feed must honour the same 14-day retention boundary");

const selected = filterCalendarEvents(events, config, now);
assert.deepEqual(
  selected.map(event => event.id),
  ["afl-froth", "nrl-like", "f1-followed", "cwg-swimming-followed"],
  "Calendar sync must combine followed sports, coverage depth, entity follows and mutes, competition exclusions, CWG disciplines, providers, stakes, and retention"
);

const parentMotorsportEvents = [
  {
    id: "goodwood-parent-follow",
    key: "goodwood",
    sport: "Goodwood Festival of Speed",
    sportDomainId: "special:goodwood-festival-of-speed",
    date: "2026-08-08",
    time: "18:00",
    broadcaster: "Kayo Sports",
    expected: 1,
  },
  {
    id: "lemans-parent-follow",
    key: "lemans",
    sport: "Le Mans",
    sportDomainId: "special:le-mans-24-hours",
    date: "2026-08-09",
    time: "18:00",
    broadcaster: "Kayo Sports",
    expected: 1,
  },
  {
    id: "f1-child-follow",
    key: "f1",
    sport: "Formula 1",
    date: "2026-08-10",
    time: "18:00",
    broadcaster: "Kayo Sports",
    expected: 1,
  },
];
assert.equal(
  calendarSportSelectionMatchesEvent(new Set(["motorsport"]), parentMotorsportEvents[0]),
  true,
  "the parent Motorsport transport key must match internal Goodwood events"
);
assert.deepEqual(
  filterCalendarEvents(parentMotorsportEvents, normalizeCalendarSyncQuery({
    sports: "motorsport",
    all: "motorsport",
    providers: "kayo",
  }), now).map(event => event.id),
  ["goodwood-parent-follow", "lemans-parent-follow", "f1-child-follow"],
  "a parent Motorsport calendar follow must retain F1 plus its Goodwood and Le Mans internal events"
);
assert.deepEqual(
  filterCalendarEvents(parentMotorsportEvents, normalizeCalendarSyncQuery({
    sports: "f1",
    all: "f1",
    providers: "kayo",
  }), now).map(event => event.id),
  ["f1-child-follow"],
  "an F1-only calendar follow must not widen to parent-only Motorsport events"
);
assert.deepEqual(
  filterCalendarEvents(events, normalizeCalendarSyncQuery({
    sports: "swimming",
    all: "swimming",
    providers: "kayo",
    cwg: "swimming",
  }), now).map(event => event.id),
  ["cwg-swimming-followed"],
  "a migrated Swimming calendar follow must retain its CWG discipline without admitting other Games sports"
);

const calendar = buildCalendarIcs(selected, {
  generatedAt: now,
  reminderMinutes: config.reminderMinutes,
});
assert(calendar.startsWith("BEGIN:VCALENDAR\r\n"));
assert(calendar.endsWith("END:VCALENDAR\r\n"));
assert.equal((calendar.match(/BEGIN:VEVENT/g) || []).length, 4);
assert(calendar.includes("UID:afl-froth@nothingsports"));
assert(calendar.includes("TRIGGER:-PT30M"));
assert(calendar.includes("LOCATION:Optus Stadium\\, Perth"));
assert(!calendar.includes("wrong-provider"));
assert(calendar.split("\r\n").every(line => Buffer.byteLength(line, "utf8") <= 75), "calendar lines must respect the RFC 5545 75-octet limit");

const query = calendarSyncQuery(config);
assert.equal(
  query,
  "sports=afl%2Ccwg%2Cf1%2Cnrl&providers=foxtel%2Ckayo&all=afl&majorFollowed=cwg%2Cf1&follow=competitor%3Acwg%3Atest-swimmer%2Ccompetitor%3Af1%3Atest-driver&mute=team%3Aafl%3Amuted&excludeCompetition=competition%3Anrl%3Adisabled&cwg=swimming&min=3&reminder=30"
);

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
assert(Number(calendarResponse.headers["X-nothingsport-Events"]) >= 1);
assert.equal(
  calendarResponse.headers["X-nothingSports-Events"],
  calendarResponse.headers["X-nothingsport-Events"],
  "legacy calendar clients must retain the old event-count header during the brand migration"
);

console.log(`Calendar sync valid: ${selected.length} filtered fixtures, subscription query and Vercel endpoint passed.`);
