#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const zlib = require("node:zlib");
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
    end(){ this.ended = true; return this; },
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
  assert.equal(schema.properties.schemaVersion.const, "server-feed.v3");
  assert.equal(schema.properties.derivedCardCache.properties.buildOrigin.const, "server");
  assert(schema.required.includes("sourcePublishedAt"), "server feeds must distinguish canonical publication time from per-user generation time");
  assert.equal(feedPipeline.SERVER_FEED_BUILD_VERSION, "editorial-alias-dedupe.v1");
  assert.match(
    fs.readFileSync("api/feed.js", "utf8"),
    /buildVersion:\s*SERVER_FEED_BUILD_VERSION/,
    "a server-side composition change must invalidate the authenticated HTTP response even when its source data version is unchanged"
  );

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
  const editorialNarrative = {
    schemaVersion:"editorial-narrative.v2",
    projectionId:"projection:test:server-feed",
    researchTier:"marquee",
    hook:"A researched hook that must survive the personalised feed boundary.",
    factIds:["fact:one", "fact:two", "fact:three", "fact:four"],
    sourceIds:["source:one", "source:two", "source:three"],
    threadIds:["thread:one"],
    dimensions:["matchup", "history", "consequence"],
    researchedAt:"2026-08-30T06:00:00.000Z",
    generationMode:"researched",
  };
  const editorialServerEvent = feedPipeline.normalizeEvent(event("editorial-server-event", "2026-10-15T09:05:00.000Z", { editorialNarrative }), new Date("2026-08-30T00:00:00.000Z"));
  assert.deepEqual(editorialServerEvent.editorialNarrative, editorialNarrative, "the personalised feed must preserve the validated editorial projection for L0 and Sentiment rendering");

  const correctedKickoffBefore = event("event:fixture:123", "2026-07-27T13:00:00.000Z", {
    canonicalEventId: "event:fixture:123",
  });
  const correctedKickoffAfter = {
    ...correctedKickoffBefore,
    time: "13:30",
    startTimeUtc: "2026-07-27T13:30:00.000Z",
  };
  assert.equal(
    feedPipeline.eventActionKey(correctedKickoffBefore),
    feedPipeline.eventActionKey(correctedKickoffAfter),
    "the signed-in server feed must retain an edition action across schedule corrections"
  );
  const canonicalAliasEvent = event("provider-fixture-123", "2026-07-27T13:00:00.000Z", {
    canonicalEventId:"event:fixture:123",
  });
  assert.equal(
    feedPipeline.eventActionFor(canonicalAliasEvent, {
      "provider-fixture-123:2026-07-27T13:00": {
        eventId:"provider-fixture-123",
        dismissed:true,
      },
    }).dismissed,
    true,
    "the server feed must resolve legacy provider ids through the canonical event aliases"
  );

  const migratedCataloguePreferences = {
    preferenceGraph: {
      domainPreferences: [
        { sportDomainId: "sport:motorsport", enabled: true, includeAllFixtures: true, includeMajorEvents: true },
        { sportDomainId: "sport:tennis", enabled: true, includeAllFixtures: true, includeMajorEvents: true },
        { sportDomainId: "sport:swimming", enabled: true, includeAllFixtures: true, includeMajorEvents: true },
      ],
      competitionPreferences: [],
      entityFollows: [],
    },
  };
  const goodwood = event("goodwood-internal", "2026-07-27T13:00:00.000Z", {
    key: "goodwood",
    sport: "Goodwood Festival of Speed",
    sportDomainId: "special:goodwood-festival-of-speed",
    expected: 2,
    storyline: { intensity: 1, stakes: 1 },
  });
  const wimbledon = event("wimbledon-internal", "2026-07-27T13:30:00.000Z", {
    key: "wimbledon",
    sport: "Tennis",
    sportDomainId: "special:wimbledon",
    expected: 2,
    storyline: { intensity: 1, stakes: 1 },
  });
  const cwgSwimming = event("cwg-swimming-internal", "2026-07-27T14:00:00.000Z", {
    key: "cwg",
    sport: "Swimming",
    sportDomainId: "special:commonwealth-games",
    commonwealthDiscipline: "swimming",
    expected: 2,
    storyline: { intensity: 1, stakes: 1 },
  });
  const cwgAthletics = {
    ...cwgSwimming,
    id: "cwg-athletics-internal",
    eventId: "cwg-athletics-internal",
    sport: "Athletics",
    commonwealthDiscipline: "athletics",
  };
  assert.deepEqual(
    feedPipeline.eventDomainPreferences(goodwood, migratedCataloguePreferences).map(preference => preference.sportDomainId),
    ["sport:motorsport"],
    "a migrated Motorsport preference must govern Goodwood's internal event domain"
  );
  assert.equal(feedPipeline.shouldEnrichEvent(goodwood, migratedCataloguePreferences, {}), true);
  assert.equal(feedPipeline.shouldEnrichEvent(wimbledon, migratedCataloguePreferences, {}), true);
  assert.equal(feedPipeline.shouldEnrichEvent(cwgSwimming, migratedCataloguePreferences, {}), true);
  assert.equal(
    feedPipeline.shouldEnrichEvent(cwgAthletics, migratedCataloguePreferences, {}),
    false,
    "a migrated Swimming preference must not claim a different Commonwealth Games discipline"
  );
  assert.equal(
    feedPipeline.shouldEnrichEvent(goodwood, {
      preferenceGraph: {
        ...migratedCataloguePreferences.preferenceGraph,
        domainPreferences: [{ sportDomainId: "sport:motorsport", enabled: false }],
      },
    }, {}),
    false,
    "an explicit parent-sport unfollow must suppress its internal event tags"
  );
  const legacyEventFollowFeed = feedPipeline.buildServerFeed({
    events: [goodwood],
    userId: "22222222-2222-4222-8222-222222222222",
    userState: {
      preferences: {
        version: 12,
        selectedSelectorEntityIds: ["special:le-mans-24-hours"],
        followedSports: ["lemans"],
        preferenceGraph: {
          domainPreferences: [{
            sportDomainId: "special:le-mans-24-hours",
            enabled: true,
            includeAllFixtures: true,
            includeMajorEvents: true,
          }],
          competitionPreferences: [],
          entityFollows: [],
        },
      },
    },
    now: new Date("2026-07-27T12:00:00.000Z"),
  });
  assert(
    legacyEventFollowFeed.derivedCardCache.derivedCards.some(card => card.canonicalEventId === goodwood.eventId),
    "the signed-in server pipeline must migrate a legacy Le Mans follow before applying it to the Motorsport family"
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
    event("manual-archive-expired", "2026-06-20T09:00:00.000Z"),
  ];
  const savedEvent = canonicalEvents.find(item => item.eventId === "saved-expired");
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
    archivedEvents: [{
      canonicalEventId: "manual-archive-expired",
      archivedAt: "2026-06-21T09:00:00.000Z",
    }],
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

  assert.equal(feed.schemaVersion, "server-feed.v3");
  assert.deepEqual(feed.pagination, { cursor: 0, limit: 20, nextCursor: null, total: 4 });
  assert.equal(feed.sourcePublishedAt, "2026-07-27T08:00:00.000Z", "server feeds must retain the canonical publication time separately from per-user generation");
  assert.equal(feed.derivedCardCache.buildOrigin, "server");
  assert.equal(feed.retention.archiveDays, 7);
  assert.equal(feed.retention.retentionDays, 14);
  assert.deepEqual(feed.retention, {
    archiveDays: 7,
    retentionDays: 14,
    inputEvents: 6,
    retainedEvents: 5,
    enrichedEvents: 3,
    derivedCards: 3,
    active: 2,
    archived: 1,
    saved: 2,
    expired: 1,
  });
  assert(!feed.events.some(item => item.eventId === "expired"), "expired unsaved facts must not return to the client");
  assert(feed.events.some(item => item.eventId === "archived"), "7-14 day facts must remain available to Archived");
  assert(feed.events.some(item => item.eventId === "saved-expired"), "saved facts must survive the retention boundary");
  assert(feed.events.some(item => item.eventId === "manual-archive-expired"), "legacy archive references must preserve facts indefinitely even without a matching action record");
  assert(feed.derivedCardCache.derivedCards.some(card => card.canonicalEventId === "manual-archive-expired"), "manual Archive must remain materialized for recovery after the normal window");
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
    assert.equal(response.body.schemaVersion, "server-feed.v3");
    assert.equal(response.body.sourcePublishedAt, require("../data/events.json").publishedAt, "authenticated feeds must expose the canonical publication time");
    assert.equal(response.body.derivedCardCache.buildOrigin, "server");
    assert(zlib.gzipSync(JSON.stringify(response.body)).length <= 250 * 1024, "the first authenticated feed page must remain below 250 KiB compressed");
    assert.equal(response.headers["Cache-Control"], "private, max-age=0, must-revalidate");
    assert(response.headers.ETag, "personalised feed pages must expose a validator");
    assert.equal(response.headers.Vary, "Authorization");
    const conditionalResponse = responseStub();
    await feedHandler({
      method: "GET",
      headers: {
        authorization: "Bearer access-token",
        "if-none-match": response.headers.ETag,
      },
    }, conditionalResponse);
    assert.equal(conditionalResponse.statusCode, 304, "an unchanged personalised page must honour If-None-Match despite its generated timestamp");
    assert.equal(conditionalResponse.ended, true);
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
    assert.deepEqual([...womensFinal.participantIds].sort(), [
      "competitor:tennis:wta:karolina-muchova",
      "competitor:tennis:wta:linda-noskova",
    ].sort(), "central Wimbledon women's cards must resolve only named WTA competitors regardless of home/away display order");
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

  console.log("Server feed valid: authenticated central rebuild, selective enrichment, explicit archive exemptions, and 7/14-day retention passed.");
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
