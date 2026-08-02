#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const server = require("../lib/supabase-server");
const serverSync = require("../config/server-sync");
const authHandler = require("../api/auth");
const userStateHandler = require("../api/user-state");

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

async function run(){
  const userStateSchema = JSON.parse(fs.readFileSync("schemas/user-state.schema.json", "utf8"));
  assert.equal(userStateSchema.properties.schemaVersion.const, "user-state.v1");
  assert(userStateSchema.required.includes("preferences"));
  assert(userStateSchema.required.includes("eventUserState"));
  assert.equal(server.supabaseConfig({}).configured, false);
  assert.equal(server.supabaseConfig({
    SUPABASE_URL: "https://project-ref.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  }).configured, true);
  assert.equal(server.supabaseConfig({
    SUPABASE_URL: "javascript:alert(1)",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  }).configured, false, "invalid project URLs must not be accepted");

  const normalized = server.normalizeUserState({
    profile: { timezone: "Australia/Sydney" },
    preferences: { showSpoilers: false },
    eventUserState: { event: { watchLater: true, watched: true } },
    archivedEvents: [],
  }, "11111111-1111-4111-8111-111111111111", new Date("2026-07-27T10:00:00.000Z"));
  assert.equal(normalized.schema_version, "user-state.v1");
  assert.equal(normalized.user_id, "11111111-1111-4111-8111-111111111111");
  assert.equal(normalized.event_user_state.event.watchLater, true, "saved cards must be part of durable server state");
  assert.equal(normalized.event_user_state.event.watched, true, "Catch Up watched state must be part of durable server state");
  const mergedState = server.mergeUserState({
    profile: { timezone: "Australia/Sydney", futureProfileField: "keep" },
    preferences: {
      theme: "night",
      viewing: { viewingWindowEnabled: true, startHourLocal: 7 },
    },
    event_user_state: { old: { watched: true } },
  }, {
    preferences: {
      showSpoilers: false,
      viewing: { startHourLocal: 8 },
    },
  });
  assert.equal(mergedState.profile.futureProfileField, "keep", "an omitted profile field must survive a partial server commit");
  assert.equal(mergedState.preferences.theme, "night", "an omitted setting must survive a partial server commit");
  assert.equal(mergedState.preferences.viewing.viewingWindowEnabled, true, "nested settings must merge without resetting sibling values");
  assert.equal(mergedState.preferences.viewing.startHourLocal, 8, "the newly committed nested setting must win");
  assert.equal(mergedState.preferences.showSpoilers, false, "explicit false settings must be retained");
  assert.equal(mergedState.eventUserState.old.watched, true, "omitted non-preference state must remain intact");

  const sql = fs.readFileSync("supabase/nothingsports-user-state.sql", "utf8");
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /to authenticated[\s\S]+auth\.uid\(\)/i);
  assert.match(sql, /revoke all[\s\S]+from anon/i);
  assert.doesNotMatch(
    fs.readFileSync("api/auth.js", "utf8")
      + fs.readFileSync("api/user-state.js", "utf8")
      + fs.readFileSync("config/server-sync.js", "utf8")
      + fs.readFileSync(".env.example", "utf8"),
    /service[_-]?role/i,
    "the client and request path must never depend on a service-role key"
  );

  const originalUrl = process.env.SUPABASE_URL;
  const originalPublishable = process.env.SUPABASE_PUBLISHABLE_KEY;
  const originalAnon = process.env.SUPABASE_ANON_KEY;
  const originalFetch = global.fetch;
  process.env.SUPABASE_URL = "https://project-ref.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
  delete process.env.SUPABASE_ANON_KEY;

  const requests = [];
  const authUser = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "fan@example.com",
    created_at: "2026-07-27T00:00:00.000Z",
  };
  const databaseRow = {
    ...normalized,
    profile: { timezone: "Australia/Sydney", futureProfileField: "keep" },
    preferences: {
      showSpoilers: false,
      theme: "night",
      viewing: { viewingWindowEnabled: true, startHourLocal: 7 },
    },
    updated_at: "2026-07-27T10:00:00.000Z",
  };
  global.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url).includes("/auth/v1/otp")) return fetchResponse({});
    if (String(url).endsWith("/auth/v1/user")) return fetchResponse(authUser);
    if (String(url).includes("/rest/v1/nothingsports_user_state") && options.method === "POST"){
      return fetchResponse([{ ...JSON.parse(options.body), updated_at: "2026-07-27T10:01:00.000Z" }]);
    }
    if (String(url).includes("/rest/v1/nothingsports_user_state")) return fetchResponse([databaseRow]);
    return fetchResponse({ message: "Unexpected test request" }, 500);
  };

  try{
    const statusResponse = responseStub();
    await authHandler({ method: "GET", headers: {} }, statusResponse);
    assert.equal(statusResponse.statusCode, 200);
    assert.deepEqual(statusResponse.body, { configured: true, provider: "supabase" });
    assert.equal(statusResponse.headers["Cache-Control"], "private, no-store, max-age=0");

    const magicLinkResponse = responseStub();
    await authHandler({
      method: "POST",
      headers: {
        origin: "https://malicious.example",
        host: "nothingsport.vercel.app",
        "x-forwarded-proto": "https",
      },
      body: {
        action: "magic-link",
        email: "fan@example.com",
        redirectTo: "https://malicious.example/steal",
      },
    }, magicLinkResponse);
    assert.equal(magicLinkResponse.statusCode, 200);
    const otpRequest = requests.find(request => request.url.includes("/auth/v1/otp"));
    assert(otpRequest, "magic-link requests must use the Supabase OTP endpoint");
    assert.match(
      otpRequest.url,
      /redirect_to=https%3A%2F%2Fnothingsport\.vercel\.app%2F/,
      "magic-link redirects must remain on the deployed host rather than trusting the Origin header"
    );

    const loadedResponse = responseStub();
    await userStateHandler({
      method: "GET",
      headers: { authorization: "Bearer access-token" },
    }, loadedResponse);
    assert.equal(loadedResponse.statusCode, 200);
    assert.equal(loadedResponse.body.user.email, "fan@example.com");
    assert.equal(loadedResponse.body.state.preferences.showSpoilers, false);
    const userLookup = requests.find(request => request.url.endsWith("/auth/v1/user"));
    assert.equal(userLookup.options.headers.Authorization, "Bearer access-token", "the Auth API must verify the signed-in user token");
    const stateLookup = requests.find(request => request.url.includes("/rest/v1/nothingsports_user_state"));
    assert.equal(stateLookup.options.headers.Authorization, "Bearer access-token", "RLS requests must run as the signed-in user");

    const postCountBeforeNoop = requests.filter(request => (
      request.url.includes("/rest/v1/nothingsports_user_state")
      && request.options.method === "POST"
    )).length;
    const noopResponse = responseStub();
    await userStateHandler({
      method: "PUT",
      headers: { authorization: "Bearer access-token" },
      body: { state: server.userStateFromRow(databaseRow) },
    }, noopResponse);
    assert.equal(noopResponse.statusCode, 200);
    assert.equal(noopResponse.body.state.updated_at, databaseRow.updated_at, "an identical server commit must retain its existing write timestamp");
    assert.equal(requests.filter(request => (
      request.url.includes("/rest/v1/nothingsports_user_state")
      && request.options.method === "POST"
    )).length, postCountBeforeNoop, "an identical server commit must skip the database upsert");

    const savedResponse = responseStub();
    await userStateHandler({
      method: "PUT",
      headers: { authorization: "Bearer access-token" },
      body: {
        state: {
          profile: { timezone: "Australia/Sydney" },
          preferences: { showSpoilers: true, viewing: { startHourLocal: 8 } },
          eventUserState: { event: { watchLater: true, watched: false } },
          eventSpoilerState: {},
          archivedEvents: [],
          ratings: {},
        },
      },
    }, savedResponse);
    assert.equal(savedResponse.statusCode, 200);
    const upsertRequest = requests.find(request => (
      request.url.includes("/rest/v1/nothingsports_user_state")
      && request.options.method === "POST"
    ));
    assert.match(upsertRequest.options.headers.Prefer, /resolution=merge-duplicates/);
    const upsertedState = JSON.parse(upsertRequest.options.body);
    assert.equal(upsertedState.user_id, authUser.id, "the verified magic-link user id must own the row");
    assert.equal(upsertedState.profile.futureProfileField, "keep", "server upserts must preserve earlier profile fields");
    assert.equal(upsertedState.preferences.theme, "night", "server upserts must preserve earlier settings omitted by the client");
    assert.equal(upsertedState.preferences.viewing.viewingWindowEnabled, true, "server upserts must preserve nested sibling settings");
    assert.equal(upsertedState.preferences.viewing.startHourLocal, 8, "server upserts must apply the incoming nested setting");
  }finally{
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalPublishable === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = originalPublishable;
    if (originalAnon === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = originalAnon;
    global.fetch = originalFetch;
  }

  const callbackSession = serverSync.sessionFromHash(
    "#access_token=access&refresh_token=refresh&expires_in=3600",
    Date.parse("2026-07-27T10:00:00.000Z")
  );
  assert.equal(callbackSession.accessToken, "access");
  assert.equal(callbackSession.expiresAt, Date.parse("2026-07-27T11:00:00.000Z"));

  const storage = memoryStorage();
  let replacedUrl = "";
  const browserRequests = [];
  const client = serverSync.createClient({
    storage,
    now: () => Date.parse("2026-07-27T10:00:00.000Z"),
    locationLike: {
      origin: "https://nothingsport.vercel.app",
      pathname: "/",
      search: "?from=email",
      hash: "#access_token=access&refresh_token=refresh&expires_in=3600",
    },
    historyLike: {
      replaceState(_state, _title, url){ replacedUrl = url; },
    },
    fetchImpl: async (url, options = {}) => {
      browserRequests.push({ url, options });
      if (url === "/api/auth" && options.headers?.Authorization){
        return browserResponse({ user: { id: authUser.id, email: authUser.email } });
      }
      if (url === "/api/user-state"){
        return browserResponse({ user: authUser, state: databaseRow });
      }
      if (url === "/api/feed"){
        return browserResponse({
          schemaVersion: "server-feed.v1",
          generatedAt: "2026-07-27T10:00:00.000Z",
          sourceVersion: "test",
          events: [],
          derivedCardCache: {
            schemaVersion: "derived-card-cache.v1",
            generatedAt: "2026-07-27T10:00:00.000Z",
            buildOrigin: "server",
            derivedCards: [],
          },
          retention: {},
        });
      }
      return browserResponse({ configured: true, provider: "supabase" });
    },
  });
  await client.restoreSession();
  assert.equal(replacedUrl, "/?from=email", "magic-link credentials must be removed from the URL after capture");
  assert.equal((await client.user()).id, authUser.id);
  assert.equal((await client.loadState()).state.eventUserState.event.watchLater, true);
  assert.equal((await client.loadFeed()).derivedCardCache.buildOrigin, "server");
  assert(browserRequests.some(request => request.options.headers?.Authorization === "Bearer access"));

  const snapshot = serverSync.buildUserState({
    preferences: { showSpoilers: false },
    eventUserState: { event: { watchLater: true } },
  });
  assert.equal(snapshot.schemaVersion, "user-state.v1");
  assert.equal(snapshot.eventUserState.event.watchLater, true);
  const browserMergedSettings = serverSync.mergeSettings({
    theme: "night",
    viewing: { viewingWindowEnabled: false, startHourLocal: 7 },
  }, {
    viewing: { startHourLocal: 9 },
    selectedBroadcasters: [],
  });
  assert.equal(browserMergedSettings.theme, "night", "browser hydration must preserve local settings omitted by the server");
  assert.equal(browserMergedSettings.viewing.viewingWindowEnabled, false, "browser hydration must preserve nested local settings omitted by the server");
  assert.equal(browserMergedSettings.viewing.startHourLocal, 9, "browser hydration must prefer the incoming server value");
  assert.deepEqual(browserMergedSettings.selectedBroadcasters, [], "explicit empty selections must remain explicit");

  console.log("Server persistence valid: magic-link auth, RLS ownership, saved-state upsert and browser session handling passed.");
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
