"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  SupabaseRequestError, authenticatedUser, bearerToken, publicError, supabaseServiceRequest,
} = require("../lib/supabase-server");
const marquee = require("../config/marquee-campaigns");

const CAMPAIGNS = "nothingsports_marquee_campaigns";
const SUBSCRIBERS = "nothingsports_marquee_subscribers";
const DELIVERIES = "nothingsports_marquee_deliveries";
const ARTIFACT = path.join(__dirname, "../data/marquee-candidates.v1.json");

class CommsError extends Error {
  constructor(message, status = 400, code = "invalid_comms_request"){ super(message); this.status = status; this.code = code; }
}
function privateHeaders(response){ response.setHeader("Cache-Control", "private, no-store, max-age=0"); response.setHeader("Vary", "Authorization"); }
function bodyOf(request){ if (request?.body && typeof request.body === "object") return request.body; try{ return JSON.parse(request?.body || "{}"); }catch(_error){ return {}; } }
function clean(value, maximum = 4096){ return String(value == null ? "" : value).trim().slice(0, maximum); }
function rowsPath(table, parameters = {}){ const query = new URLSearchParams(parameters); return `/rest/v1/${table}${query.size ? `?${query}` : ""}`; }
async function rows(table, parameters = {}){ const payload = await supabaseServiceRequest(rowsPath(table, parameters)); return Array.isArray(payload) ? payload : []; }
async function adminUser(request){
  const user = await authenticatedUser(bearerToken(request));
  if (!isAdminRole(user)) throw new CommsError("Marquee communications are restricted to app admins.", 403, "comms_admin_required");
  return user;
}
function isAdminRole(user){ return clean(user?.app_metadata?.role, 40).toLowerCase() === "admin"; }
function artifact(){ return JSON.parse(fs.readFileSync(ARTIFACT, "utf8")); }
function campaignPayload(candidate, state = candidate.state){
  return {
    campaign_id:candidate.campaignId, event_id:candidate.eventId, source_revision:candidate.source.revision,
    campaign_revision:candidate.campaignRevision, content_hash:candidate.contentHash, state,
    candidate, draft_copy:candidate.drafts, proposed_send_at:candidate.proposedSendAt, late:candidate.late,
    updated_at:new Date().toISOString(),
  };
}
async function syncCandidates(){
  const source = artifact();
  const synced = [];
  for (const candidate of source.candidates){
    const current = (await rows(CAMPAIGNS, { campaign_id:`eq.${candidate.campaignId}`, select:"*", limit:"1" }))[0] || null;
    if (!current){
      await supabaseServiceRequest(rowsPath(CAMPAIGNS), { method:"POST", headers:{ Prefer:"return=minimal" }, body:campaignPayload(candidate) });
      synced.push({ campaignId:candidate.campaignId, outcome:"created" });
      continue;
    }
    const materialChanged = current.content_hash !== candidate.contentHash;
    const published = Boolean(current.published_at) || ["published", "partially_published"].includes(current.state);
    const next = campaignPayload(candidate, materialChanged ? "needs_reapproval" : current.state);
    if (materialChanged){
      Object.assign(next, {
        campaign_revision:Number(current.campaign_revision || 1) + 1,
        approved_by:null, approved_at:null, approved_copy:null, scheduled_at:null,
        correction_required:published,
      });
    } else {
      delete next.draft_copy;
      next.campaign_revision=current.campaign_revision;
    }
    await supabaseServiceRequest(rowsPath(CAMPAIGNS, { campaign_id:`eq.${candidate.campaignId}` }), { method:"PATCH", headers:{ Prefer:"return=minimal" }, body:next });
    synced.push({ campaignId:candidate.campaignId, outcome:materialChanged ? (published ? "correction_required" : "approval_revoked") : "unchanged" });
  }
  return { schemaVersion:source.schemaVersion, sourceRevision:source.sourceRevision, synced };
}
async function queuePayload(){
  const campaigns = await rows(CAMPAIGNS, { select:"campaign_id,event_id,source_revision,campaign_revision,content_hash,state,candidate,draft_copy,approved_copy,proposed_send_at,approved_at,scheduled_at,published_at,correction_required,late,updated_at", order:"proposed_send_at.asc" });
  const audience = await rows(SUBSCRIBERS, { suppressed_at:"is.null", select:"subscriber_id" });
  return { schemaVersion:marquee.SCHEMA_VERSION, audienceCount:audience.length, campaigns };
}
function editableState(state){ return ["watching", "draft", "needs_review", "needs_reapproval", "failed", "connector_blocked"].includes(state); }
async function campaign(id){ return (await rows(CAMPAIGNS, { campaign_id:`eq.${clean(id,80)}`, select:"*", limit:"1" }))[0] || null; }
async function editCampaign(body){
  const current = await campaign(body.campaignId);
  if (!current) throw new CommsError("Campaign not found.", 404, "campaign_not_found");
  if (!editableState(current.state) || current.approved_at) throw new CommsError("Approved campaign copy is frozen.", 409, "campaign_copy_frozen");
  const copy = body.draftCopy && typeof body.draftCopy === "object" ? body.draftCopy : null;
  if (!copy) throw new CommsError("Draft copy is required.", 400, "draft_copy_required");
  const serialized = JSON.stringify(copy);
  if (Buffer.byteLength(serialized) > 64 * 1024) throw new CommsError("Draft copy is too large.", 413, "draft_copy_too_large");
  await supabaseServiceRequest(rowsPath(CAMPAIGNS, { campaign_id:`eq.${current.campaign_id}` }), { method:"PATCH", headers:{ Prefer:"return=minimal" }, body:{ draft_copy:copy, campaign_revision:Number(current.campaign_revision)+1, state:"needs_review", updated_at:new Date().toISOString() } });
  return { updated:true };
}
async function approveCampaign(body, user){
  const current = await campaign(body.campaignId);
  if (!current) throw new CommsError("Campaign not found.", 404, "campaign_not_found");
  if (!editableState(current.state)) throw new CommsError("This campaign cannot be approved in its current state.", 409, "campaign_not_approvable");
  const now = new Date().toISOString();
  await supabaseServiceRequest(rowsPath(CAMPAIGNS, { campaign_id:`eq.${current.campaign_id}` }), { method:"PATCH", headers:{ Prefer:"return=minimal" }, body:{ state:"approved", approved_by:user.id, approved_at:now, approved_copy:current.draft_copy, correction_required:false, updated_at:now } });
  return { approved:true, campaignId:current.campaign_id, approvedAt:now };
}
async function sendNow(body){
  if (body.confirmation !== "SEND NOW") throw new CommsError("Type SEND NOW to confirm this late campaign.", 409, "send_now_confirmation_required");
  const current = await campaign(body.campaignId);
  if (!current?.approved_at) throw new CommsError("Approve the frozen campaign revision first.", 409, "campaign_approval_required");
  const now = new Date().toISOString();
  const channels = ["instagram", "email"];
  for (const channel of channels){
    const key = `${current.campaign_id}:${current.content_hash}:${channel}`;
    await supabaseServiceRequest(rowsPath(DELIVERIES, { on_conflict:"idempotency_key" }), { method:"POST", headers:{ Prefer:"resolution=ignore-duplicates,return=minimal" }, body:{ campaign_id:current.campaign_id, channel, idempotency_key:key, status:"connector_blocked", receipt:{ reason:channel === "instagram" ? "requested_connector_not_installed" : "operator_sender_configuration_required", reconciled:true }, updated_at:now } });
  }
  await supabaseServiceRequest(rowsPath(CAMPAIGNS, { campaign_id:`eq.${current.campaign_id}` }), { method:"PATCH", headers:{ Prefer:"return=minimal" }, body:{ state:"connector_blocked", scheduled_at:null, updated_at:now } });
  return { sent:false, state:"connector_blocked", reconciled:true, channels };
}
function validEmail(value){ const email = clean(value, 320).toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ""; }
async function importSubscribers(body){
  if (!Array.isArray(body.rows) || !body.rows.length || body.rows.length > 5000) throw new CommsError("Supply between 1 and 5,000 consent rows.", 400, "invalid_consent_import");
  let imported = 0, suppressedPreserved = 0;
  for (const source of body.rows){
    const email = validEmail(source.email), consentedAt = clean(source.consented_at, 64), consentSource = clean(source.consent_source, 200), scope = clean(source.consent_scope, 80), evidenceReference = clean(source.evidence_reference, 500);
    if (!email || !Number.isFinite(Date.parse(consentedAt)) || !consentSource || scope !== "marquee_fixture_email" || !evidenceReference) throw new CommsError("Every row needs a valid email, consented_at, consent_source, marquee_fixture_email scope and evidence_reference.", 400, "invalid_consent_row");
    const current = (await rows(SUBSCRIBERS, { email_normalized:`eq.${encodeURIComponent(email)}`, select:"*", limit:"1" }))[0] || null;
    const newerThanSuppression = current?.suppressed_at && Date.parse(consentedAt) > Date.parse(current.suppressed_at);
    const preserveSuppression = Boolean(current?.suppressed_at && !newerThanSuppression);
    await supabaseServiceRequest(rowsPath(SUBSCRIBERS, { on_conflict:"email_normalized" }), { method:"POST", headers:{ Prefer:"resolution=merge-duplicates,return=minimal" }, body:{ email_normalized:email, consented_at:new Date(consentedAt).toISOString(), consent_source:consentSource, consent_scope:scope, evidence_reference:evidenceReference, suppressed_at:preserveSuppression ? current.suppressed_at : null, suppression_reason:preserveSuppression ? current.suppression_reason : null, updated_at:new Date().toISOString() } });
    imported += 1; if (preserveSuppression) suppressedPreserved += 1;
  }
  return { imported, suppressedPreserved };
}

module.exports = async function commsHandler(request, response){
  privateHeaders(response);
  try{
    if (!["GET", "POST"].includes(request.method || "GET")){ response.setHeader("Allow", "GET, POST"); response.status(405).json({ error:"Comms supports GET and POST only.", code:"method_not_allowed" }); return; }
    const user = await adminUser(request);
    if ((request.method || "GET") === "GET"){ response.status(200).json(await queuePayload()); return; }
    const body = bodyOf(request);
    let payload;
    if (body.action === "sync-candidates") payload = await syncCandidates();
    else if (body.action === "edit") payload = await editCampaign(body);
    else if (body.action === "approve") payload = await approveCampaign(body, user);
    else if (body.action === "send-now") payload = await sendNow(body);
    else if (body.action === "import-consent") payload = await importSubscribers(body);
    else throw new CommsError("Unknown communications action.", 400, "unknown_comms_action");
    response.status(200).json(payload);
  }catch(error){
    if (error instanceof CommsError){ response.status(error.status).json({ error:error.message, code:error.code }); return; }
    if (error instanceof SupabaseRequestError){ const outgoing = publicError(error); response.status(outgoing.status).json(outgoing.body); return; }
    response.status(500).json({ error:"Marquee communications are temporarily unavailable.", code:"comms_unavailable" });
  }
};

module.exports._test = Object.freeze({ CommsError, campaignPayload, editableState, isAdminRole, validEmail });
