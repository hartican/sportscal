#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const server = require("../lib/supabase-server");
const serverSync = require("../config/server-sync");
const userStateSync = require("../config/user-state-sync");
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
  assert.equal(userStateSchema.properties.schemaVersion.const, "user-state.v2");
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
    preferences: {
      showSpoilers: false,
      preferenceGraph: { domainPreferences:[{ sportDomainId:"sport:football", mustWatchSensitivity:"high", editorialSensitivity:"medium" }] },
    },
    eventUserState: { event: { watchLater: true, watched: true, mustWatch:true } },
    archivedEvents: [],
  }, "11111111-1111-4111-8111-111111111111", new Date("2026-07-27T10:00:00.000Z"));
  assert.equal(normalized.schema_version, "user-state.v2");
  assert.equal(normalized.user_id, "11111111-1111-4111-8111-111111111111");
  assert.equal(normalized.event_user_state.event.watchLater, true, "saved cards must be part of durable server state");
  assert.equal(normalized.event_user_state.event.watched, true, "Catch Up watched state must be part of durable server state");
  assert.equal(Object.hasOwn(normalized.event_user_state.event, "mustWatch"), false, "legacy server Must Watch actions must be discarded");
  assert.equal(Object.hasOwn(normalized.preferences.preferenceGraph.domainPreferences[0], "mustWatchSensitivity"), false, "legacy server Must Watch preferences must be discarded");
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
  let forceConditionalConflict = false;
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
  const passwordSession = {
    access_token: "access",
    refresh_token: "refresh",
    expires_in: 3600,
    user: authUser,
  };
  global.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url).includes("/auth/v1/token?grant_type=password")) return fetchResponse(passwordSession);
    if (String(url).includes("/auth/v1/recover?redirect_to=")) return fetchResponse({});
    if (String(url).endsWith("/auth/v1/user") && options.method === "PUT") return fetchResponse(authUser);
    if (String(url).endsWith("/auth/v1/user")) return fetchResponse(authUser);
    if (String(url).includes("/rest/v1/nothingsports_user_state") && options.method === "PATCH"){
      if (forceConditionalConflict){
        forceConditionalConflict = false;
        return fetchResponse([]);
      }
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

    const passwordResponse = responseStub();
    await authHandler({
      method: "POST",
      body: {
        action: "password-sign-in",
        email: "fan@example.com",
        password: "correct horse battery staple",
      },
    }, passwordResponse);
    assert.equal(passwordResponse.statusCode, 200);
    assert.equal(passwordResponse.body.session.access_token, "access");
    const passwordRequest = requests.find(request => request.url.includes("/auth/v1/token?grant_type=password"));
    assert(passwordRequest, "password sign-in must use the Supabase password grant");
    assert.deepEqual(JSON.parse(passwordRequest.options.body), {
      email: "fan@example.com",
      password: "correct horse battery staple",
    });
    assert.equal(passwordRequest.options.headers.apikey, "sb_publishable_test");

    const missingPasswordResponse = responseStub();
    await authHandler({
      method: "POST",
      body: { action: "password-sign-in", email: "fan@example.com", password: "" },
    }, missingPasswordResponse);
    assert.equal(missingPasswordResponse.statusCode, 400);
    assert.equal(missingPasswordResponse.body.code, "invalid_password");

    const recoveryResponses = [];
    for (const email of ["known@example.com", "unknown@example.com"]){
      const recoveryResponse = responseStub();
      await authHandler({
        method:"POST",
        headers:{ host:"localhost:3000" },
        body:{ action:"password-recovery-request", email },
      }, recoveryResponse);
      recoveryResponses.push(recoveryResponse);
    }
    assert.equal(recoveryResponses[0].statusCode, 200);
    assert.deepEqual(recoveryResponses[0].body, recoveryResponses[1].body, "recovery requests must not reveal whether an account exists");
    const recoveryRequest = requests.find(request => request.url.includes("/auth/v1/recover?redirect_to="));
    assert.match(decodeURIComponent(recoveryRequest.url), /redirect_to=http:\/\/localhost:3000\/\?auth=recovery$/, "local recovery must use an allowlisted callback");

    const updatePasswordResponse = responseStub();
    await authHandler({
      method:"POST",
      headers:{ authorization:"Bearer recovery-access" },
      body:{ action:"password-update", password:"new secure password" },
    }, updatePasswordResponse);
    assert.equal(updatePasswordResponse.statusCode, 200);
    const updatePasswordRequest = requests.find(request => request.url.endsWith("/auth/v1/user") && request.options.method === "PUT");
    assert.equal(updatePasswordRequest.options.headers.Authorization, "Bearer recovery-access");
    assert.deepEqual(JSON.parse(updatePasswordRequest.options.body), { password:"new secure password" });
    const shortPasswordResponse = responseStub();
    await authHandler({ method:"POST", headers:{ authorization:"Bearer recovery-access" }, body:{ action:"password-update", password:"short" } }, shortPasswordResponse);
    assert.equal(shortPasswordResponse.body.code, "invalid_password");

    const loadedResponse = responseStub();
    await userStateHandler({
      method: "GET",
      headers: { authorization: "Bearer access-token" },
    }, loadedResponse);
    assert.equal(loadedResponse.statusCode, 200);
    assert.equal(loadedResponse.body.user.email, "fan@example.com");
    assert.equal(loadedResponse.body.state.preferences.showSpoilers, false);
    const userLookup = requests.find(request => request.url.endsWith("/auth/v1/user") && request.options.method !== "PUT");
    assert.equal(userLookup.options.headers.Authorization, "Bearer access-token", "the Auth API must verify the signed-in user token");
    const stateLookup = requests.find(request => request.url.includes("/rest/v1/nothingsports_user_state"));
    assert.equal(stateLookup.options.headers.Authorization, "Bearer access-token", "RLS requests must run as the signed-in user");

    const legacyResponse = responseStub();
    await userStateHandler({
      method: "PUT",
      headers: { authorization: "Bearer access-token" },
      body: { state: server.userStateFromRow(databaseRow) },
    }, legacyResponse);
    assert.equal(legacyResponse.statusCode, 409, "obsolete full snapshots must not overwrite newer device settings");
    assert.equal(legacyResponse.body.code, "client_update_required");

    const patchCountBeforeNoop = requests.filter(request => (
      request.url.includes("/rest/v1/nothingsports_user_state")
      && request.options.method === "PATCH"
    )).length;
    const noopResponse = responseStub();
    await userStateHandler({
      method: "PUT",
      headers: { authorization: "Bearer access-token" },
      body: {
        patch: userStateSync.createPatch(
          server.userStateFromRow(databaseRow),
          server.userStateFromRow(databaseRow),
          { baseUpdatedAt: databaseRow.updated_at }
        ),
      },
    }, noopResponse);
    assert.equal(noopResponse.statusCode, 200);
    assert.equal(noopResponse.body.state.updated_at, databaseRow.updated_at, "an identical server commit must retain its existing write timestamp");
    assert.equal(requests.filter(request => (
      request.url.includes("/rest/v1/nothingsports_user_state")
      && request.options.method === "PATCH"
    )).length, patchCountBeforeNoop, "an identical server commit must skip the database update");

    const savedResponse = responseStub();
    const changedState = {
      ...server.userStateFromRow(databaseRow),
      preferences: {
        ...server.userStateFromRow(databaseRow).preferences,
        showSpoilers: true,
        viewing: { viewingWindowEnabled: true, startHourLocal: 8 },
      },
      eventUserState: { event: { watchLater: true, watched: false } },
    };
    await userStateHandler({
      method: "PUT",
      headers: { authorization: "Bearer access-token" },
      body: {
        patch: userStateSync.createPatch(
          server.userStateFromRow(databaseRow),
          changedState,
          { baseUpdatedAt: databaseRow.updated_at }
        ),
      },
    }, savedResponse);
    assert.equal(savedResponse.statusCode, 200);
    const updateRequest = requests.find(request => (
      request.url.includes("/rest/v1/nothingsports_user_state")
      && request.options.method === "PATCH"
    ));
    assert.match(updateRequest.url, /updated_at=eq\.2026-07-27T10%3A00%3A00\.000Z/);
    assert.match(updateRequest.options.headers.Prefer, /return=representation/);
    const updatedState = JSON.parse(updateRequest.options.body);
    assert.equal(updatedState.user_id, authUser.id, "the verified password user id must own the row");
    assert.equal(updatedState.profile.futureProfileField, "keep", "server patches must preserve earlier profile fields");
    assert.equal(updatedState.preferences.theme, "night", "server patches must preserve settings untouched by this device");
    assert.equal(updatedState.preferences.viewing.viewingWindowEnabled, true, "server patches must preserve nested sibling settings");
    assert.equal(updatedState.preferences.viewing.startHourLocal, 8, "server patches must apply the newly changed nested setting");

    forceConditionalConflict = true;
    const conflictResponse = responseStub();
    await userStateHandler({
      method: "PUT",
      headers: { authorization: "Bearer access-token" },
      body: {
        patch: userStateSync.createPatch(
          server.userStateFromRow(databaseRow),
          changedState,
          { baseUpdatedAt: databaseRow.updated_at }
        ),
      },
    }, conflictResponse);
    assert.equal(conflictResponse.statusCode, 409, "a concurrent device write must make the stale conditional update retryable");
    assert.equal(conflictResponse.body.code, "user_state_conflict");
  }finally{
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalPublishable === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = originalPublishable;
    if (originalAnon === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = originalAnon;
    global.fetch = originalFetch;
  }

  const parsedPasswordSession = serverSync.parseSession(
    passwordSession,
    Date.parse("2026-07-27T10:00:00.000Z")
  );
  assert.equal(parsedPasswordSession.accessToken, "access");
  assert.equal(parsedPasswordSession.expiresAt, Date.parse("2026-07-27T11:00:00.000Z"));

  const recoveryStorage = memoryStorage();
  let scrubbedRecoveryUrl = null;
  const capturedRecovery = serverSync.captureRecoveryFromLocation({
    location:{ pathname:"/", search:"?auth=recovery&keep=1", hash:"#access_token=recovery-secret&type=recovery&expires_in=600" },
    history:{ replaceState(_state, _title, url){ scrubbedRecoveryUrl = url; } },
    storage:recoveryStorage,
    now:Date.parse("2026-07-27T10:00:00.000Z"),
  });
  assert.equal(capturedRecovery.accessToken, "recovery-secret");
  assert.equal(scrubbedRecoveryUrl, "/?keep=1", "recovery tokens and routing markers must be scrubbed immediately");
  assert(recoveryStorage.getItem(serverSync.RECOVERY_STORAGE_KEY)?.includes("recovery-secret"), "the isolated recovery namespace must retain the short-lived token");
  assert.equal(recoveryStorage.getItem(serverSync.SESSION_STORAGE_KEY), null, "a recovery token must never enter normal session persistence");
  assert.equal(serverSync.readRecoverySession(recoveryStorage, Date.parse("2026-07-27T10:11:00.000Z")), null, "expired recovery sessions must be discarded");
  assert.equal(serverSync.captureRecoveryFromLocation({
    location:{ pathname:"/", search:"?auth=recovery", hash:"#type=recovery" },
    history:{ replaceState(){} }, storage:memoryStorage(), now:0,
  }).invalid, true, "an invalid recovery link must enter the resend flow");

  const storage = memoryStorage();
  const persistentStorage = memoryStorage();
  const browserRequests = [];
  const client = serverSync.createClient({
    storage,
    persistentStorage,
    now: () => Date.parse("2026-07-27T10:00:00.000Z"),
    fetchImpl: async (url, options = {}) => {
      browserRequests.push({ url, options });
      if (url === "/api/auth" && options.method === "POST" && !options.headers?.Authorization){
        return browserResponse({ session: passwordSession });
      }
      if (url === "/api/auth" && options.headers?.Authorization){
        return browserResponse({ user: { id: authUser.id, email: authUser.email } });
      }
      if (url === "/api/user-state"){
        return browserResponse({ user: authUser, state: databaseRow });
      }
      if (String(url).startsWith("/api/feed?")){
        return browserResponse({
          schemaVersion: "server-feed.v2",
          generatedAt: "2026-07-27T10:00:00.000Z",
          sourceVersion: "test",
          events: [],
          derivedCardCache: {
            schemaVersion: "derived-card-cache.v1",
            generatedAt: "2026-07-27T10:00:00.000Z",
            buildOrigin: "server",
            derivedCards: [],
          },
          pagination: { cursor: 0, limit: 20, nextCursor: null, total: 0 },
          retention: {},
        });
      }
      return browserResponse({ configured: true, provider: "supabase" });
    },
  });
  await client.signIn("fan@example.com", "correct horse battery staple", { persist: true });
  await client.restoreSession();
  const browserPasswordRequest = browserRequests.find(request => {
    const body = JSON.parse(request.options.body || "{}");
    return body.action === "password-sign-in";
  });
  assert(browserPasswordRequest, "the browser client must request password sign-in");
  assert.equal(JSON.parse(browserPasswordRequest.options.body).password, "correct horse battery staple");
  assert.equal(client.getSession().accessToken, "access");
  assert.equal(storage.getItem(serverSync.SESSION_STORAGE_KEY), null, "persistent sign-in must not duplicate the refresh token in session storage");
  assert(persistentStorage.getItem(serverSync.PERSISTENT_SESSION_STORAGE_KEY), "persistent sign-in must survive a browser restart without saving the password");
  assert(!persistentStorage.getItem(serverSync.PERSISTENT_SESSION_STORAGE_KEY).includes("correct horse battery staple"), "the user's password must never be stored with the persistent session");
  await client.requestPasswordRecovery("fan@example.com");
  await client.updateRecoveryPassword("isolated-recovery-token", "another secure password");
  const browserRecoveryRequest = browserRequests.find(request => JSON.parse(request.options.body || "{}").action === "password-recovery-request");
  const browserPasswordUpdate = browserRequests.find(request => JSON.parse(request.options.body || "{}").action === "password-update");
  assert(browserRecoveryRequest, "the browser must expose the non-enumerating recovery request");
  assert.equal(browserPasswordUpdate.options.headers.Authorization, "Bearer isolated-recovery-token");
  assert(!storage.getItem(serverSync.SESSION_STORAGE_KEY)?.includes("isolated-recovery-token"), "the recovery bearer must remain outside normal session storage");

  const restartedClient = serverSync.createClient({
    storage: memoryStorage(),
    persistentStorage,
    now: () => Date.parse("2026-07-27T10:00:00.000Z"),
    fetchImpl: async () => browserResponse({ message: "A fresh unexpired session should restore without a network call." }, 500),
  });
  assert.equal((await restartedClient.restoreSession()).accessToken, "access", "a new app process must restore the persistent device session");

  const rotatingStorage = memoryStorage();
  rotatingStorage.setItem(serverSync.PERSISTENT_SESSION_STORAGE_KEY, JSON.stringify({
    accessToken: "expired-access",
    refreshToken: "old-refresh",
    expiresAt: Date.parse("2026-07-27T09:00:00.000Z"),
  }));
  const rotatingClient = serverSync.createClient({
    storage: memoryStorage(),
    persistentStorage: rotatingStorage,
    now: () => Date.parse("2026-07-27T10:00:00.000Z"),
    fetchImpl: async (url, options = {}) => {
      const body = JSON.parse(options.body || "{}");
      if (url === "/api/auth" && body.action === "refresh"){
        assert.equal(body.refreshToken, "old-refresh");
        return browserResponse({
          session: {
            access_token: "rotated-access",
            refresh_token: "rotated-refresh",
            expires_in: 3600,
          },
        });
      }
      return browserResponse({ message: "Unexpected rotating-session request" }, 500);
    },
  });
  assert.equal((await rotatingClient.restoreSession()).accessToken, "rotated-access", "an expired persistent session must refresh without requesting the password");
  assert(rotatingStorage.getItem(serverSync.PERSISTENT_SESSION_STORAGE_KEY).includes("rotated-refresh"), "refresh-token rotation must replace the saved device session");
  assert(!rotatingStorage.getItem(serverSync.PERSISTENT_SESSION_STORAGE_KEY).includes("old-refresh"), "a rotated refresh token must not leave the superseded token behind");

  const sessionOnlyStorage = memoryStorage();
  const sessionOnlyPersistentStorage = memoryStorage();
  const sessionOnlyClient = serverSync.createClient({
    storage: sessionOnlyStorage,
    persistentStorage: sessionOnlyPersistentStorage,
    now: () => Date.parse("2026-07-27T10:00:00.000Z"),
    fetchImpl: async (url, options = {}) => {
      if (url === "/api/auth" && options.method === "POST") return browserResponse({ session: passwordSession });
      return browserResponse({ configured: true, provider: "supabase" });
    },
  });
  await sessionOnlyClient.signIn("fan@example.com", "correct horse battery staple", { persist: false });
  assert(sessionOnlyStorage.getItem(serverSync.SESSION_STORAGE_KEY), "session-only sign-in must remain available in the current app process");
  assert.equal(sessionOnlyPersistentStorage.getItem(serverSync.PERSISTENT_SESSION_STORAGE_KEY), null, "session-only sign-in must not survive a browser restart");

  sessionOnlyClient.setSessionPersistence(true);
  assert.equal(sessionOnlyStorage.getItem(serverSync.SESSION_STORAGE_KEY), null, "enabling trusted-device persistence must remove the temporary session copy");
  assert(sessionOnlyPersistentStorage.getItem(serverSync.PERSISTENT_SESSION_STORAGE_KEY), "enabling trusted-device persistence must retain the active session across restarts");
  sessionOnlyClient.setSessionPersistence(false);
  assert(sessionOnlyStorage.getItem(serverSync.SESSION_STORAGE_KEY), "disabling trusted-device persistence must retain the active session until this app process ends");
  assert.equal(sessionOnlyPersistentStorage.getItem(serverSync.PERSISTENT_SESSION_STORAGE_KEY), null, "disabling trusted-device persistence must clear the long-lived device copy");
  await sessionOnlyClient.signOut();
  assert.equal(sessionOnlyStorage.getItem(serverSync.SESSION_STORAGE_KEY), null, "sign out must clear the current-session token");
  assert.equal(sessionOnlyPersistentStorage.getItem(serverSync.PERSISTENT_SESSION_STORAGE_KEY), null, "sign out must clear the persistent token");
  assert.equal((await client.user()).id, authUser.id);
  assert.equal((await client.loadState()).state.eventUserState.event.watchLater, true);
  assert.equal((await client.loadFeed()).derivedCardCache.buildOrigin, "server");
  assert(browserRequests.some(request => request.options.headers?.Authorization === "Bearer access"));

  const browserPatch = userStateSync.createPatch(
    server.userStateFromRow(databaseRow),
    {
      ...server.userStateFromRow(databaseRow),
      preferences: { ...server.userStateFromRow(databaseRow).preferences, theme: "day" },
    },
    { baseUpdatedAt: databaseRow.updated_at }
  );
  await client.savePatch(browserPatch);
  const browserPatchRequest = browserRequests.find(request => (
    request.url === "/api/user-state"
    && request.options.method === "PUT"
  ));
  assert.deepEqual(JSON.parse(browserPatchRequest.options.body), { patch: browserPatch });

  const snapshot = serverSync.buildUserState({
    preferences: { showSpoilers: false },
    eventUserState: { event: { watchLater: true } },
  });
  assert.equal(snapshot.schemaVersion, "user-state.v2");
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

  console.log("Server persistence valid: password auth and recovery, privacy-safe reset requests, RLS ownership, conditional patches and isolated browser recovery state passed.");
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
