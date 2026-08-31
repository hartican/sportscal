#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const { buildServerFeed } = require("../lib/server-feed-pipeline");
const { resolveUserFollowFixtures } = require("../lib/follow-fixture-resolver");

const LIVERPOOL_ID = "event:premier-league:128939";
const LIVERPOOL_TEAM_ID = "team:football:epl:10";
const DJOKOVIC_ID = "athlete:tennis:novak-djokovic";
const DJOKOVIC_US_OPEN_ID = "fixture:us-open-2026:official:ms:1148";

function genericEvent(index){
  const start = new Date(Date.UTC(2026, 7, 30 + index, 9, 0));
  return {
    id: `generic-${index}`,
    eventId: `generic-${index}`,
    canonicalEventId: `event:generic:${index}`,
    key: "afl",
    sport: "AFL",
    sportDomainId: "sport:afl",
    competitionId: "competition:afl-premiership-2026",
    name: `Generic fixture ${index}`,
    displayTitleCompact: `Generic fixture ${index}`,
    date: start.toISOString().slice(0, 10),
    time: "19:00",
    startTimeUtc: start.toISOString(),
    endTimeUtc: new Date(start.getTime() + 3 * 60 * 60 * 1000).toISOString(),
    participantIds: [`team:afl:generic-${index}`],
    expected: 7,
    storyline: { stakes: 3, intensity: 3 },
  };
}

const liverpoolFixture = {
  id: "epl-2026-27-128939",
  eventId: "epl-2026-27-128939",
  canonicalEventId: LIVERPOOL_ID,
  key: "premier-league",
  sport: "Football",
  sportDomainId: "sport:football",
  competitionId: "competition:premier-league-2026-27",
  name: "Liverpool v Nottingham Forest",
  displayTitleCompact: "Liverpool v Nottingham Forest",
  date: "2026-08-29",
  time: "21:30",
  startTimeUtc: "2026-08-29T11:30:00.000Z",
  endTimeUtc: "2026-08-29T13:30:00.000Z",
  participantIds: [LIVERPOOL_TEAM_ID, "team:football:epl:15"],
  homeParticipantId: LIVERPOOL_TEAM_ID,
  awayParticipantId: "team:football:epl:15",
  broadcaster: "Stan Sport",
  expected: 6,
  liveWindow: 2,
  storyline: { stakes: 3, intensity: 3 },
};

const userState = {
  preferences: {
    followedSports: ["premier-league"],
    preferenceGraph: {
      domainPreferences: [{
        sportDomainId: "sport:football",
        enabled: true,
        includeAllFixtures: false,
        includeMajorEvents: false,
        includeFollowedTeams: true,
      }],
      competitionPreferences: [],
      entityFollows: [{ participantId: LIVERPOOL_TEAM_ID, followLevel: "follow" }],
    },
  },
};

function pageAt(now){
  return buildServerFeed({
    events: [...Array.from({ length: 48 }, (_, index) => genericEvent(index)), liverpoolFixture, ...Array.from({ length: 7 }, (_, index) => genericEvent(index + 48))],
    userId: "00000000-0000-4000-8000-000000000001",
    userState,
    now,
    limit: 20,
  });
}

for (const [label, now, expectedStatus] of [
  ["21:25 Sydney before kickoff", "2026-08-29T11:25:00.000Z", "upcoming"],
  ["21:31 Sydney after kickoff", "2026-08-29T11:31:00.000Z", "live"],
]){
  const feed = pageAt(new Date(now));
  const event = feed.events.find(item => item.canonicalEventId === LIVERPOOL_ID);
  assert(event, `${label}: the followed Liverpool fixture must be on the initial 20-event page`);
  assert.equal(event.status, expectedStatus, `${label}: the timeline status must remain accurate`);
  assert(feed.derivedCardCache.derivedCards.some(card => card.canonicalEventId === LIVERPOOL_ID), `${label}: the server-derived card must correspond to the first page`);
  assert(feed.events.length <= 20, `${label}: the startup page limit must be retained`);
}

const topTenTennisState = {
  preferences: {
    followedSports: ["tennis"],
    followFirst: {
      collectionFollows: ["collection:tennis:mens-top-10"],
    },
    preferenceGraph: {
      domainPreferences: [{
        sportDomainId: "sport:tennis",
        enabled: true,
        includeAllFixtures: false,
        includeMajorEvents: false,
        includeFollowedTeams: true,
      }],
      competitionPreferences: [],
      entityFollows: [],
    },
  },
};

const resolvedTennis = resolveUserFollowFixtures({ events: [], userState: topTenTennisState });
const djokovicFixture = resolvedTennis.events.find(event => (
  event.id === DJOKOVIC_US_OPEN_ID
  && event.participantIds.includes(DJOKOVIC_ID)
));
assert(djokovicFixture, "the Men's current top 10 collection must resolve Djokovic's released US Open match");

const djokovicFeed = buildServerFeed({
  events: [...Array.from({ length: 55 }, (_, index) => genericEvent(index)), djokovicFixture],
  userId: "00000000-0000-4000-8000-000000000002",
  userState: topTenTennisState,
  participants: resolvedTennis.participants,
  now: new Date("2026-08-31T04:00:00.000Z"),
  limit: 20,
});
assert(
  djokovicFeed.events.some(event => event.id === DJOKOVIC_US_OPEN_ID),
  "Djokovic's completed US Open match must remain on the initial Today page for an inherited top-10 follow",
);
assert(
  djokovicFeed.derivedCardCache.derivedCards.some(card => card.canonicalEventId === DJOKOVIC_US_OPEN_ID),
  "the inherited Djokovic follow must materialise a first-page server card",
);

const html = fs.readFileSync("index.html", "utf8");
assert.match(
  html,
  /function automaticallyFollowedMajorEventFixtures[^]*automaticEventFollowReason\(fixture\)[^]*const specialEvents = \[\.\.\.automaticallyFollowedMajorEventFixtures\(\), \.\.\.selectedMajorEventFixtures\(\)\]/,
  "today's released Major Event fixtures must have a local automatic-follow backstop instead of requiring Add to Feed",
);
assert(html.includes('autoFeedToday ? "In Feed via follow" : "Auto-adds on match day"'), "Events must explain that followed fixtures enter Feed automatically");
assert(html.includes("ensureFollowCollectionDirectories(userPreferences)"), "cloud-restored collection follows must load their membership directory after every shell update");

console.log("Followed Liverpool and inherited top-10 Djokovic fixtures stay on page one around play.");
