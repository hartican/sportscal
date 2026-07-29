"use strict";

const USER_STATE_SCHEMA_VERSION = "user-state.v1";
const USER_STATE_TABLE = "nothingsports_user_state";
const USER_STATE_COLUMNS = [
  "user_id",
  "schema_version",
  "profile",
  "preferences",
  "event_user_state",
  "event_spoiler_state",
  "archived_events",
  "ratings",
  "updated_at",
].join(",");
const MAX_USER_STATE_BYTES = 512 * 1024;

class SupabaseRequestError extends Error {
  constructor(message, { status = 500, payload = null } = {}){
    super(message);
    this.name = "SupabaseRequestError";
    this.status = status;
    this.payload = payload;
  }
}

function cleanEnvironmentValue(value){
  return typeof value === "string" ? value.trim() : "";
}

function supabaseConfig(environment = process.env){
  const rawUrl = cleanEnvironmentValue(environment.SUPABASE_URL);
  const publishableKey = cleanEnvironmentValue(
    environment.SUPABASE_PUBLISHABLE_KEY || environment.SUPABASE_ANON_KEY
  );
  let url = "";
  try{
    const parsed = new URL(rawUrl);
    const localHost = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
    if (parsed.protocol === "https:" || (parsed.protocol === "http:" && localHost)){
      url = parsed.origin;
    }
  }catch(_error){
    url = "";
  }
  return {
    configured: Boolean(url && publishableKey),
    url,
    publishableKey,
  };
}

function requestHeader(request, name){
  if (request?.headers?.get) return request.headers.get(name);
  const target = String(name || "").toLowerCase();
  const entry = Object.entries(request?.headers || {}).find(([key]) => key.toLowerCase() === target);
  return entry?.[1] || "";
}

function bearerToken(request){
  const authorization = String(requestHeader(request, "authorization") || "");
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function requestOrigin(request){
  const forwardedHost = cleanEnvironmentValue(requestHeader(request, "x-forwarded-host"));
  const host = forwardedHost || cleanEnvironmentValue(requestHeader(request, "host"));
  const forwardedProto = cleanEnvironmentValue(requestHeader(request, "x-forwarded-proto"));
  const protocol = forwardedProto || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  if (host){
    try{
      return new URL(`${protocol}://${host}`).origin;
    }catch(_error){
      // Fall through to request URL.
    }
  }
  try{
    return new URL(request?.url || "", "https://nothingsport.vercel.app").origin;
  }catch(_error){
    return "https://nothingsport.vercel.app";
  }
}

function safeRedirectUrl(request, candidate){
  const origin = requestOrigin(request);
  try{
    const target = new URL(candidate || "/", origin);
    return target.origin === origin ? target.href : `${origin}/`;
  }catch(_error){
    return `${origin}/`;
  }
}

async function responsePayload(response){
  const text = await response.text();
  if (!text) return null;
  try{
    return JSON.parse(text);
  }catch(_error){
    return { message: text };
  }
}

function errorMessage(payload, fallback){
  return cleanEnvironmentValue(
    payload?.error_description
    || payload?.msg
    || payload?.message
    || payload?.error
  ) || fallback;
}

async function supabaseRequest(path, {
  method = "GET",
  accessToken = "",
  body,
  headers = {},
  environment = process.env,
  fetchImpl = globalThis.fetch,
} = {}){
  const config = supabaseConfig(environment);
  if (!config.configured){
    throw new SupabaseRequestError("Supabase server sync is not configured.", {
      status: 503,
      payload: { code: "supabase_not_configured" },
    });
  }
  if (typeof fetchImpl !== "function"){
    throw new SupabaseRequestError("The server fetch runtime is unavailable.", { status: 500 });
  }

  const requestHeaders = {
    apikey: config.publishableKey,
    Accept: "application/json",
    ...headers,
  };
  if (accessToken) requestHeaders.Authorization = `Bearer ${accessToken}`;
  if (body !== undefined) requestHeaders["Content-Type"] = "application/json";

  let response;
  try{
    response = await fetchImpl(`${config.url}${path}`, {
      method,
      headers: requestHeaders,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }catch(error){
    throw new SupabaseRequestError("Supabase could not be reached.", {
      status: 502,
      payload: { message: error?.message || "Network request failed" },
    });
  }

  const payload = await responsePayload(response);
  if (!response.ok){
    throw new SupabaseRequestError(errorMessage(payload, "Supabase rejected the request."), {
      status: response.status,
      payload,
    });
  }
  return payload;
}

async function authenticatedUser(accessToken, options = {}){
  if (!accessToken){
    throw new SupabaseRequestError("Sign in is required.", {
      status: 401,
      payload: { code: "missing_access_token" },
    });
  }
  const user = await supabaseRequest("/auth/v1/user", {
    ...options,
    accessToken,
  });
  if (!user?.id){
    throw new SupabaseRequestError("The Supabase session is not valid.", {
      status: 401,
      payload: { code: "invalid_access_token" },
    });
  }
  return user;
}

function plainObject(value, fallback = {}){
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

function normalizeUserState(input, userId, now = new Date()){
  const source = plainObject(input);
  const archivedEvents = Array.isArray(source.archivedEvents) ? source.archivedEvents : [];
  const state = {
    user_id: userId,
    schema_version: USER_STATE_SCHEMA_VERSION,
    profile: plainObject(source.profile),
    preferences: plainObject(source.preferences),
    event_user_state: plainObject(source.eventUserState),
    event_spoiler_state: plainObject(source.eventSpoilerState),
    archived_events: archivedEvents,
    ratings: plainObject(source.ratings),
    updated_at: (now instanceof Date ? now : new Date(now)).toISOString(),
  };
  const byteLength = Buffer.byteLength(JSON.stringify(state), "utf8");
  if (byteLength > MAX_USER_STATE_BYTES){
    throw new SupabaseRequestError("Your saved nothingsport state is too large to sync.", {
      status: 413,
      payload: { code: "user_state_too_large", maxBytes: MAX_USER_STATE_BYTES },
    });
  }
  return state;
}

function userStatePath(userId){
  const query = new URLSearchParams({
    user_id: `eq.${userId}`,
    select: USER_STATE_COLUMNS,
  });
  return `/rest/v1/${USER_STATE_TABLE}?${query.toString()}`;
}

async function loadUserState(userId, accessToken, options = {}){
  const rows = await supabaseRequest(userStatePath(userId), {
    ...options,
    accessToken,
  });
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function publicError(error){
  if (!(error instanceof SupabaseRequestError)){
    return {
      status: 500,
      body: { error: "Server sync failed.", code: "server_sync_failed" },
    };
  }
  const status = error.status >= 400 && error.status <= 599 ? error.status : 500;
  const code = error.payload?.code
    || error.payload?.error_code
    || (status === 429 ? "rate_limited" : "supabase_request_failed");
  const safeMessage = status >= 500 && code !== "supabase_not_configured"
    ? "Server sync is temporarily unavailable."
    : error.message;
  return {
    status,
    body: { error: safeMessage, code },
  };
}

module.exports = {
  MAX_USER_STATE_BYTES,
  USER_STATE_COLUMNS,
  USER_STATE_SCHEMA_VERSION,
  USER_STATE_TABLE,
  SupabaseRequestError,
  authenticatedUser,
  bearerToken,
  loadUserState,
  normalizeUserState,
  publicError,
  requestOrigin,
  safeRedirectUrl,
  supabaseConfig,
  supabaseRequest,
  userStatePath,
};
