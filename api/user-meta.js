"use strict";

const {
  authenticatedUser,
  bearerToken,
  publicError,
  supabaseRequest,
} = require("../lib/supabase-server");
const followFirst = require("../config/follow-first");

function setPrivateHeaders(response){
  response.setHeader("Cache-Control", "private, no-store, max-age=0");
  response.setHeader("Vary", "Authorization");
}

function requestBody(request){
  if (request?.body && typeof request.body === "object") return request.body;
  try{ return JSON.parse(request?.body || "{}"); }catch(_error){ return {}; }
}

function rowToMeta(row){
  if (!row) return null;
  return followFirst.normalizeMeta({
    schemaVersion:row.schema_version,
    revision:row.revision,
    sports:row.sports,
    majorEvents:row.major_events,
    offerInterests:row.offer_interests,
    location:row.coarse_region,
    personalisedOffersConsent:row.personalised_offers_consent,
    consentUpdatedAt:row.consent_updated_at,
    source:row.source,
  });
}

module.exports = async function userMetaHandler(request, response){
  setPrivateHeaders(response);
  try{
    if (!["GET", "PUT"].includes(request.method || "GET")){
      response.setHeader("Allow", "GET, PUT");
      response.status(405).json({ error:"User metadata supports GET and PUT only.", code:"method_not_allowed" });
      return;
    }
    const accessToken = bearerToken(request);
    const user = await authenticatedUser(accessToken);
    const columns = "user_id,schema_version,revision,seed_hash,sports,major_events,offer_interests,coarse_region,personalised_offers_consent,consent_updated_at,source,updated_at";
    if ((request.method || "GET") === "GET"){
      const rows = await supabaseRequest(`/rest/v1/nothingsports_user_meta?user_id=eq.${encodeURIComponent(user.id)}&select=${columns}`, { accessToken });
      response.status(200).json({ meta:rowToMeta(Array.isArray(rows) ? rows[0] : null) });
      return;
    }
    const existingRows = await supabaseRequest(`/rest/v1/nothingsports_user_meta?user_id=eq.${encodeURIComponent(user.id)}&select=${columns}`, { accessToken });
    const existing = Array.isArray(existingRows) ? existingRows[0] : null;
    const incoming = followFirst.normalizeMeta({
      ...(rowToMeta(existing) || {}),
      ...(requestBody(request).meta || {}),
      revision:Math.max(Number(existing?.revision || 0) + 1, Number(requestBody(request).meta?.revision || 1)),
      source:"user",
    });
    const rows = await supabaseRequest("/rest/v1/nothingsports_user_meta?on_conflict=user_id", {
      method:"POST",
      accessToken,
      headers:{ Prefer:"resolution=merge-duplicates,return=representation" },
      body:{
        user_id:user.id,
        schema_version:incoming.schemaVersion,
        revision:incoming.revision,
        seed_hash:incoming.seedHash,
        sports:incoming.sports,
        major_events:incoming.majorEvents,
        offer_interests:incoming.offerInterests,
        coarse_region:incoming.location,
        personalised_offers_consent:incoming.personalisedOffersConsent,
        consent_updated_at:incoming.consentUpdatedAt,
        source:"user",
        updated_at:new Date().toISOString(),
      },
    });
    response.status(200).json({ meta:rowToMeta(rows?.[0]) });
  }catch(error){
    const outgoing = publicError(error);
    response.status(outgoing.status).json(outgoing.body);
  }
};
