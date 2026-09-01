"use strict";

const {
  USER_STATE_TABLE,
  SupabaseRequestError,
  authenticatedUser,
  bearerToken,
  conditionalUserStatePath,
  loadUserState,
  normalizeUserState,
  publicError,
  sameUserState,
  supabaseRequest,
  supabaseServiceRequest,
  userStateFromRow,
} = require("../lib/supabase-server");
const userStateSync = require("../config/user-state-sync");

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

function requestContentLength(request){
  const value = request?.headers?.["content-length"]
    || request?.headers?.["Content-Length"]
    || request?.headers?.get?.("content-length");
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function publicUser(user){
  return {
    id: user.id,
    email: user.email || "",
  };
}

function nextWriteTime(previousUpdatedAt){
  const previousTime = Date.parse(previousUpdatedAt || "");
  const nextTime = Number.isFinite(previousTime)
    ? Math.max(Date.now(), previousTime + 1)
    : Date.now();
  return new Date(nextTime);
}

function firstRpcResult(payload){
  return Array.isArray(payload) ? payload[0] || null : payload || null;
}

async function activePreferenceRecovery(userId){
  return firstRpcResult(await supabaseServiceRequest("/rest/v1/rpc/nothingsports_active_preference_reset", {
    method:"POST",
    body:{ target_user_id:userId },
  }));
}

async function preferenceRecoveryCommand(user, body){
  if (body.action === "reset-preferences"){
    const supplied = body.preferences;
    if (!supplied || typeof supplied !== "object" || Array.isArray(supplied)){
      throw new SupabaseRequestError("Default preferences are required.", {
        status:400,
        payload:{ code:"invalid_reset_preferences" },
      });
    }
    const preferences = normalizeUserState({ preferences:supplied }, user.id, new Date()).preferences;
    return firstRpcResult(await supabaseServiceRequest("/rest/v1/rpc/nothingsports_reset_preferences", {
      method:"POST",
      body:{ target_user_id:user.id, target_preferences:preferences },
    }));
  }
  if (body.action === "undo-preferences-reset"){
    const resetId = String(body.resetId || "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(resetId)){
      throw new SupabaseRequestError("The preference recovery reference is invalid.", {
        status:400,
        payload:{ code:"invalid_preference_recovery" },
      });
    }
    return firstRpcResult(await supabaseServiceRequest("/rest/v1/rpc/nothingsports_undo_preferences_reset", {
      method:"POST",
      body:{ target_user_id:user.id, target_reset_id:resetId },
    }));
  }
  throw new SupabaseRequestError("That user-state action is not supported.", {
    status:400,
    payload:{ code:"unsupported_user_state_action" },
  });
}

module.exports = async function userStateHandler(request, response){
  setPrivateResponseHeaders(response);
  try{
    if (!["GET", "PUT", "POST"].includes(request.method || "GET")){
      response.setHeader("Allow", "GET, PUT, POST");
      response.status(405).json({ error: "User state supports GET, PUT and POST requests only.", code: "method_not_allowed" });
      return;
    }

    const accessToken = bearerToken(request);
    const user = await authenticatedUser(accessToken);

    if ((request.method || "GET") === "GET"){
      const [state, preferenceRecovery] = await Promise.all([
        loadUserState(user.id, accessToken),
        activePreferenceRecovery(user.id),
      ]);
      response.status(200).json({
        user: publicUser(user),
        state,
        preferenceRecovery,
      });
      return;
    }

    const contentLength = requestContentLength(request);
    if (contentLength !== null && contentLength > 512 * 1024){
      throw new SupabaseRequestError("The user-state patch is too large.", {
        status: 413,
        payload: { code: "user_state_too_large" },
      });
    }
    const body = requestBody(request);
    if (Buffer.byteLength(JSON.stringify(body), "utf8") > 512 * 1024){
      throw new SupabaseRequestError("The user-state patch is too large.", {
        status: 413,
        payload: { code: "user_state_too_large" },
      });
    }
    if ((request.method || "GET") === "POST"){
      const result = await preferenceRecoveryCommand(user, body);
      if (!result?.state){
        throw new SupabaseRequestError("The preference reset was not confirmed.", {
          status:502,
          payload:{ code:"preference_reset_not_confirmed" },
        });
      }
      response.status(200).json({
        user:publicUser(user),
        state:result.state,
        preferenceRecovery:result.recovery || null,
      });
      return;
    }
    if (body.state){
      throw new SupabaseRequestError("Update Nothing Sport before syncing this device.", {
        status: 409,
        payload: { code: "client_update_required" },
      });
    }
    let patch;
    try{
      patch = userStateSync.normalizePatch(body.patch);
    }catch(error){
      throw new SupabaseRequestError("The user-state patch is invalid.", {
        status: 400,
        payload: { code: "invalid_user_state_patch", message: error?.message || "Invalid patch" },
      });
    }
    const existing = await loadUserState(user.id, accessToken);
    const existingUpdatedAt = existing?.updated_at || null;
    if (patch.baseUpdatedAt !== existingUpdatedAt){
      throw new SupabaseRequestError("Your saved state changed on another device. Reload and retry.", {
        status: 409,
        payload: { code: "user_state_conflict" },
      });
    }
    const merged = userStateSync.applyPatch(userStateFromRow(existing) || {}, patch);
    if (existing && sameUserState(existing, merged)){
      response.status(200).json({
        user: publicUser(user),
        state: existing,
      });
      return;
    }
    const state = normalizeUserState(merged, user.id, nextWriteTime(existingUpdatedAt));
    const rows = existing
      ? await supabaseRequest(conditionalUserStatePath(user.id, existingUpdatedAt), {
          method: "PATCH",
          accessToken,
          headers: { Prefer: "return=representation" },
          body: state,
        })
      : await supabaseRequest(`/rest/v1/${USER_STATE_TABLE}?on_conflict=user_id`, {
          method: "POST",
          accessToken,
          headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
          body: state,
        });
    if (!Array.isArray(rows) || !rows.length){
      throw new SupabaseRequestError("Your saved state changed on another device. Reload and retry.", {
        status: 409,
        payload: { code: "user_state_conflict" },
      });
    }
    response.status(200).json({
      user: publicUser(user),
      state: rows[0],
      preferenceRecovery:await activePreferenceRecovery(user.id),
    });
  }catch(error){
    const outgoing = publicError(error);
    response.status(outgoing.status).json(outgoing.body);
  }
};
