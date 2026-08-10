#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const cardLifecycle = require("../config/card-lifecycle");
const feedPipeline = require("../lib/server-feed-pipeline");
const feedHandler = require("../api/feed");

function event(id, startTimeUtc, overrides = {}){
  const start = new Date(startTimeUtc);
  return {
    id,
    eventId: id,
    key: "afl",
    sport: "AFL",
    sportDomainId: "sport:afl",
    competitionId: "competition:afl-premiership-2026",
    name: `${id} fixture`,
    displayTitleCompact: `${id} fixture`,
    date: start.toISOString().slice(0, 10),
    time: start.toISOString().slice(11, 16),
    startTimeUtc,
    broadcaster: "Seven / 7plus",
    broadcastOptions: ["Seven", "7plus"],
    expected: 7,
    liveWindow: 3,
    storyline: { intensity: 3, stakes: 3 },
    participantIds: ["team:afl:followed"],
    homeParticipantId: "team:afl:followed",
    awayParticipantId: "team:afl:other",
    ...overrides,
  };
}

function responseStub(){
  return {
    statusCode: null,
    headers: {},
    body: null,
    setHeader(name, value){ this.headers[name] = value; },
    status(code){ this.statusCode = code; return this; },
    json(value){ this.body = value; return this; },
  };
}

function fetchResponse(payload, status = 200){
  return {
    ok: status >= 200 && status < 300,
    status,
    async text(){ return JSON.stringify(payload); },
  };
}

async function run(){
  const schema = JSON.parse(fs.readFileSync("schemas/server-feed-response.schema.json", "utf8"));
  assert.equal(schema.properties.schemaVersion.const, "server-feed.v1");
  assert.equal(schema.properties.derivedCardCache.properties.buildOrigin.const, "server");
  assert(schema.required.includes("sourcePublishedAt"), "server feeds must distinguish canonical publication time from per-user generation time");

  assert.equal(
    feedPipeline.sydneyLocalDateToUtc("2026-07-27", "09:00").toISOString(),
    "2026-07-26T23:00:00.000Z",
    "winter Sydney event times must use AEST"
  );
  assert.equal(
    feedPipeline.sydneyLocalDateToUtc("2026-01-27", "09:00").toISOString(),
    "2026-01-26T22:00:00.000Z",
    "summer Sydney event times must use AEDT"
  );

  const now = new Date("2026-07-27T12:00:00.000Z");
  const canonicalEvents = [
    event("active-followed", "2026-07-27T13:00:00.000Z"),
    event("active-muted", "2026-07-27T14:00:00.000Z", {
      participantIds: ["team:afl:muted"],
      homeParticipantId: "team:afl:muted",
    }),
    event("archived", "2026-07-18T09:00:00.000Z"),
    event("expired", "2026-07-10T09:00:00.000Z"),
    event("saved-expired", "2026-07-01T09:00:00.000Z"),
  ];
  const savedEvent = canonicalEvents.at(-1);
  const userState = {
    preferences: {
      followedSports: ["afl"],
      selectedBroadcasters: ["seven"],
      preferenceGraph: {
        domainPreferences: [{
          sportDomainId: "sport:afl",
          enabled: true,
          includeAllFixtures: false,
          includeMajorEvents: false,
          includeFollowedTeams: true,
        }],
        competitionPreferences: [],
        entityFollows: [
          { participantId: "team:afl:followed", followLevel: "priority" },
          { participantId: "team:afl:muted", followLevel: "mute" },
        ],
        viewing: {
          selectedBroadcasterIds: ["seven"],
          viewingWindowEnabled: false,
        },
      },
    },
    event_user_state: {
      [feedPipeline.eventActionKey(savedEvent)]: {
        eventId: savedEvent.eventId,
        watchLater: true,
      },
      "wimbledon-final-sinner-zverev-2026:2026-07-13T01:00": {
        eventId: "wimbledon-final-sinner-zverev-2026",
        watchLater: true,
      },
      "wimbledon-final-noskova-muchova-2026:2026-07-12T01:00": {
        eventId: "wimbledon-final-noskova-muchova-2026",
        watchLater: true,
      },
      "evt_75:2026-06-17T09:00": {
        eventId: "evt_75",
        watchLater: true,
      },
      "evt_66:2026-07-27T00:00": {
        eventId: "evt_66",
        watchLater: true,
      },
      "cwg-glasgow-2026-swimming-closing-finals:2026-07-30T04:00": {
        eventId: "cwg-glasgow-2026-swimming-closing-finals",
        watchLater: true,
      },
      "cwg-glasgow-2026-boxing-finals-one:2026-08-01T20:00": {
        eventId: "cwg-glasgow-2026-boxing-finals-one",
        watchLater: true,
      },
    },
  };
  const feed = feedPipeline.buildServerFeed({
    events: canonicalEvents,
    userId: "11111111-1111-4111-8111-111111111111",
    userState,
    participants: [{
      id: "team:afl:followed",
      type: "team",
      displayName: "Followed Football Club",
    }],
    sourceVersion: "test-events-v1",
    sourcePublishedAt: "2026-07-27T08:00:00.000Z",
    now,
  });

  assert.equal(feed.schemaVersion, "server-feed.v1");
  assert.equal(feed.sourcePublishedAt, "2026-07-27T08:00:00.000Z", "server feeds must retain the canonical publication time separately from per-user generation");
  assert.equal(feed.derivedCardCache.buildOrigin, "server");
  assert.equal(feed.retention.archiveDays, 7);
  assert.equal(feed.retention.retentionDays, 14);
  assert.deepEqual(feed.retention, {
    archiveDays: 7,
    retentionDays: 14,
    inputEvents: 5,
    retainedEvents: 4,
    enrichedEvents: 2,
    derivedCards: 2,
    active: 2,
    archived: 1,
    saved: 1,
    expired: 1,
  });
  assert(!feed.events.some(item => item.eventId === "expired"), "expired unsaved facts must not return to the client");
  assert(feed.events.some(item => item.eventId === "archived"), "7-14 day facts must remain available to Archived");
  assert(feed.events.some(item => item.eventId === "saved-expired"), "saved facts must survive the retention boundary");
  assert(!feed.derivedCardCache.derivedCards.some(card => card.canonicalEventId === "archived"), "auto-archived events must not rematerialize as feed cards");
  assert(!feed.derivedCardCache.derivedCards.some(card => card.canonicalEventId === "active-muted"), "muted participants must not receive selective enrichment");
  const followedCard = feed.derivedCardCache.derivedCards.find(card => card.canonicalEventId === "active-followed");
  assert.equal(followedCard.renderPayload.followContext[0].displayName, "Followed Football Club");
  assert(Array.isArray(followedCard.renderPayload.storyline.scoreReasons), "central cards must carry their explainable ranking snapshot");
  assert.equal(
    cardLifecycle.normalizeCache(feed.derivedCardCache).buildOrigin,
    "server",
    "the browser cache normalizer must preserve central-build provenance"
  );

  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const originalFetch = global.fetch;
  process.env.SUPABASE_URL = "https://project-ref.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
  global.fetch = async url => {
    if (String(url).endsWith("/auth/v1/user")){
      return fetchResponse({
        id: "11111111-1111-4111-8111-111111111111",
        email: "fan@example.com",
      });
    }
    if (String(url).includes("/rest/v1/nothingsports_user_state")){
      return fetchResponse([{
        user_id: "11111111-1111-4111-8111-111111111111",
        schema_version: "user-state.v1",
        profile: {},
        ...userState,
        event_spoiler_state: {},
        archived_events: [],
        ratings: {},
      }]);
    }
    return fetchResponse({ message: "Unexpected request" }, 500);
  };

  try{
    const response = responseStub();
    await feedHandler({
      method: "GET",
      headers: { authorization: "Bearer access-token" },
    }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.schemaVersion, "server-feed.v1");
    assert.equal(response.body.sourcePublishedAt, require("../data/events.json").publishedAt, "authenticated feeds must expose the canonical publication time");
    assert.equal(response.body.derivedCardCache.buildOrigin, "server");
    assert.equal(response.headers["Cache-Control"], "private, no-store, max-age=0");
    assert.equal(response.headers.Vary, "Authorization");
    const f1Session = response.body.events.find(item => item.key === "f1" && /\b(?:Qualifying|Race)\b/i.test(item.name));
    assert(f1Session, "the authenticated feed must retain an F1 session card");
    assert.equal(f1Session.sportDomainId, "sport:f1", "central F1 cards must use the F1 preference domain");
    assert.equal(f1Session.participantIds.length, 33, "central F1 cards must resolve the active driver and team field");
    const f1Watch = response.body.events.find(item => item.key === "f1" && /watch/i.test(item.name));
    assert(!f1Watch || !f1Watch.participantIds?.length, "central ticket/date watches must not inherit sporting follow context");
    const tennisFinal = response.body.events.find(item => item.id === "wimbledon-final-sinner-zverev-2026");
    assert(tennisFinal, "the authenticated feed must retain the Wimbledon men's final card");
    assert.equal(tennisFinal.sportDomainId, "special:wimbledon", "central Wimbledon cards must use the Special Event preference domain");
    assert.deepEqual(tennisFinal.participantIds, [
      "competitor:tennis:atp:jannik-sinner",
      "competitor:tennis:atp:alexander-zverev",
    ], "central Wimbledon men's cards must resolve only named ATP competitors");
    const womensFinal = response.body.events.find(item => item.id === "wimbledon-final-noskova-muchova-2026");
    assert(womensFinal, "the authenticated feed must retain the saved Wimbledon women's final card");
    assert(!womensFinal.participantIds?.length, "central Wimbledon women's cards must not inherit ATP follow context");
    const tourFinal = response.body.events.find(item => item.id === "evt_66");
    assert(tourFinal, "the authenticated feed must retain the recent Tour de France final stage");
    assert.equal(tourFinal.sportDomainId, "special:tour-de-france", "central Tour cards must use the Special Event preference domain");
    assert.equal(tourFinal.participantIds.length, 14, "central Tour cards must resolve the calibrated rider-follow field");
    assert.equal(tourFinal.jerseySnapshot?.stageNumber, 21, "central Tour cards must carry their matching stage-jersey snapshot");
    assert.equal(tourFinal.jerseySnapshot?.close.yellowParticipantId, "competitor:cycling:tdf:tadej-pogacar");
    assert.equal(tourFinal.jerseySnapshot?.close.polkadotParticipantId, "competitor:cycling:tdf:richard-carapaz");
    assert.equal(tourFinal.jerseySnapshot?.close.purpleParticipantId, null, "central context must not fabricate a purple Tour classification");
    const nbaFinal = response.body.events.find(item => item.id === "evt_75");
    assert(nbaFinal, "the authenticated feed must retain the saved NBA Finals decider");
    assert.equal(nbaFinal.sportDomainId, "sport:nba", "central NBA cards must use the NBA preference domain");
    assert.deepEqual(nbaFinal.participantIds, [
      "team:nba:new-york-knicks",
      "team:nba:san-antonio-spurs",
      "competitor:nba:jalen-brunson",
      "competitor:nba:victor-wembanyama",
    ], "central NBA Finals cards must resolve only the two teams and their surfaced All-NBA leaders");
    const cwgSwimmingFinals = response.body.events.find(item => item.id === "cwg-glasgow-2026-swimming-closing-finals");
    assert(cwgSwimmingFinals, "the authenticated feed must retain the saved Commonwealth Games swimming finals");
    assert.equal(cwgSwimmingFinals.sportDomainId, "special:commonwealth-games");
    assert.deepEqual(cwgSwimmingFinals.participantIds, [
      "competitor:cwg:kaylee-mckeown",
      "competitor:cwg:cameron-mcevoy",
      "competitor:cwg:kyle-chalmers",
      "competitor:cwg:mollie-ocallaghan",
      "competitor:cwg:tim-hodge",
      "competitor:cwg:lakeisha-patterson",
    ], "central CWG swimming cards must resolve only the calibrated swimming and para-swimming competitors");
    const cwgBoxingFinals = response.body.events.find(item => item.id === "cwg-glasgow-2026-boxing-finals-one");
    assert(cwgBoxingFinals, "the authenticated feed must retain the saved Commonwealth Games boxing finals");
    assert(!cwgBoxingFinals.participantIds?.length, "unsupported CWG disciplines must not inherit competitor context");

    const methodResponse = responseStub();
    await feedHandler({ method: "POST", headers: {} }, methodResponse);
    assert.equal(methodResponse.statusCode, 405);
  }finally{
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = originalKey;
    global.fetch = originalFetch;
  }

  console.log("Server feed valid: authenticated central rebuild, selective enrichment, saved exemptions, and 7/14-day retention passed.");
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
