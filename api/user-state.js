"use strict";

const {
  USER_STATE_TABLE,
  authenticatedUser,
  bearerToken,
  normalizeUserState,
  publicError,
  supabaseRequest,
} = require("../lib/supabase-server");

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

function setPrivateResponseHeaders(response){
  response.setHeader("Cache-Control", "private, no-store, max-age=0");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Vary", "Authorization");
}

function requestBody(request){
  if (!request?.body) return {};
  if (typeof request.body === "object") return request.body;
  try{
    return JSON.parse(request.body);
  }catch(_error){
    return {};
  }
}

function statePath(userId){
  const query = new URLSearchParams({
    user_id: `eq.${userId}`,
    select: USER_STATE_COLUMNS,
  });
  return `/rest/v1/${USER_STATE_TABLE}?${query.toString()}`;
}

function publicUser(user){
  return {
    id: user.id,
    email: user.email || "",
  };
}

module.exports = async function userStateHandler(request, response){
  setPrivateResponseHeaders(response);
  try{
    if (!["GET", "PUT"].includes(request.method || "GET")){
      response.setHeader("Allow", "GET, PUT");
      response.status(405).json({ error: "User state supports GET and PUT requests only.", code: "method_not_allowed" });
      return;
    }

    const accessToken = bearerToken(request);
    const user = await authenticatedUser(accessToken);

    if ((request.method || "GET") === "GET"){
      const rows = await supabaseRequest(statePath(user.id), { accessToken });
      response.status(200).json({
        user: publicUser(user),
        state: Array.isArray(rows) && rows.length ? rows[0] : null,
      });
      return;
    }

    const body = requestBody(request);
    const state = normalizeUserState(body.state, user.id);
    const rows = await supabaseRequest(`/rest/v1/${USER_STATE_TABLE}?on_conflict=user_id`, {
      method: "POST",
      accessToken,
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: state,
    });
    response.status(200).json({
      user: publicUser(user),
      state: Array.isArray(rows) && rows.length ? rows[0] : state,
    });
  }catch(error){
    const outgoing = publicError(error);
    response.status(outgoing.status).json(outgoing.body);
  }
};
