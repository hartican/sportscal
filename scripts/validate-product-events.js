#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const PRODUCT_EVENTS = require("../config/product-events");
const productEventsHandler = require("../api/product-events");
const SERVER_SYNC = require("../config/server-sync");

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
    async text(){ return payload === null ? "" : JSON.stringify(payload); },
  };
}

function browserResponse(payload, status = 200){
  return {
    ok: status >= 200 && status < 300,
    status,
    async json(){ return payload; },
  };
}

function memoryStorage(){
  const values = new Map();
  return {
    getItem(key){ return values.has(key) ? values.get(key) : null; },
    setItem(key, value){ values.set(key, String(value)); },
    removeItem(key){ values.delete(key); },
  };
}

function event(overrides = {}){
  return {
    clientEventId: "event-00000001",
    eventName: "opportunity_exposed",
    occurredAt: "2026-08-11T01:00:00.000Z",
    sessionId: "session-00000001",
    surface: "curated_feed",
    sport: "nrl",
    competitionId: "competition:nrl-premiership-2026",
    canonicalEventId: "event:nrl:2026:round-23:test",
    properties: { presentation: "card", position: 0, feedBucket: "new" },
    ...overrides,
  };
}

async function run(){
  const schema = JSON.parse(fs.readFileSync("schemas/product-events.schema.json", "utf8"));
  assert.equal(schema.properties.schemaVersion.const, PRODUCT_EVENTS.SCHEMA_VERSION);
  assert.equal(schema.properties.events.maxItems, 20);
  assert.equal(schema.properties.events.items.additionalProperties, false);
  assert.equal(schema.properties.events.items.properties.properties.maxProperties, 6);
  assert.equal(PRODUCT_EVENTS.MAX_BATCH_SIZE, 20);
  assert.equal(PRODUCT_EVENTS.PILOT_MEASUREMENT_PARTICIPATION_VERSION, "pilot-participation.v1");
  assert.deepEqual(PRODUCT_EVENTS.EVENT_NAMES, [
    "opportunity_exposed",
    "fixture_check",
    "watch_decision",
    "feed_action",
    "preference_change",
    "feed_control_change",
    "swipe",
    "rating",
    "tune_prompt",
    "tune_session",
    "weekly_pulse",
  ]);

  const normalized = PRODUCT_EVENTS.normalizeBatch({
    schemaVersion: PRODUCT_EVENTS.SCHEMA_VERSION,
    events: [event()],
  });
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].occurredAt, "2026-08-11T01:00:00.000Z");
  assert.equal(normalized[0].properties.presentation, "card");
  const versionedExposure = PRODUCT_EVENTS.normalizeEvent(event({
    properties: {
      pilotVersion: "trust-pilot.v1",
      presentation: "card",
      position: 1,
      feedBucket: "new",
      recommendationClass: "discovery",
      coldStart: true,
    },
  }));
  assert.equal(versionedExposure.properties.pilotVersion, "trust-pilot.v1");
  assert.equal(versionedExposure.properties.recommendationClass, "discovery");
  assert.equal(versionedExposure.properties.coldStart, true);
  assert.equal(PRODUCT_EVENTS.normalizeEvent(event({
    eventName: "feed_action",
    properties: { action: "open", recommendationClass: "discovery", coldStart: true },
  })).properties.action, "open");
  assert.equal(PRODUCT_EVENTS.normalizeEvent(event({
    eventName: "preference_change",
    surface: "settings",
    canonicalEventId: undefined,
    properties: { action: "unfollow", targetType: "competition", coldStart: true },
  })).properties.targetType, "competition");
  assert.equal(PRODUCT_EVENTS.normalizeEvent(event({
    eventName: "preference_change",
    surface: "tune",
    canonicalEventId: undefined,
    properties: { action: "froth_upgrade", targetType: "sport", coldStart: false },
  })).properties.action, "froth_upgrade");
  assert.equal(PRODUCT_EVENTS.normalizeEvent(event({
    eventName: "feed_control_change",
    properties: { control: "froth", value: "balanced", coldStart: false },
  })).properties.value, "balanced");
  assert.equal(PRODUCT_EVENTS.normalizeEvent(event({
    eventName: "feed_control_change",
    surface: "tune",
    canonicalEventId: undefined,
    properties: { control: "sport_inclusion", value: "excluded", coldStart: true },
  })).properties.value, "excluded");
  assert.throws(() => PRODUCT_EVENTS.normalizeEvent(event({
    eventName: "feed_control_change",
    properties: { control: "froth", value: "ppv", coldStart: false },
  })), /value is invalid for properties\.control/i, "feed-control values must match their categorical control");
  assert.throws(() => PRODUCT_EVENTS.normalizeEvent(event({
    eventName: "feed_action",
    properties: { action: "open" },
  })), /recommendationClass is required/i, "approved feed actions must carry recommendation context");
  const rows = PRODUCT_EVENTS.rowsForUser(normalized, "11111111-1111-4111-8111-111111111111");
  assert.equal(rows[0].user_id, "11111111-1111-4111-8111-111111111111");
  assert.equal(rows[0].client_event_id, "event-00000001");

  assert.throws(() => PRODUCT_EVENTS.normalizeBatch({
    schemaVersion: PRODUCT_EVENTS.SCHEMA_VERSION,
    events: [event({ userId: "22222222-2222-4222-8222-222222222222" })],
  }), /unsupported field: userId/i, "clients must not supply ownership");
  assert.throws(() => PRODUCT_EVENTS.normalizeBatch({
    schemaVersion: PRODUCT_EVENTS.SCHEMA_VERSION,
    events: [event({ properties: { freeText: "call me" } })],
  }), /unsupported field: freeText/i, "properties must reject free text");
  assert.throws(() => PRODUCT_EVENTS.normalizeEvent(event({
    eventName: "feed_action",
    properties: { action: "open", recommendationClass: "discovery", coldStart: "yes" },
  })), /coldStart is invalid/i, "cold-start state must remain categorical");
  assert.throws(() => PRODUCT_EVENTS.normalizeBatch({
    schemaVersion: PRODUCT_EVENTS.SCHEMA_VERSION,
    events: Array.from({ length: 21 }, (_, index) => event({ clientEventId: `event-${String(index).padStart(8, "0")}` })),
  }), /at most 20/i);
  assert.throws(() => PRODUCT_EVENTS.normalizeBatch({
    schemaVersion: PRODUCT_EVENTS.SCHEMA_VERSION,
    events: [event({
      eventName: "weekly_pulse",
      surface: "weekly_pulse",
      properties: { crossCheck: "sometimes", missedFixtures: "none", feedClutter: "about_right" },
    })],
  }), /crossCheck is invalid/i);

  const phaseSixPulse = PRODUCT_EVENTS.normalizeEvent(event({
    eventName: "weekly_pulse",
    surface: "weekly_pulse",
    sport: undefined,
    competitionId: undefined,
    canonicalEventId: undefined,
    properties: {
      surveyVersion: "weekly-pulse.v1",
      pilotCohort: "hybrid",
      crossCheck: "once",
      missedFixtures: "none",
      feedClutter: "about_right",
      trustConfidence: "high",
    },
  }));
  assert.equal(phaseSixPulse.properties.pilotCohort, "hybrid");
  assert.equal(phaseSixPulse.properties.surveyVersion, "weekly-pulse.v1");
  assert.equal(phaseSixPulse.properties.trustConfidence, "high");
  assert.throws(() => PRODUCT_EVENTS.normalizeEvent(event({
    eventName: "weekly_pulse",
    surface: "weekly_pulse",
    properties: {
      pilotCohort: "everything",
      crossCheck: "never",
      missedFixtures: "none",
      feedClutter: "about_right",
      trustConfidence: "high",
    },
  })), /pilotCohort is invalid/i);
  assert.equal(PRODUCT_EVENTS.normalizeEvent(event({
    eventName: "rating",
    surface: "curated_feed",
    properties: { action: "shown" },
  })).properties.action, "shown");
  assert.equal(PRODUCT_EVENTS.normalizeEvent(event({
    eventName: "rating",
    surface: "curated_feed",
    properties: { action: "rated", score: 5 },
  })).properties.score, 5);

  const tsdr = PRODUCT_EVENTS.calculateWeeklyTsdr([
    { userId: "a", eventName: "opportunity_exposed", occurredAt: "2026-08-11T01:00:00.000Z" },
    { userId: "a", eventName: "fixture_check", occurredAt: "2026-08-12T01:00:00.000Z" },
    { userId: "b", eventName: "opportunity_exposed", occurredAt: "2026-08-13T01:00:00.000Z" },
    { userId: "c", eventName: "fixture_check", occurredAt: "2026-08-13T01:00:00.000Z" },
  ]);
  assert.deepEqual(tsdr, [{
    weekStart: "2026-08-10",
    denominator: 2,
    numerator: 1,
    tsdrPercent: 50,
  }]);

  const pulseSurveyId = PRODUCT_EVENTS.weeklyPulseSurveyId();
  assert.equal(pulseSurveyId, "weekly-pulse.v1");
  assert.equal(PRODUCT_EVENTS.normalizeWeeklyPulseSurveyId("weekly-pulse.v1:2026-08-10"), pulseSurveyId, "dated v1 completions must migrate to the explicit survey release");
  assert.equal(PRODUCT_EVENTS.sydneyDateKey(new Date("2026-08-11T23:30:00.000Z")), "2026-08-12");
  const pilot = { enabled: true, participationStartedAt: "2026-08-11T00:00:00.000Z", lastPulseSurveyId: null };
  assert.equal(PRODUCT_EVENTS.participationStartedAt({ acknowledgedAt: "2026-08-10T00:00:00.000Z" }), "2026-08-10T00:00:00.000Z", "legacy acknowledgement must migrate to participationStartedAt");
  const promptReference = new Date("2026-08-12T00:00:00.000Z");
  const promptDay = PRODUCT_EVENTS.sydneyDateKey(promptReference);
  const firstOpen = PRODUCT_EVENTS.nextWeeklyPulsePromptState(null, { surveyId: pulseSurveyId, dayKey: promptDay });
  const secondOpen = PRODUCT_EVENTS.nextWeeklyPulsePromptState(firstOpen, { surveyId: pulseSurveyId, dayKey: promptDay });
  const thirdOpen = PRODUCT_EVENTS.nextWeeklyPulsePromptState(secondOpen, { surveyId: pulseSurveyId, dayKey: promptDay });
  assert.equal(PRODUCT_EVENTS.shouldPromptWeeklyPulse({ pilot, promptState: firstOpen, surveyId: pulseSurveyId, reference: promptReference }), false);
  assert.equal(PRODUCT_EVENTS.shouldPromptWeeklyPulse({ pilot, promptState: secondOpen, surveyId: pulseSurveyId, reference: promptReference }), false);
  assert.equal(PRODUCT_EVENTS.shouldPromptWeeklyPulse({ pilot, promptState: thirdOpen, surveyId: pulseSurveyId, reference: promptReference }), true, "the third app open for the current survey must prompt");
  assert.equal(PRODUCT_EVENTS.shouldPromptWeeklyPulse({
    pilot: { ...pilot, lastPulseSurveyId: pulseSurveyId },
    promptState: thirdOpen,
    surveyId: pulseSurveyId,
    reference: promptReference,
  }), false, "a completed survey must stop reminders");
  assert.equal(PRODUCT_EVENTS.pilotSurveyActive(pilot, "2036-08-25T00:00:00.000Z"), true, "measurement must not expire on elapsed time");
  assert.equal(PRODUCT_EVENTS.pilotSurveyActive({ ...pilot, enabled: false }, promptReference), false, "an opt-out must stop measurement");
  const nextSurveyId = "weekly-pulse.v2";
  const resetForNextSurvey = PRODUCT_EVENTS.nextWeeklyPulsePromptState(thirdOpen, { surveyId: nextSurveyId, dayKey: promptDay });
  assert.equal(resetForNextSurvey.openCount, 1, "a newly released weekly pulse must reset the open counter");
  const resetForNextDay = PRODUCT_EVENTS.nextWeeklyPulsePromptState(thirdOpen, { surveyId: pulseSurveyId, dayKey: "2026-08-13" });
  assert.equal(resetForNextDay.openCount, 4, "the open counter must persist across Sydney days until this survey version is complete");

  const queuedBatches = [];
  const queue = PRODUCT_EVENTS.createQueue({
    delayMs: 60_000,
    async sendBatch(batch){ queuedBatches.push(batch); return { accepted: batch.length }; },
  });
  queue.enqueue(event());
  assert.equal(queue.size(), 1);
  await queue.flush();
  assert.equal(queuedBatches.length, 1);
  assert.equal(queuedBatches[0][0].clientEventId, "event-00000001");
  assert.equal(queue.size(), 0);

  let releaseFirstBatch;
  const overlappingBatches = [];
  const overlappingQueue = PRODUCT_EVENTS.createQueue({
    delayMs: 60_000,
    async sendBatch(batch){
      overlappingBatches.push(batch);
      if (overlappingBatches.length === 1){
        await new Promise(resolve => { releaseFirstBatch = resolve; });
      }
      return { accepted: batch.length };
    },
  });
  overlappingQueue.enqueue(event({ clientEventId: "event-overlap-0001" }));
  const firstFlush = overlappingQueue.flush();
  await Promise.resolve();
  overlappingQueue.enqueue(event({
    clientEventId: "weekly-pulse-0001",
    eventName: "weekly_pulse",
    surface: "weekly_pulse",
    properties: {
      surveyVersion: "weekly-pulse.v1",
      pilotCohort: "hybrid",
      crossCheck: "once",
      missedFixtures: "none",
      feedClutter: "about_right",
      trustConfidence: "high",
    },
  }));
  const pulseFlush = overlappingQueue.flush();
  releaseFirstBatch();
  await Promise.all([firstFlush, pulseFlush]);
  assert.equal(overlappingBatches.length, 2, "an explicit pulse flush must drain events queued during an in-flight batch");
  assert.equal(overlappingBatches[1][0].eventName, "weekly_pulse");
  assert.equal(overlappingQueue.size(), 0, "a successfully submitted pulse must not remain stranded in memory");

  const sql = fs.readFileSync("supabase/nothingsports-product-events.sql", "utf8");
  assert.match(sql, /create table if not exists public\.product_events/i);
  assert.match(sql, /unique \(user_id, client_event_id\)/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /grant insert on table public\.product_events to authenticated/i);
  assert.doesNotMatch(sql, /grant\s+(?:select|update|delete)[\s\S]+to authenticated/i);
  assert.match(sql, /for insert[\s\S]+to authenticated[\s\S]+with check \(\(select auth\.uid\(\)\) = user_id\)/i);
  assert.match(sql, /event_name in \([\s\S]+'weekly_pulse'/i);
  assert.match(sql, /create table if not exists[\s\S]+drop constraint[\s\S]+product_events_event_name_check/is, "rerunning the setup must replace stale generated event-name constraints");
  assert.match(sql, /product_events_surface_check[\s\S]+'weekly_pulse'/is, "rerunning the setup must replace stale generated surface constraints");
  const originalCreateEnd = sql.indexOf("\n);", sql.indexOf("create table if not exists public.product_events"));
  const eventConstraintUpgrade = sql.indexOf("add constraint product_events_event_name_check");
  const surfaceConstraintUpgrade = sql.indexOf("add constraint product_events_surface_check");
  assert(eventConstraintUpgrade > originalCreateEnd && surfaceConstraintUpgrade > originalCreateEnd, "existing tables must receive explicit post-create contract upgrades");
  assert.match(sql, /octet_length\(properties::text\) <= 512/i);
  assert.match(sql, /drop constraint if exists product_events_properties_contract_check/i, "the database property contract must be safely rerunnable");
  assert.match(sql, /properties - array\['action', 'recommendationClass', 'coldStart'\] = '\{\}'::jsonb/i, "direct Data API feed actions must reject unknown properties");
  const rlsVerification = fs.readFileSync("supabase/verify-product-events.sql", "utf8");
  assert.match(rlsVerification, /offset 1 limit 1/i, "RLS verification must use two different Auth users");
  assert.match(rlsVerification, /set local role authenticated/i);
  assert.match(rlsVerification, /RLS isolation failed/i);
  assert.match(rlsVerification, /'verify-weekly-pulse'[\s\S]+'weekly_pulse'[\s\S]+'weekly_pulse'/i, "the live database verification must exercise the weekly pulse event and surface");
  assert.match(rlsVerification, /"surveyVersion":"weekly-pulse\.v1"/i, "the live pulse verification must exercise explicit survey-version reporting");
  assert.match(rlsVerification, /'verify-discovery-open'[\s\S]+'feed_action'[\s\S]+"recommendationClass":"discovery"/i, "the live database verification must exercise an approved categorical discovery action");
  assert.match(rlsVerification, /'verify-free-text-rejected'[\s\S]+when check_violation then null/i, "the live database verification must prove arbitrary text cannot persist");
  assert.match(rlsVerification, /rollback;/i, "RLS verification must leave no test row behind");
  const hardeningSql = fs.readFileSync("supabase/harden-nothingsports-security.sql", "utf8");
  assert.match(hardeningSql, /to_regprocedure\('public\.rls_auto_enable\(\)'\)/i, "security hardening must be idempotent when the helper is absent");
  assert.match(hardeningSql, /revoke execute on function public\.rls_auto_enable\(\) from public/i);
  assert.match(hardeningSql, /revoke execute on function public\.rls_auto_enable\(\) from anon/i);
  assert.match(hardeningSql, /revoke execute on function public\.rls_auto_enable\(\) from authenticated/i);
  const tsdrSql = fs.readFileSync("supabase/nothingsports-tsdr.sql", "utf8");
  assert.match(tsdrSql, /bool_or\(event_name = 'opportunity_exposed'\)/i);
  assert.match(tsdrSql, /bool_or\(event_name in \('fixture_check', 'watch_decision'\)\)/i);
  assert.match(tsdrSql, /count\(\*\) filter \(where had_opportunity\) as denominator_users/i);
  assert.match(tsdrSql, /count\(\*\) filter \(where had_opportunity and made_decision\) as numerator_users/i);
  assert.match(tsdrSql, /properties ->> 'pilotCohort' as pilot_cohort/i);
  assert.match(tsdrSql, /properties ->> 'trustConfidence' as trust_confidence/i);
  const pilotReadoutSql = fs.readFileSync("supabase/nothingsports-pilot-readout.sql", "utf8");
  assert.doesNotMatch(pilotReadoutSql, /interval '14 days'/i);
  assert.match(pilotReadoutSql, /properties ->> 'surveyVersion'/i);
  assert.match(pilotReadoutSql, /\('all'\), \('curator'\), \('hybrid'\), \('completist'\), \('unclassified'\)/i);
  assert.match(pilotReadoutSql, /full_fixture_adoption_percent/i);
  assert.match(pilotReadoutSql, /multiple_cross_check_percent/i);
  assert.match(pilotReadoutSql, /meaningful_action_rate_percent/i);
  assert.match(pilotReadoutSql, /prompt_dismissal_percent/i);
  assert.match(pilotReadoutSql, /spectacle_rating_completion_percent/i);

  const html = fs.readFileSync("index.html", "utf8");
  assert(html.includes('src="config/product-events.js"'));
  assert(!html.includes('settingsMenuItem("pilot"') && html.includes('settingsSection === "appearance"') && html.includes('pilot.textContent = "Trust pilot details"'), "Trust pilot controls must sit inside Appearance rather than as a top-level Settings item");
  assert(html.includes('id="pilotMeasurementEnabled"'));
  assert(html.includes('enabled: true') && html.includes('id="pilotPulsePromptModal"'), "pilot measurement must default on and expose a dedicated reminder");
  assert(html.includes('participationVersion: "pilot-participation.v1"'), "signed-in measurement must use the explicit automatic-participation state");
  assert(html.includes("participationStartedAt") && PRODUCT_EVENTS.participationStartedAt({ acknowledgedAt: "2026-08-10T00:00:00.000Z" }), "legacy acknowledgements must migrate to participationStartedAt");
  assert(html.includes('Fill out this 2-minute survey'));
  assert(html.includes('registerWeeklyPulseAppOpen()'), "app startup must advance the versioned survey counter");
  assert(html.includes("No free text, messages, credentials, precise location, contact information or client-supplied user IDs"));
  assert(html.includes('eventName: "opportunity_exposed"'));
  assert(html.includes('eventName: "fixture_check"'));
  assert(html.includes('eventName: "watch_decision"'), "genuine reminder and watched actions must emit watch decisions");
  assert(html.includes('if (enabled) recordWatchDecision(ev, "remind", { surface:"event_card" })'), "adding an in-place background reminder must record a watch decision while removing it must not fabricate one");
  assert(html.includes('recordEventFeedAction(ev, "open", options)'), "card expansion must emit a separate categorical open action");
  assert(html.includes('eventName: "preference_change"') && html.includes('eventName: "feed_control_change"'), "approved preference and feed-control actions must be instrumented");
  assert(html.includes('eventName: "weekly_pulse"'));
  assert(html.includes('clientEventId: `weekly_pulse_${currentSurveyId.replace(/[^A-Za-z0-9:_-]/g, "_")}`'), "weekly pulse retries must deduplicate per pilot user and survey release");
  assert(html.includes('if (!result?.sent) throw new Error("The weekly pulse was not confirmed.")'), "the pulse UI must wait for a confirmed queue drain before marking the week complete");
  assert(html.includes('name="pilotCohort"') && html.includes('value="curator"') && html.includes('value="hybrid"') && html.includes('value="completist"'));
  assert(html.includes('name="trustConfidence"') && html.includes('value="high"'));
  assert(html.includes('properties: { action: "shown" }'), "rating prompt exposure must be measurable");
  assert(html.includes('properties: { action: "dismissed" }'), "rating prompt dismissal must be measurable");
  assert(html.includes('properties: { action: "rated", score: i }'), "rating completion must remain separate from prompt exposure");
  assert(html.includes("if (!pilotMeasurementEligible()) return null"), "telemetry must be inert without sign-in or after opt-out");
  assert(html.includes("The normal app works without measurement"));

  const originalUrl = process.env.SUPABASE_URL;
  const originalPublishable = process.env.SUPABASE_PUBLISHABLE_KEY;
  const originalAnon = process.env.SUPABASE_ANON_KEY;
  const originalFetch = global.fetch;
  process.env.SUPABASE_URL = "https://project-ref.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
  delete process.env.SUPABASE_ANON_KEY;
  const requests = [];
  global.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url).endsWith("/auth/v1/user")){
      return fetchResponse({ id: "11111111-1111-4111-8111-111111111111", email: "pilot@example.com" });
    }
    if (String(url).includes("/rest/v1/product_events")) return fetchResponse(null, 201);
    return fetchResponse({ message: "Unexpected request" }, 500);
  };

  try{
    const response = responseStub();
    await productEventsHandler({
      method: "POST",
      headers: { authorization: "Bearer access-token" },
      body: { schemaVersion: PRODUCT_EVENTS.SCHEMA_VERSION, events: [event()] },
    }, response);
    assert.equal(response.statusCode, 202);
    assert.equal(response.body.accepted, 1);
    assert.equal(response.body.deduplicated, true);
    assert.equal(response.headers["Cache-Control"], "private, no-store, max-age=0");
    assert.equal(response.headers.Vary, "Authorization");
    const insert = requests.find(request => request.url.includes("/rest/v1/product_events"));
    assert(insert);
    assert.doesNotMatch(insert.url, /on_conflict=/, "append-only writes must not require SELECT privilege through an ON CONFLICT target");
    assert.equal(insert.options.headers.Authorization, "Bearer access-token");
    assert.equal(insert.options.headers.Prefer, "return=minimal");
    const insertedRows = JSON.parse(insert.options.body);
    assert.equal(insertedRows.length, 1);
    assert.equal(insertedRows[0].user_id, "11111111-1111-4111-8111-111111111111", "server must derive ownership from Auth");
    assert.equal(insertedRows[0].properties.presentation, "card");

    const duplicateRequests = [];
    let productEventWriteCount = 0;
    global.fetch = async (url, options = {}) => {
      duplicateRequests.push({ url: String(url), options });
      if (String(url).endsWith("/auth/v1/user")){
        return fetchResponse({ id: "11111111-1111-4111-8111-111111111111", email: "pilot@example.com" });
      }
      if (String(url).includes("/rest/v1/product_events")){
        productEventWriteCount += 1;
        if (productEventWriteCount === 1){
          return fetchResponse({ code: "23505", message: "duplicate key value violates unique constraint" }, 409);
        }
        const submittedRows = JSON.parse(options.body);
        if (submittedRows[0].client_event_id === "event-duplicate"){
          return fetchResponse({ code: "23505", message: "duplicate key value violates unique constraint" }, 409);
        }
        return fetchResponse(null, 201);
      }
      return fetchResponse({ message: "Unexpected request" }, 500);
    };
    const duplicateResponse = responseStub();
    await productEventsHandler({
      method: "POST",
      headers: { authorization: "Bearer access-token" },
      body: {
        schemaVersion: PRODUCT_EVENTS.SCHEMA_VERSION,
        events: [
          event({ clientEventId: "event-duplicate" }),
          event({ clientEventId: "event-new-entry" }),
        ],
      },
    }, duplicateResponse);
    assert.equal(duplicateResponse.statusCode, 202, "a duplicate pulse retry must not prevent new queued events from being appended");
    assert.equal(duplicateResponse.body.accepted, 2);
    assert.equal(duplicateRequests.filter(request => request.url.includes("/rest/v1/product_events")).length, 3);

    const forgedResponse = responseStub();
    await productEventsHandler({
      method: "POST",
      headers: { authorization: "Bearer access-token" },
      body: {
        schemaVersion: PRODUCT_EVENTS.SCHEMA_VERSION,
        events: [event({ user_id: "22222222-2222-4222-8222-222222222222" })],
      },
    }, forgedResponse);
    assert.equal(forgedResponse.statusCode, 400);
    assert.equal(forgedResponse.body.code, "unsupported_field");

    const unauthenticatedResponse = responseStub();
    await productEventsHandler({
      method: "POST",
      headers: {},
      body: { schemaVersion: PRODUCT_EVENTS.SCHEMA_VERSION, events: [event()] },
    }, unauthenticatedResponse);
    assert.equal(unauthenticatedResponse.statusCode, 401);

    const methodResponse = responseStub();
    await productEventsHandler({ method: "GET", headers: {} }, methodResponse);
    assert.equal(methodResponse.statusCode, 405);
    assert.equal(methodResponse.headers.Allow, "POST");
  }finally{
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalPublishable === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = originalPublishable;
    if (originalAnon === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = originalAnon;
    global.fetch = originalFetch;
  }

  const browserRequests = [];
  const client = SERVER_SYNC.createClient({
    storage: memoryStorage(),
    now: () => Date.parse("2026-08-11T01:00:00.000Z"),
    fetchImpl: async (url, options = {}) => {
      browserRequests.push({ url, options });
      if (url === "/api/auth"){
        return browserResponse({
          session: {
            access_token: "access",
            refresh_token: "refresh",
            expires_in: 3600,
          },
        });
      }
      return browserResponse({ accepted: 1, schemaVersion: PRODUCT_EVENTS.SCHEMA_VERSION }, 202);
    },
  });
  await client.signIn("pilot@example.com", "correct horse battery staple");
  await client.sendProductEvents([event()]);
  const browserInsert = browserRequests.find(request => request.url === "/api/product-events");
  assert(browserInsert);
  assert.equal(browserInsert.options.headers.Authorization, "Bearer access");
  assert.deepEqual(JSON.parse(browserInsert.options.body), {
    schemaVersion: PRODUCT_EVENTS.SCHEMA_VERSION,
    events: [event()],
  });

  const unconfirmedClient = SERVER_SYNC.createClient({
    storage: memoryStorage(),
    persistentStorage: memoryStorage(),
    now: () => Date.parse("2026-08-11T01:00:00.000Z"),
    fetchImpl: async (url) => url === "/api/auth"
      ? browserResponse({ session: { access_token: "access", refresh_token: "refresh", expires_in: 3600 } })
      : browserResponse({ accepted: 0, schemaVersion: PRODUCT_EVENTS.SCHEMA_VERSION }, 202),
  });
  await unconfirmedClient.signIn("pilot@example.com", "correct horse battery staple");
  await assert.rejects(
    () => unconfirmedClient.sendProductEvents([event()]),
    error => error?.code === "product_events_not_confirmed",
    "the client must reject a 202 response that does not confirm the whole batch"
  );

  console.log("Product event contract, API ownership, automatic participation, opt-out, RLS SQL and TSDR query validated.");
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
