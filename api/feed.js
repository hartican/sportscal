"use strict";

const crypto = require("node:crypto");

const eventFeed = require("../data/events.json");
const canonicalSports = require("../data/canonical/afl-nrl-2026.json");
const f1Context = require("../data/canonical/f1-context-2026.json");
const tennisContext = require("../data/canonical/tennis-context-2026.json");
const cyclingContext = require("../data/canonical/cycling-context-2026.json");
const nbaContext = require("../data/canonical/nba-context-2026.json");
const cwgContext = require("../data/canonical/cwg-context-2026.json");
const sportContext = require("../config/sport-context");
const {
  SupabaseRequestError,
  authenticatedUser,
  bearerToken,
  loadUserState,
  publicError,
} = require("../lib/supabase-server");
const {
  buildServerFeed,
} = require("../lib/server-feed-pipeline");

const canonicalSportContext = sportContext.mergeCanonicalBundles(canonicalSports, f1Context, tennisContext, cyclingContext, nbaContext, cwgContext);
const contextualEvents = sportContext.applyContextToEvents(eventFeed.events, canonicalSportContext);

function setPrivateResponseHeaders(response){
  response.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Vary", "Authorization");
}

module.exports = async function feedHandler(request, response){
  setPrivateResponseHeaders(response);
  try{
    if ((request.method || "GET") !== "GET"){
      response.setHeader("Allow", "GET");
      response.status(405).json({ error: "The personalised feed supports GET requests only.", code: "method_not_allowed" });
      return;
    }
    const accessToken = bearerToken(request);
    const user = await authenticatedUser(accessToken);
    const userState = await loadUserState(user.id, accessToken);
    if (!userState){
      throw new SupabaseRequestError("Your synced profile must be saved before the feed can rebuild.", {
        status: 409,
        payload: { code: "user_state_missing" },
      });
    }
    const requestUrl = new URL(request.url || "/api/feed", "https://nothingsport.local");
    const requestedLimit = request.url
      ? Math.min(50, Math.max(1, Number(requestUrl.searchParams.get("limit") || 20)))
      : eventFeed.events.length;
    const feed = buildServerFeed({
      events: contextualEvents,
      userId: user.id,
      userState,
      participants: canonicalSportContext.participants,
      sourceVersion: eventFeed.version,
      sourcePublishedAt: eventFeed.publishedAt,
      cursor: requestUrl.searchParams.get("cursor") || 0,
      limit: requestedLimit,
    });
    const etagSeed = {
      sourceVersion: eventFeed.version,
      sourcePublishedAt: eventFeed.publishedAt,
      userId: user.id,
      userState,
      cursor: feed.pagination.cursor,
      limit: feed.pagination.limit,
    };
    const etag = `"${crypto.createHash("sha256").update(JSON.stringify(etagSeed)).digest("base64url").slice(0, 24)}"`;
    response.setHeader("ETag", etag);
    if (request.headers?.["if-none-match"] === etag && typeof response.end === "function"){
      response.status(304).end();
      return;
    }
    response.status(200).json(feed);
  }catch(error){
    const outgoing = publicError(error);
    response.status(outgoing.status).json(outgoing.body);
  }
};
