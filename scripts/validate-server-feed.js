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
    now,
  });

  assert.equal(feed.schemaVersion, "server-feed.v1");
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
    assert.equal(response.body.derivedCardCache.buildOrigin, "server");
    assert.equal(response.headers["Cache-Control"], "private, no-store, max-age=0");
    assert.equal(response.headers.Vary, "Authorization");

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
