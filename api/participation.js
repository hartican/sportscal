"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { SupabaseRequestError, publicError, requestOrigin, supabaseServiceRequest } = require("../lib/supabase-server");
const nothingscoreHandler = require("../lib/nothingscore-handler");
const nothingscoreMarqueeHandler = require("../lib/nothingscore-marquee-handler");

const COOKIE_NAME = "__Host-ns_marquee_guest";
const DEVICES = "nothingsports_fixture_devices";
const PARTICIPATION = "nothingsports_fixture_participation";
const ARTIFACT = path.join(__dirname, "../data/marquee-candidates.v1.json");

class ParticipationError extends Error {
  constructor(message, status = 400, code = "invalid_participation_request"){ super(message); this.status = status; this.code = code; }
}
function clean(value, maximum = 200){ return String(value == null ? "" : value).trim().slice(0, maximum); }
function header(request, name){
  if (request?.headers?.get) return request.headers.get(name) || "";
  const target = name.toLowerCase();
  const entry = Object.entries(request?.headers || {}).find(([key]) => key.toLowerCase() === target);
  return clean(entry?.[1], 4096);
}
function bodyOf(request){ if (request?.body && typeof request.body === "object") return request.body; try{ return JSON.parse(request?.body || "{}"); }catch(_error){ return {}; } }
function queryValue(request, name){
  if (request?.query && Object.prototype.hasOwnProperty.call(request.query, name)){ const value = request.query[name]; return Array.isArray(value) ? value[0] : value; }
  try{ return new URL(request?.url || "/api/participation", "https://nothingsport.vercel.app").searchParams.get(name) || ""; }catch(_error){ return ""; }
}
function secret(environment = process.env){
  const value = clean(environment.PARTICIPATION_SECRET, 1024);
  if (value.length < 32) throw new ParticipationError("Guest participation is not configured.", 503, "participation_not_configured");
  return value;
}
function parseCookies(value){
  return Object.fromEntries(String(value || "").split(";").map(part => part.trim()).filter(Boolean).map(part => { const at = part.indexOf("="); return at < 0 ? [part, ""] : [part.slice(0, at), decodeURIComponent(part.slice(at + 1))]; }));
}
function deviceIdentity(request, response, environment = process.env){
  const configuredSecret = secret(environment);
  let token = clean(parseCookies(header(request, "cookie"))[COOKIE_NAME], 256);
  let issued = false;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)){ token = crypto.randomBytes(32).toString("base64url"); issued = true; }
  if (issued) response.setHeader("Set-Cookie", `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`);
  const hash = crypto.createHmac("sha256", configuredSecret).update(token).digest("hex");
  return { hash, issued };
}
function sameOrigin(request){
  const origin = clean(header(request, "origin"), 500);
  if (!origin) return false;
  try{ return new URL(origin).origin === requestOrigin(request); }catch(_error){ return false; }
}
function artifact(){ return JSON.parse(fs.readFileSync(ARTIFACT, "utf8")); }
function candidateFor(eventId){
  const id = clean(eventId, 180);
  const candidate = artifact().candidates.find(item => item.eventId === id);
  if (!candidate || candidate.readyForExport === false || candidate.participation?.enabled === false) throw new ParticipationError("That fixture is not available for marquee participation.", 404, "fixture_not_participating");
  return candidate;
}
function rowsPath(table, parameters = {}){ const query = new URLSearchParams(parameters); return `/rest/v1/${table}${query.size ? `?${query}` : ""}`; }
async function rows(table, parameters = {}){ const payload = await supabaseServiceRequest(rowsPath(table, parameters)); return Array.isArray(payload) ? payload : []; }
async function rememberDevice(hash, now){
  await supabaseServiceRequest(rowsPath(DEVICES, { on_conflict:"device_hash" }), { method:"POST", headers:{ Prefer:"resolution=merge-duplicates,return=minimal" }, body:{ device_hash:hash, last_seen_at:now } });
}
async function aggregate(eventId, hash){
  const records = await rows(PARTICIPATION, { event_id:`eq.${eventId}`, select:"device_hash,joined_at,rating,rated_at" });
  const ratings = records.map(record => Number(record.rating)).filter(rating => Number.isInteger(rating) && rating >= 1 && rating <= 5);
  const mine = records.find(record => record.device_hash === hash);
  return {
    joinedCount:records.filter(record => record.joined_at).length,
    ratingCount:ratings.length,
    averageRating:ratings.length ? Math.round((ratings.reduce((total, rating) => total + rating, 0) / ratings.length) * 10) / 10 : null,
    currentDevice:{ joined:Boolean(mine?.joined_at), rating:Number(mine?.rating) || null },
  };
}
async function takeRateLimit(hash, action, now){
  const payload = await supabaseServiceRequest("/rest/v1/rpc/nothingsports_marquee_take_rate_limit", { method:"POST", body:{ target_device_hash:hash, target_action:action, target_now:now, window_seconds:60, maximum_requests:10 } });
  if (payload !== true) throw new ParticipationError("Please wait before trying that again.", 429, "participation_rate_limited");
}
function publicFixture(candidate, nowMs){
  const opensAt = Date.parse(candidate.participation.ratingWindow.opensAt), closesAt = Date.parse(candidate.participation.ratingWindow.closesAt);
  return {
    eventId:candidate.eventId, campaignId:candidate.campaignId, title:candidate.material.title,
    sport:candidate.material.sport, startTimeUtc:candidate.timing.startTimeUtc, endTimeUtc:candidate.timing.endTimeUtc,
    sydneyStart:candidate.timing.sydneyStart, sydneyFinish:candidate.timing.sydneyFinish,
    broadcaster:candidate.material.broadcaster, hook:candidate.drafts.hook,
    rating:{ opensAt:candidate.participation.ratingWindow.opensAt, closesAt:candidate.participation.ratingWindow.closesAt, open:nowMs >= opensAt && nowMs <= closesAt },
  };
}

module.exports = async function participationHandler(request, response){
  const routeMode = queryValue(request, "mode");
  if (routeMode === "nothingscore") return nothingscoreHandler(request, response);
  if (routeMode === "nothingscore-marquee") return nothingscoreMarqueeHandler(request, response);
  response.setHeader("Cache-Control", "private, no-store, max-age=0");
  response.setHeader("Vary", "Cookie");
  try{
    if (!["GET", "POST"].includes(request.method || "GET")){ response.setHeader("Allow", "GET, POST"); response.status(405).json({ error:"Participation supports GET and POST only.", code:"method_not_allowed" }); return; }
    const body = (request.method || "GET") === "POST" ? bodyOf(request) : {};
    const eventId = clean(body.eventId || queryValue(request, "eventId"), 180);
    const candidate = candidateFor(eventId);
    const now = new Date().toISOString(), nowMs = Date.parse(now);
    const device = deviceIdentity(request, response);
    await rememberDevice(device.hash, now);
    if ((request.method || "GET") === "POST"){
      if (!sameOrigin(request)) throw new ParticipationError("Participation writes must come from this site.", 403, "same_origin_required");
      const action = clean(body.action, 20);
      if (!["join", "rate"].includes(action)) throw new ParticipationError("Choose join or rate.", 400, "unknown_participation_action");
      await takeRateLimit(device.hash, action, now);
      const existing = (await rows(PARTICIPATION, { event_id:`eq.${eventId}`, device_hash:`eq.${device.hash}`, select:"*", limit:"1" }))[0] || null;
      const next = { event_id:eventId, device_hash:device.hash, campaign_id:candidate.campaignId, joined_at:existing?.joined_at || null, rating:existing?.rating || null, rated_at:existing?.rated_at || null, updated_at:now };
      if (action === "join") next.joined_at = existing?.joined_at || now;
      if (action === "rate"){
        const rating = Number(body.rating), window = candidate.participation.ratingWindow;
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ParticipationError("Choose a rating from 1 to 5.", 400, "invalid_rating");
        if (nowMs < Date.parse(window.opensAt)) throw new ParticipationError("Ratings open after the expected finish.", 409, "rating_not_open");
        if (nowMs > Date.parse(window.closesAt)) throw new ParticipationError("This rating window has closed.", 409, "rating_window_closed");
        next.rating=rating; next.rated_at=now;
      }
      await supabaseServiceRequest(rowsPath(PARTICIPATION, { on_conflict:"event_id,device_hash" }), { method:"POST", headers:{ Prefer:"resolution=merge-duplicates,return=minimal" }, body:next });
    }
    response.status(200).json({ schemaVersion:"marquee-participation.v1", fixture:publicFixture(candidate, nowMs), aggregate:await aggregate(eventId, device.hash) });
  }catch(error){
    if (error instanceof ParticipationError){ response.status(error.status).json({ error:error.message, code:error.code }); return; }
    if (error instanceof SupabaseRequestError){ const outgoing = publicError(error); response.status(outgoing.status).json(outgoing.body); return; }
    response.status(500).json({ error:"Fixture participation is temporarily unavailable.", code:"participation_unavailable" });
  }
};

module.exports._test = Object.freeze({ COOKIE_NAME, ParticipationError, candidateFor, deviceIdentity, parseCookies, publicFixture, sameOrigin });
