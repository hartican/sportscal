#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const { buildServerFeed } = require("../lib/server-feed-pipeline");
const { resolveUserFollowFixtures } = require("../lib/follow-fixture-resolver");
const followFeedPolicy = require("../config/follow-feed-policy");
const majorEventsConfig = require("../config/major-events");
const majorEventsDocument = require("../data/major-events.v1.json");
const tennisWatchPool = require("../data/canonical/tennis-watch-pool-2026.json");

const LIVERPOOL_ID = "event:premier-league:128939";
const LIVERPOOL_TEAM_ID = "team:football:epl:10";
const DJOKOVIC_ID = "athlete:tennis:novak-djokovic";
const DJOKOVIC_US_OPEN_ID = "fixture:us-open-2026:official:ms:1148";
const ALCARAZ_US_OPEN_ID = "fixture:us-open-2026:official:ms:1164";

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
const topTenCollection = tennisWatchPool.collections.find(collection => collection.id === "collection:tennis:mens-top-10");
const normalizedTopTenIds = new Set((topTenCollection?.memberIds || []).flatMap(id => {
  const slug = String(id).match(/^competitor:tennis:(?:atp|wta):(.+)$/)?.[1];
  return slug ? [id, `athlete:tennis:${slug}`] : [id];
}));
const releasedTopTenFixtures = resolvedTennis.events.filter(event => (
  event.status !== "cancelled"
  && event.date
  && (event.participantIds || []).some(id => normalizedTopTenIds.has(id))
));
const surfacedTopTenIds = new Set(releasedTopTenFixtures.flatMap(event => event.participantIds || []).filter(id => normalizedTopTenIds.has(id)));
const membersWithReleasedFixtures = [...normalizedTopTenIds].filter(id => releasedTopTenFixtures.some(event => (event.participantIds || []).includes(id)));
membersWithReleasedFixtures.forEach(id => assert(surfacedTopTenIds.has(id), `${id} must retain every released top-10 fixture`));

const alcarazFixture = resolvedTennis.events.find(event => event.id === ALCARAZ_US_OPEN_ID);
assert(alcarazFixture, "Alcaraz v Safiullin must resolve from the inherited Men's top-10 follow");
assert.equal(alcarazFixture.timePrecision, "follows", "Alcaraz v Safiullin must preserve follows timing precision");
assert.equal(alcarazFixture.startTimeUtc, null, "a follows fixture must not invent an exact match start");
assert.equal(alcarazFixture.sessionStartTimeUtc, "2026-08-31T15:30:00.000Z", "the official session start must remain available for display and reminders");
const usOpen = majorEventsDocument.events.find(event => event.id === "major-event:us-open-2026");
const rawAlcarazFixture = usOpen.subEvents.find(event => event.id === ALCARAZ_US_OPEN_ID);
const alcarazTimeline = majorEventsConfig.phaseTimeline({ ...usOpen, subEvents:[rawAlcarazFixture] }, new Date("2026-08-31T04:00:00.000Z"), { level:"L2" });
const alcarazTimelineItem = alcarazTimeline.items.find(item => item?.subEvent?.id === ALCARAZ_US_OPEN_ID);
assert.equal(alcarazTimelineItem?.displayTime, "Follows · session starts 1:30am", "Events must distinguish the official session start from an exact match start even after the official source marks it completed");
assert.equal(majorEventsConfig.fixtureFromSubEvent(rawAlcarazFixture, usOpen).displayTimeLabel, "Follows · session starts 1:30am", "Feed must use the same follows timing copy");

assert.deepEqual(
  followFeedPolicy.followedFixtureDecision(alcarazFixture, { followed:true, now:new Date("2026-08-31T04:00:00.000Z") }),
  { mode:"immediate", include:true, label:"In Feed via follow" },
  "a released 4/5 followed fixture must enter Feed as soon as date and opponents are known",
);

const activeTopTenFixtures = releasedTopTenFixtures.filter(event => event.date >= "2026-08-31" && ["scheduled", "live", "completed"].includes(event.status));
const auditedTopTenFeed = buildServerFeed({
  events:activeTopTenFixtures,
  userId:"00000000-0000-4000-8000-000000000003",
  userState:topTenTennisState,
  participants:resolvedTennis.participants,
  now:new Date("2026-08-31T04:00:00.000Z"),
  limit:1000,
});
activeTopTenFixtures.forEach(fixture => {
  const decision = followFeedPolicy.followedFixtureDecision(fixture, { followed:true, now:new Date("2026-08-31T04:00:00.000Z") });
  assert.equal(
    auditedTopTenFeed.events.some(event => event.id === fixture.id),
    decision.include,
    `${fixture.name} must match the shared ${decision.mode} Feed rule`,
  );
});
const lowStakesTomorrow = { ...alcarazFixture, id:"fixture:test:tomorrow", eventId:"fixture:test:tomorrow", canonicalEventId:"fixture:test:tomorrow", stakesScore:2, storyline:{ stakes:2 }, date:"2026-09-01" };
assert.deepEqual(
  followFeedPolicy.followedFixtureDecision(lowStakesTomorrow, { followed:true, now:new Date("2026-08-31T04:00:00.000Z") }),
  { mode:"match-day", include:false, label:"Auto-adds on match day" },
  "a released 2/5 followed fixture must wait for match day",
);
assert.deepEqual(
  followFeedPolicy.followedFixtureDecision({ ...lowStakesTomorrow, date:"2026-08-30" }, { followed:true, now:new Date("2026-08-31T04:00:00.000Z") }),
  { mode:"match-day", include:true, label:"In Feed via follow" },
  "a match-day followed fixture must remain available through its normal post-match retention window",
);
assert.deepEqual(
  followFeedPolicy.followedFixtureDecision({ ...lowStakesTomorrow, stakesScore:1, storyline:{ stakes:1 } }, { followed:true, now:new Date("2026-09-01T04:00:00.000Z") }),
  { mode:"manual", include:false, label:"Add to Feed" },
  "a 1/5 followed fixture must remain manual-only even on match day",
);
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
  /function automaticallyFollowedMajorEventFixtures[^]*FOLLOW_FEED_POLICY\.followedFixtureDecision[^]*const specialEvents = \[\.\.\.automaticallyFollowedMajorEventFixtures\(\), \.\.\.selectedMajorEventFixtures\(\)\]/,
  "released Major Event fixtures must share the automatic follow policy instead of requiring Add to Feed",
);
assert(html.includes("automaticDecision.label"), "Events must render the same followed-fixture policy label used by Feed");
assert(html.includes("ensureFollowCollectionDirectories(userPreferences)"), "cloud-restored collection follows must load their membership directory after every shell update");

console.log("Followed Liverpool and inherited top-10 Djokovic fixtures stay on page one around play.");
