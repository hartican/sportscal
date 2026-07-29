"use strict";

const eventFeed = require("../data/events.json");
const canonicalSports = require("../data/canonical/afl-nrl-2026.json");
const f1Context = require("../data/canonical/f1-context-2026.json");
const tennisContext = require("../data/canonical/tennis-context-2026.json");
const cyclingContext = require("../data/canonical/cycling-context-2026.json");
const nbaContext = require("../data/canonical/nba-context-2026.json");
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

const canonicalSportContext = sportContext.mergeCanonicalBundles(canonicalSports, f1Context, tennisContext, cyclingContext, nbaContext);
const contextualEvents = sportContext.applyContextToEvents(eventFeed.events, canonicalSportContext);

function setPrivateResponseHeaders(response){
  response.setHeader("Cache-Control", "private, no-store, max-age=0");
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
    const feed = buildServerFeed({
      events: contextualEvents,
      userId: user.id,
      userState,
      participants: canonicalSportContext.participants,
      sourceVersion: eventFeed.version,
    });
    response.status(200).json(feed);
  }catch(error){
    const outgoing = publicError(error);
    response.status(outgoing.status).json(outgoing.body);
  }
};
