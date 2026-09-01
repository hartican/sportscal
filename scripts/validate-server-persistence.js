#!/usr/bin/env node

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const server = require("../lib/supabase-server");
const serverSync = require("../config/server-sync");
const userStateSync = require("../config/user-state-sync");
const authHandler = require("../api/auth");
const userStateHandler = require("../api/user-state");
const { anonymousSignupTicketHash, clientAddress, createShareCapability } = require("../lib/chat-capability");

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
  assert.deepEqual(
    server.supabaseServiceRoleConfig({
      SUPABASE_URL:"https://project-ref.supabase.co",
      SUPABASE_PUBLISHABLE_KEY:"sb_publishable_test",
      SUPABASE_SECRET_KEY:"sb_secret_current_server_key",
      SUPABASE_SERVICE_ROLE_KEY:"legacy-service-role",
    }),
    {
      configured:true,
      url:"https://project-ref.supabase.co",
      publishableKey:"sb_publishable_test",
      serviceRoleKey:"sb_secret_current_server_key",
      opaqueSecret:true,
    },
    "the current server secret must replace a stale legacy service-role credential",
  );
  let opaqueSecretHeaders=null;
  await server.supabaseServiceRequest("/rest/v1/test",{
    environment:{
      SUPABASE_URL:"https://project-ref.supabase.co",
      SUPABASE_PUBLISHABLE_KEY:"sb_publishable_test",
      SUPABASE_SECRET_KEY:"sb_secret_current_server_key",
    },
    fetchImpl:async(_url,options)=>{opaqueSecretHeaders=options.headers;return fetchResponse([]);},
  });
  assert.equal(opaqueSecretHeaders.apikey,"sb_secret_current_server_key");
  assert.equal(opaqueSecretHeaders.Authorization,undefined,"opaque server secrets are API keys, not bearer JWTs");
  let legacyServiceHeaders=null;
  await server.supabaseServiceRequest("/rest/v1/test",{
    environment:{
      SUPABASE_URL:"https://project-ref.supabase.co",
      SUPABASE_PUBLISHABLE_KEY:"sb_publishable_test",
      SUPABASE_SERVICE_ROLE_KEY:"legacy-service-role-jwt",
    },
    fetchImpl:async(_url,options)=>{legacyServiceHeaders=options.headers;return fetchResponse([]);},
  });
  assert.equal(legacyServiceHeaders.apikey,"legacy-service-role-jwt");
  assert.equal(legacyServiceHeaders.Authorization,"Bearer legacy-service-role-jwt","legacy service-role JWTs must keep their bearer header during migration");
  assert.equal(clientAddress({headers:{"x-forwarded-for":"203.0.113.8","x-vercel-forwarded-for":"198.51.100.250"}}),"203.0.113.8","an attacker-supplied alternate header must never override Vercel's canonical x-forwarded-for");

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
    ratings:{ fixture:8 },
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
    fs.readFileSync("api/user-state.js", "utf8")
      + fs.readFileSync("config/server-sync.js", "utf8")
      + fs.readFileSync("index.html", "utf8"),
    /service[_-]?role/i,
    "browser and user-state persistence must never receive a service-role key"
  );
  assert.match(fs.readFileSync("api/auth.js", "utf8"), /supabaseServiceRequest/, "signup metadata may use the server-only service role with authenticated first-session fallback");

  const originalUrl = process.env.SUPABASE_URL;
  const originalPublishable = process.env.SUPABASE_PUBLISHABLE_KEY;
  const originalAnon = process.env.SUPABASE_ANON_KEY;
  const originalService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const originalSecret = process.env.SUPABASE_SECRET_KEY;
  const originalShareSecret = process.env.CHAT_GUEST_LINK_SECRET;
  const originalFetch = global.fetch;
  process.env.SUPABASE_URL = "https://project-ref.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-test";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test_server_only";
  process.env.CHAT_GUEST_LINK_SECRET = "test-only-chat-share-secret-00000000000000000000";
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
    ratings:{ fixture:8 },
    updated_at: "2026-07-27T10:00:00.000Z",
  };
  const preferenceResetId = "77777777-7777-4777-8777-777777777777";
  const passwordSession = {
    access_token: "access",
    refresh_token: "refresh",
    expires_in: 3600,
    user: authUser,
  };
  const jwt = claims => `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
  let issuedSignupTicket = "";
  const anonymousSession = {
    access_token:"",
    refresh_token:"guest-refresh",
    expires_in:3600,
    user:{
      id:"66666666-6666-4666-8666-666666666666",
      email:"",
      is_anonymous:true,
      created_at:"2026-07-27T00:00:00.000Z",
      app_metadata:{provider:"anonymous",providers:["anonymous"]},
      user_metadata:{},
    },
  };
  const cleanAnonymousSession = {
    access_token:jwt({sub:anonymousSession.user.id,is_anonymous:true,user_metadata:{purpose:"fixture-chat-guest"},app_metadata:{provider:"anonymous",providers:["anonymous"],chat_guest_attested:true}}),
    refresh_token:"guest-refresh-rotated",
    expires_in:3600,
    token_type:"bearer",
    user:{
      ...anonymousSession.user,
      app_metadata:{provider:"anonymous",providers:["anonymous"],chat_guest_attested:true},
      user_metadata:{purpose:"fixture-chat-guest",chat_signup_ticket:null},
    },
  };
  const sharedRoom={id:"aaaaaaaa-aaaa-4aaa-8aaa-000000000001",guest_share_version:1,guest_share_nonce:"abcdefghijklmnopqrstuvwxyzABCDEF"};
  const capability=createShareCapability(sharedRoom);
  let anonymousAuthorizationOutcome="authorized",anonymousJoinOutcome="joined";
  global.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url).includes("/auth/v1/token?grant_type=password")) return fetchResponse(passwordSession);
    if (String(url).includes("/auth/v1/token?grant_type=refresh_token")) return fetchResponse(cleanAnonymousSession);
    if (String(url).endsWith("/auth/v1/signup")){
      issuedSignupTicket=JSON.parse(options.body).data.chat_signup_ticket;
      anonymousSession.access_token=jwt({sub:anonymousSession.user.id,is_anonymous:true,user_metadata:{purpose:"fixture-chat-guest",chat_signup_ticket:issuedSignupTicket}});
      anonymousSession.user.user_metadata={purpose:"fixture-chat-guest",chat_signup_ticket:issuedSignupTicket};
      return fetchResponse(anonymousSession);
    }
    if (String(url).includes("/rest/v1/rpc/nothingsports_chat_authorize_anonymous_session")) return fetchResponse([{outcome:anonymousAuthorizationOutcome}]);
    if (String(url).includes("/rest/v1/rpc/nothingsports_chat_join_shared_room")) return fetchResponse([{outcome:anonymousJoinOutcome,existing_member:false,member_count:4}]);
    if (String(url).includes(`/auth/v1/admin/users/${anonymousSession.user.id}`) && options.method === "DELETE") return fetchResponse({});
    if (String(url).includes(`/auth/v1/admin/users/${anonymousSession.user.id}`) && options.method === "PUT") return fetchResponse(cleanAnonymousSession.user);
    if (String(url).includes("/auth/v1/recover?redirect_to=")) return fetchResponse({});
    if (String(url).endsWith("/auth/v1/user") && options.method === "PUT") return fetchResponse(authUser);
    if (String(url).endsWith("/auth/v1/user")) return fetchResponse(authUser);
    if (String(url).includes("/rest/v1/rpc/nothingsports_active_preference_reset")) return fetchResponse(null);
    if (String(url).includes("/rest/v1/rpc/nothingsports_reset_preferences")){
      const body = JSON.parse(options.body);
      return fetchResponse({
        recovery:{ resetId:preferenceResetId, createdAt:"2026-07-27T10:05:00.000Z", expiresAt:"2026-08-03T10:05:00.000Z" },
        state:{ ...databaseRow, preferences:body.target_preferences, updated_at:"2026-07-27T10:05:00.000Z" },
      });
    }
    if (String(url).includes("/rest/v1/rpc/nothingsports_undo_preferences_reset")){
      return fetchResponse({ recovery:null, state:{ ...databaseRow, updated_at:"2026-07-27T10:06:00.000Z" } });
    }
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
    assert.deepEqual(statusResponse.body, { configured:true,provider:"supabase" });
    assert.equal(statusResponse.headers["Cache-Control"], "private, no-store, max-age=0");

    const anonymousResponse = responseStub();
    await authHandler({
      method:"POST",
      headers:{"x-forwarded-for":"203.0.113.42","x-vercel-forwarded-for":"198.51.100.250"},
      body:{ action:"anonymous-chat-session", capability, guestDisplayName:"Guest Tester" },
    }, anonymousResponse);
    assert.equal(anonymousResponse.statusCode, 200);
    assert.equal(anonymousResponse.body.user.isAnonymous, true);
    assert.equal(anonymousResponse.body.session.access_token, cleanAnonymousSession.access_token);
    assert.equal(anonymousResponse.body.room.roomId,sharedRoom.id);
    const authorizationRequest=requests.find(request=>request.url.includes("nothingsports_chat_authorize_anonymous_session"));
    const authorizationBody=JSON.parse(authorizationRequest.options.body);
    assert.match(authorizationBody.target_ip_hash,/^[0-9a-f]{64}$/);
    assert.match(authorizationBody.target_ticket_hash,/^[0-9a-f]{64}$/);
    assert(!JSON.stringify(authorizationBody).includes("203.0.113.42"),"anonymous session persistence must receive only a server-keyed IP hash");
    const anonymousRequest = requests.find(request => request.url.endsWith("/auth/v1/signup"));
    const anonymousRequestBody=JSON.parse(anonymousRequest.options.body);
    assert.deepEqual(anonymousRequestBody, {
      data:{purpose:"fixture-chat-guest",chat_signup_ticket:issuedSignupTicket},
    });
    assert.match(issuedSignupTicket,/^[A-Za-z0-9_-]{43}$/,"anonymous signup must receive exactly 32 random base64url bytes");
    assert.equal(authorizationBody.target_ticket_hash,anonymousSignupTicketHash(issuedSignupTicket),"only the SHA-256 signup-ticket hash may be persisted");
    assert.equal(anonymousRequest.options.headers.apikey,"sb_secret_test_server_only","anonymous Auth must use the server-only Supabase secret key");
    assert.equal(anonymousRequest.options.headers["Sb-Forwarded-For"],"203.0.113.42","Supabase Auth must rate-limit the Vercel-overwritten client address rather than proxy egress");
    const joinRequest=requests.find(request=>request.url.includes("nothingsports_chat_join_shared_room"));
    const metadataCleanup=requests.find(request=>request.url.includes(`/auth/v1/admin/users/${anonymousSession.user.id}`)&&request.options.method==="PUT");
    const refreshRequest=requests.find(request=>request.url.includes("/auth/v1/token?grant_type=refresh_token"));
    assert(requests.indexOf(authorizationRequest)<requests.indexOf(anonymousRequest)&&requests.indexOf(anonymousRequest)<requests.indexOf(joinRequest)&&requests.indexOf(joinRequest)<requests.indexOf(metadataCleanup)&&requests.indexOf(metadataCleanup)<requests.indexOf(refreshRequest),"authorization, hook-ticket signup, atomic join, metadata cleanup and sanitized refresh must run in order");
    assert.deepEqual(JSON.parse(metadataCleanup.options.body),{
      user_metadata:{purpose:"fixture-chat-guest",chat_signup_ticket:null},
      app_metadata:{provider:"anonymous",providers:["anonymous"],chat_guest_attested:true},
    });
    assert.equal(refreshRequest.options.headers.apikey,"sb_secret_test_server_only");
    assert.equal(refreshRequest.options.headers["Sb-Forwarded-For"],"203.0.113.42");
    assert(!JSON.stringify(anonymousResponse.body).includes(issuedSignupTicket),"raw signup tickets must not appear in the API response");
    assert(!JSON.stringify(anonymousResponse.body).includes("sb_secret_test_server_only"),"Supabase secret keys must never appear in the API response");
    const returnedClaims=JSON.parse(Buffer.from(anonymousResponse.body.session.access_token.split(".")[1],"base64url").toString("utf8"));
    assert.equal(returnedClaims.user_metadata?.chat_signup_ticket,undefined,"the returned guest JWT must not retain the one-time signup ticket");

    const requestCountBeforeGuestRefresh=requests.length;
    const guestRefresh=responseStub();
    await authHandler({
      method:"POST",headers:{"x-forwarded-for":"203.0.113.44"},
      body:{action:"refresh-anonymous-chat-session",refreshToken:"guest-refresh-rotated"},
    },guestRefresh);
    assert.equal(guestRefresh.statusCode,200);
    const laterGuestRefreshRequest=requests.slice(requestCountBeforeGuestRefresh).find(request=>request.url.includes("/auth/v1/token?grant_type=refresh_token"));
    assert.equal(laterGuestRefreshRequest.options.headers.apikey,"sb_secret_test_server_only");
    assert.equal(laterGuestRefreshRequest.options.headers["Sb-Forwarded-For"],"203.0.113.44");
    assert(!JSON.stringify(guestRefresh.body).includes(issuedSignupTicket),"later guest refreshes must remain free of consumed signup tickets");

    const requestCountBeforeAccountRefresh=requests.length;
    const accountRefresh=responseStub();
    await authHandler({method:"POST",headers:{"x-forwarded-for":"203.0.113.45"},body:{action:"refresh",refreshToken:"account-refresh"}},accountRefresh);
    assert.equal(accountRefresh.statusCode,200);
    const accountRefreshRequest=requests.slice(requestCountBeforeAccountRefresh).find(request=>request.url.includes("/auth/v1/token?grant_type=refresh_token"));
    assert.equal(accountRefreshRequest.options.headers.apikey,"sb_publishable_test","ordinary account refresh must retain the low-privilege publishable key");
    assert.equal(accountRefreshRequest.options.headers["Sb-Forwarded-For"],undefined,"ordinary account refresh must not impersonate the anonymous proxy-forwarding path");

    const missingCapability=responseStub();
    await authHandler({method:"POST",headers:{"x-forwarded-for":"203.0.113.42"},body:{action:"anonymous-chat-session",guestDisplayName:"Guest Tester"}},missingCapability);
    assert.equal(missingCapability.body.code,"chat_share_invalid","anonymous Auth identities must never be minted without a signed room capability");

    const configuredSecret=process.env.SUPABASE_SECRET_KEY;
    delete process.env.SUPABASE_SECRET_KEY;
    const requestCountBeforeMissingSecret=requests.length;
    const missingSecret=responseStub();
    await authHandler({method:"POST",headers:{"x-forwarded-for":"203.0.113.42"},body:{action:"anonymous-chat-session",capability,guestDisplayName:"Guest Tester"}},missingSecret);
    assert.equal(missingSecret.statusCode,503);
    assert.equal(missingSecret.body.code,"anonymous_chat_session_unavailable");
    assert.equal(requests.length,requestCountBeforeMissingSecret,"missing forwarded-IP secret configuration must fail before rate authorization or anonymous signup");
    process.env.SUPABASE_SECRET_KEY=configuredSecret;

    anonymousAuthorizationOutcome="rate_limited";
    const limitedAnonymous=responseStub();
    await authHandler({method:"POST",headers:{"x-forwarded-for":"203.0.113.42"},body:{action:"anonymous-chat-session",capability,guestDisplayName:"Guest Tester"}},limitedAnonymous);
    assert.equal(limitedAnonymous.statusCode,429);
    assert.equal(limitedAnonymous.body.code,"chat_guest_rate_limited");
    anonymousAuthorizationOutcome="authorized";

    anonymousJoinOutcome="invalid";
    const racedAnonymous=responseStub();
    const requestCountBeforeRace=requests.length;
    await authHandler({method:"POST",headers:{"x-forwarded-for":"203.0.113.43"},body:{action:"anonymous-chat-session",capability,guestDisplayName:"Guest Tester"}},racedAnonymous);
    assert.equal(racedAnonymous.body.code,"chat_share_invalid");
    assert(requests.slice(requestCountBeforeRace).some(request=>request.url.includes(`/auth/v1/admin/users/${anonymousSession.user.id}`)&&request.options.method==="DELETE"),"a newly minted anonymous user must be deleted when rotate/disable wins the join race");
    anonymousJoinOutcome="joined";

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

    const resetResponse = responseStub();
    await userStateHandler({
      method:"POST",
      headers:{ authorization:"Bearer access-token" },
      body:{ action:"reset-preferences", preferences:{ version:16, theme:"system", followedSports:[] } },
    }, resetResponse);
    assert.equal(resetResponse.statusCode, 200);
    assert.equal(resetResponse.body.preferenceRecovery.resetId, preferenceResetId);
    assert.equal(resetResponse.body.state.event_user_state.event.watchLater, true, "preference reset must retain durable event state");
    assert.equal(resetResponse.body.state.ratings.fixture, 8, "preference reset must retain ratings unchanged");
    const resetRequest = requests.find(request => request.url.includes("nothingsports_reset_preferences"));
    assert.equal(JSON.parse(resetRequest.options.body).target_user_id, authUser.id, "the verified session user must own the reset RPC");

    const undoResponse = responseStub();
    await userStateHandler({
      method:"POST",
      headers:{ authorization:"Bearer access-token" },
      body:{ action:"undo-preferences-reset", resetId:preferenceResetId },
    }, undoResponse);
    assert.equal(undoResponse.statusCode, 200);
    assert.equal(undoResponse.body.preferenceRecovery, null);
    assert.equal(undoResponse.body.state.preferences.theme, "night", "undo must replace post-reset changes with the exact saved preferences");
    const undoRequest = requests.find(request => request.url.includes("nothingsports_undo_preferences_reset"));
    assert.deepEqual(JSON.parse(undoRequest.options.body), { target_user_id:authUser.id, target_reset_id:preferenceResetId });

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
    if (originalService === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalService;
    if (originalSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = originalSecret;
    if (originalShareSecret === undefined) delete process.env.CHAT_GUEST_LINK_SECRET;
    else process.env.CHAT_GUEST_LINK_SECRET = originalShareSecret;
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
          schemaVersion: "server-feed.v3",
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

  for (const [status, code] of [[503, "auth_upstream_failed"], [429, "too_many_requests"]]){
    const retryableStorage = memoryStorage();
    retryableStorage.setItem(serverSync.PERSISTENT_SESSION_STORAGE_KEY, JSON.stringify({
      accessToken:`retryable-${status}-access`, refreshToken:`retryable-${status}-refresh`, expiresAt:Date.parse("2026-07-27T09:00:00.000Z"),
    }));
    const retryableClient = serverSync.createClient({
      storage:memoryStorage(), persistentStorage:retryableStorage,
      now:() => Date.parse("2026-07-27T10:00:00.000Z"),
      fetchImpl:async () => browserResponse({ error:"Temporary auth outage", code }, status),
    });
    await assert.rejects(retryableClient.restoreSession(), error => error.status === status);
    assert(
      retryableStorage.getItem(serverSync.PERSISTENT_SESSION_STORAGE_KEY)?.includes(`retryable-${status}-refresh`),
      `${status} refresh failures must retain the trusted-device credentials for retry`,
    );
  }

  const terminalStorage = memoryStorage();
  terminalStorage.setItem(serverSync.PERSISTENT_SESSION_STORAGE_KEY, JSON.stringify({
    accessToken:"terminal-access", refreshToken:"terminal-refresh", expiresAt:Date.parse("2026-07-27T09:00:00.000Z"),
  }));
  const terminalClient = serverSync.createClient({
    storage:memoryStorage(), persistentStorage:terminalStorage,
    now:() => Date.parse("2026-07-27T10:00:00.000Z"),
    fetchImpl:async () => browserResponse({ error:"Refresh token revoked", code:"refresh_session_terminal" }, 400),
  });
  await assert.rejects(terminalClient.restoreSession(), error => error.code === "refresh_session_terminal");
  assert.equal(terminalStorage.getItem(serverSync.PERSISTENT_SESSION_STORAGE_KEY), null, "a confirmed terminal refresh failure must clear the revoked credentials");

  const simultaneousStorage = memoryStorage();
  simultaneousStorage.setItem(serverSync.PERSISTENT_SESSION_STORAGE_KEY, JSON.stringify({
    accessToken:"shared-expired", refreshToken:"shared-old-refresh", expiresAt:Date.parse("2026-07-27T09:00:00.000Z"),
  }));
  let simultaneousRefreshes = 0;
  const sharedRefreshFetch = async (_url, options = {}) => {
    simultaneousRefreshes += 1;
    assert.equal(JSON.parse(options.body || "{}").refreshToken, "shared-old-refresh");
    await new Promise(resolve => setTimeout(resolve, 500));
    return browserResponse({ session:{ access_token:"shared-rotated", refresh_token:"shared-new-refresh", expires_in:3600 } });
  };
  const simultaneousA = serverSync.createClient({ storage:memoryStorage(), persistentStorage:simultaneousStorage, now:() => Date.parse("2026-07-27T10:00:00.000Z"), fetchImpl:sharedRefreshFetch });
  const simultaneousB = serverSync.createClient({ storage:memoryStorage(), persistentStorage:simultaneousStorage, now:() => Date.parse("2026-07-27T10:00:00.000Z"), fetchImpl:sharedRefreshFetch });
  const simultaneousSessions = await Promise.all([simultaneousA.restoreSession(), simultaneousB.restoreSession()]);
  assert.equal(simultaneousRefreshes, 1, "simultaneous tabs must coordinate refresh-token rotation instead of reusing the old token");
  assert(simultaneousSessions.every(active => active.accessToken === "shared-rotated"));

  const guestStorage=memoryStorage();
  guestStorage.setItem(serverSync.GUEST_CHAT_SESSION_STORAGE_KEY,JSON.stringify({
    accessToken:"expired-guest-access",refreshToken:"expired-guest-refresh",expiresAt:Date.parse("2026-07-27T09:00:00.000Z"),
  }));
  const guestRefreshClient=serverSync.createClient({
    storage:memoryStorage(),persistentStorage:guestStorage,
    now:()=>Date.parse("2026-07-27T10:00:00.000Z"),
    fetchImpl:async (url,options={})=>{
      const body=JSON.parse(options.body||"{}");
      assert.equal(url,"/api/auth");
      assert.equal(body.action,"refresh-anonymous-chat-session","expired guest sessions must use the secret-key server refresh action");
      assert.equal(body.refreshToken,"expired-guest-refresh");
      return browserResponse({session:cleanAnonymousSession});
    },
  });
  const restoredGuest=await guestRefreshClient.anonymousChatSession();
  assert.equal(restoredGuest.session.accessToken,cleanAnonymousSession.access_token);
  assert(guestStorage.getItem(serverSync.GUEST_CHAT_SESSION_STORAGE_KEY).includes("guest-refresh-rotated"),"guest refresh-token rotation must replace the saved anonymous token");

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
