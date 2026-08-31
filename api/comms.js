"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  SupabaseRequestError, authenticatedUser, bearerToken, publicError, supabaseServiceRequest,
} = require("../lib/supabase-server");
const marquee = require("../config/marquee-campaigns");
const adminApi = require("../lib/admin-api");

const CAMPAIGNS = "nothingsports_marquee_campaigns";
const ARTIFACT = path.join(__dirname, "../data/marquee-candidates.v1.json");
const EXPORT_SCHEMA_VERSION = "mailchimp-manual.v1";

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
function record(value){ return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function mergeDraft(...sources){
  let draft = {};
  for (const sourceValue of sources){
    const source = record(sourceValue), previousEmail = record(draft.email), incomingEmail = record(source.email), previousInstagram = record(draft.instagram), incomingInstagram = record(source.instagram);
    draft = {
      ...draft,
      ...source,
      email:{
        ...previousEmail,
        ...incomingEmail,
        primaryCta:{ ...record(previousEmail.primaryCta), ...record(incomingEmail.primaryCta) },
        secondaryCta:{ ...record(previousEmail.secondaryCta), ...record(incomingEmail.secondaryCta) },
        image:{ ...record(previousEmail.image), ...record(incomingEmail.image) },
        suggestedSendAt:{
          ...record(previousEmail.suggestedSendAt),
          ...record(incomingEmail.suggestedSendAt),
          sydney:{ ...record(previousEmail.suggestedSendAt?.sydney), ...record(incomingEmail.suggestedSendAt?.sydney) },
        },
      },
      instagram:{
        ...previousInstagram,
        ...incomingInstagram,
        image:{ ...record(previousInstagram.image), ...record(incomingInstagram.image) },
      },
    };
  }
  return draft;
}
function deployedCandidate(current){
  const match = artifact().candidates.find(candidate => candidate.campaignId === current?.campaign_id || candidate.eventId === current?.event_id) || null;
  if (!match) return null;
  return current?.content_hash && match.contentHash !== current.content_hash ? null : match;
}
function resolveCampaign(current, draftOverride = null){
  const storedCandidate = record(current?.candidate), deployed = deployedCandidate(current), candidate = deployed ? {
    ...storedCandidate,
    ...deployed,
    material:{ ...record(storedCandidate.material), ...record(deployed.material) },
    source:{ ...record(storedCandidate.source), ...record(deployed.source) },
    timing:{ ...record(storedCandidate.timing), ...record(deployed.timing) },
    participation:{ ...record(storedCandidate.participation), ...record(deployed.participation) },
    drafts:mergeDraft(storedCandidate.drafts, deployed.drafts),
  } : storedCandidate;
  return { ...current, candidate, draft_copy:mergeDraft(candidate.drafts, current?.draft_copy, draftOverride) };
}
function campaignPayload(candidate, state = candidate.state){
  return {
    campaign_id:candidate.campaignId, event_id:candidate.eventId, source_revision:candidate.source.revision,
    campaign_revision:candidate.campaignRevision, content_hash:candidate.contentHash, state,
    candidate, draft_copy:candidate.drafts, proposed_send_at:candidate.proposedSendAt, late:candidate.late,
    updated_at:new Date().toISOString(),
  };
}
function editableState(state){ return ["watching", "draft", "needs_review", "needs_reapproval", "failed", "connector_blocked"].includes(state); }
function paragraphs(value){
  const source = Array.isArray(value) ? value : String(value || "").split(/\n\s*\n/);
  return source.map(item => clean(item, 4000)).filter(Boolean).slice(0, 8);
}
function cta(value, fallbackLabel = ""){
  const label = clean(value?.label || fallbackLabel, 120);
  const url = clean(value?.url, 2000);
  return label && /^https:\/\//i.test(url) ? { label, url } : null;
}
function plainTextFor({ headline, bodyParagraphs, timingLine, broadcastLine, primaryCta, secondaryCta }){
  return [
    headline,
    ...bodyParagraphs,
    timingLine,
    broadcastLine,
    primaryCta ? `${primaryCta.label}: ${primaryCta.url}` : "",
    secondaryCta ? `${secondaryCta.label}: ${secondaryCta.url}` : "",
  ].filter(Boolean).join("\n\n");
}
function mailchimpPack(current, exportedAt = new Date().toISOString()){
  const resolved = resolveCampaign(current);
  const candidate = resolved.candidate || {};
  const draft = resolved.draft_copy || candidate.drafts || {};
  const email = draft.email || {};
  const instagram = draft.instagram || {};
  const material = candidate.material || {};
  const image = email.image || instagram.image || {};
  const subject = clean(email.subject, 150);
  const previewText = clean(email.preheader, 150);
  const headline = clean(email.headline || material.title, 240);
  const bodyParagraphs = paragraphs(email.bodyParagraphs || email.body);
  const timingLine = clean(email.timingLine, 500);
  const broadcastLine = clean(email.broadcastLine, 500);
  const primaryCta = cta(Object.keys(record(email.primaryCta)).length ? email.primaryCta : { label:"Open the fixture", url:candidate.participation?.fixtureUrl }, "Open the fixture");
  const secondaryCta = cta(email.secondaryCta, "Rate it after the finish");
  const rawImageUrl = clean(image.publicUrl || image.path, 2000);
  const imageUrl = /^\/assets\//.test(rawImageUrl) ? `https://nothingsport.vercel.app${rawImageUrl}` : rawImageUrl;
  const altText = clean(image.altText || instagram.altText, 1000);
  const missing = [!subject&&"subject",!previewText&&"preview text",!headline&&"headline",!bodyParagraphs.length&&"body",!primaryCta&&"fixture link",!/^https:\/\//i.test(imageUrl)&&"image",!altText&&"alt text"].filter(Boolean);
  if (missing.length){
    throw new CommsError(`Complete or sync the following Mailchimp fields before export: ${missing.join(", ")}.`, 409, "mailchimp_export_incomplete");
  }
  const pack = {
    schemaVersion:EXPORT_SCHEMA_VERSION,
    campaignId:clean(current.campaign_id, 80),
    campaignRevision:Number(current.campaign_revision || 1),
    contentHash:clean(current.content_hash, 64),
    exportedAt:new Date(exportedAt).toISOString(),
    suggestedSendAt:{
      utc:clean(current.proposed_send_at, 64),
      sydney:email.suggestedSendAt?.sydney || marquee.sydneyParts(current.proposed_send_at),
    },
    subject, previewText, headline, bodyParagraphs, timingLine, broadcastLine,
    primaryCta, secondaryCta,
    image:{
      url:imageUrl,
      path:clean(image.path, 2000),
      altText,
      width:Number(image.width || 0),
      height:Number(image.height || 0),
      mimeType:clean(image.mimeType, 100),
    },
    plainText:plainTextFor({ headline, bodyParagraphs, timingLine, broadcastLine, primaryCta, secondaryCta }),
    source:{
      name:clean(candidate.source?.name, 500),
      url:clean(candidate.source?.url, 2000),
      checkedAt:clean(candidate.source?.checkedAt, 64),
      revision:clean(candidate.source?.revision, 500),
    },
    fixture:{
      eventId:clean(current.event_id, 500),
      title:clean(material.title, 500),
      startTimeUtc:clean(candidate.timing?.startTimeUtc, 64),
      endTimeUtc:clean(candidate.timing?.endTimeUtc, 64),
      fixtureUrl:primaryCta.url,
    },
    social:{ caption:clean(instagram.caption, 2200), altText:clean(instagram.altText, 1000) },
  };
  return pack;
}
function exportTransition(current, user, now = new Date().toISOString()){
  if (current?.state === "exported" && current.export_snapshot && !current.export_stale){
    return { idempotent:true, pack:current.export_snapshot, patch:null };
  }
  if (!current || (!editableState(current.state) && current.state !== "approved")){
    throw new CommsError("This campaign cannot be exported in its current state.", 409, "campaign_not_exportable");
  }
  const resolved = resolveCampaign({ ...current, draft_copy:current.approved_copy || current.draft_copy });
  if (resolved.candidate?.readyForExport === false){
    throw new CommsError("This 5/5 candidate is still watching for an exact fixture and confirmed Sydney start time.", 409, "campaign_not_ready_for_export");
  }
  const pack = mailchimpPack(resolved, now);
  return {
    idempotent:false,
    pack,
    patch:{
      state:"exported",
      approved_by:user.id,
      approved_at:pack.exportedAt,
      approved_copy:resolved.draft_copy,
      exported_by:user.id,
      exported_at:pack.exportedAt,
      export_snapshot:pack,
      export_format:EXPORT_SCHEMA_VERSION,
      export_stale:false,
      updated_at:pack.exportedAt,
    },
  };
}
function reopenTransition(current, now = new Date().toISOString()){
  if (!current || !["exported", "approved"].includes(current.state)){
    throw new CommsError("Only a frozen export can be reopened.", 409, "campaign_not_reopenable");
  }
  return {
    state:"needs_review",
    draft_copy:current.approved_copy || current.draft_copy,
    campaign_revision:Number(current.campaign_revision || 1) + 1,
    approved_by:null,
    approved_at:null,
    approved_copy:null,
    export_stale:Boolean(current.exported_at || current.export_snapshot),
    updated_at:new Date(now).toISOString(),
  };
}
function dismissTransition(current, now = new Date().toISOString()){
  if (!current) throw new CommsError("Campaign not found.", 404, "campaign_not_found");
  if (current.state === "cancelled") return null;
  const resolved = resolveCampaign(current), timestamp = new Date(now).toISOString();
  return {
    state:"cancelled",
    draft_copy:{ ...resolved.draft_copy, cms:{ ...record(resolved.draft_copy?.cms), previousState:current.state, dismissedAt:timestamp, restoredAt:null } },
    updated_at:timestamp,
  };
}
function restoreTransition(current, now = new Date().toISOString()){
  if (!current || current.state !== "cancelled") throw new CommsError("Only a dismissed campaign can be restored.", 409, "campaign_not_dismissed");
  const resolved = resolveCampaign(current), previousState=clean(resolved.draft_copy?.cms?.previousState, 40);
  const restorableState=marquee.CAMPAIGN_STATES.includes(previousState)&&previousState!=="cancelled"?previousState:(resolved.candidate?.state||"watching");
  return {
    state:restorableState,
    draft_copy:{ ...resolved.draft_copy, cms:{ ...record(resolved.draft_copy?.cms), dismissedAt:null, restoredAt:new Date(now).toISOString() } },
    updated_at:new Date(now).toISOString(),
  };
}
function syncPatch(current, candidate){
  const materialChanged = current.content_hash !== candidate.contentHash;
  const published = Boolean(current.published_at) || ["published", "partially_published"].includes(current.state);
  const next = campaignPayload(candidate, current.state === "cancelled" ? "cancelled" : (materialChanged ? "needs_reapproval" : current.state));
  if (materialChanged){
    Object.assign(next, {
      draft_copy:mergeDraft(candidate.drafts, current.draft_copy),
      campaign_revision:Number(current.campaign_revision || 1) + 1,
      approved_by:null,
      approved_at:null,
      approved_copy:null,
      scheduled_at:null,
      correction_required:published,
      export_stale:Boolean(current.exported_at || current.export_snapshot),
    });
  } else {
    delete next.draft_copy;
    next.campaign_revision=current.campaign_revision;
  }
  return { patch:next, outcome:materialChanged ? (published ? "correction_required" : "approval_revoked") : "unchanged" };
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
    const transition = syncPatch(current, candidate);
    await supabaseServiceRequest(rowsPath(CAMPAIGNS, { campaign_id:`eq.${candidate.campaignId}` }), { method:"PATCH", headers:{ Prefer:"return=minimal" }, body:transition.patch });
    synced.push({ campaignId:candidate.campaignId, outcome:transition.outcome });
  }
  return { schemaVersion:source.schemaVersion, sourceRevision:source.sourceRevision, synced };
}
async function queuePayload(){
  const campaigns = await rows(CAMPAIGNS, { select:"campaign_id,event_id,source_revision,campaign_revision,content_hash,state,candidate,draft_copy,approved_copy,proposed_send_at,approved_at,exported_at,export_snapshot,export_format,export_stale,scheduled_at,published_at,correction_required,late,updated_at", order:"proposed_send_at.asc" });
  return { schemaVersion:marquee.SCHEMA_VERSION, exportSchemaVersion:EXPORT_SCHEMA_VERSION, campaigns:campaigns.map(item => resolveCampaign(item)) };
}
async function campaign(id){ return (await rows(CAMPAIGNS, { campaign_id:`eq.${clean(id,80)}`, select:"*", limit:"1" }))[0] || null; }
async function editCampaign(body){
  const current = await campaign(body.campaignId);
  if (!current) throw new CommsError("Campaign not found.", 404, "campaign_not_found");
  if (!editableState(current.state) || current.approved_at) throw new CommsError("Exported campaign copy is frozen.", 409, "campaign_copy_frozen");
  const copy = body.draftCopy && typeof body.draftCopy === "object" ? body.draftCopy : null;
  if (!copy) throw new CommsError("Draft copy is required.", 400, "draft_copy_required");
  const completeCopy = resolveCampaign(current, copy).draft_copy;
  const serialized = JSON.stringify(completeCopy);
  if (Buffer.byteLength(serialized) > 64 * 1024) throw new CommsError("Draft copy is too large.", 413, "draft_copy_too_large");
  await supabaseServiceRequest(rowsPath(CAMPAIGNS, { campaign_id:`eq.${current.campaign_id}` }), { method:"PATCH", headers:{ Prefer:"return=minimal" }, body:{ draft_copy:completeCopy, campaign_revision:Number(current.campaign_revision)+1, state:"needs_review", updated_at:new Date().toISOString() } });
  return { updated:true };
}
async function exportCampaign(body, user){
  let current = await campaign(body.campaignId);
  if (!current) throw new CommsError("Campaign not found.", 404, "campaign_not_found");
  if (body.draftCopy && typeof body.draftCopy === "object"){
    if (!editableState(current.state) || current.approved_at) throw new CommsError("Exported campaign copy is frozen.", 409, "campaign_copy_frozen");
    current = { ...current, draft_copy:resolveCampaign(current, body.draftCopy).draft_copy, campaign_revision:Number(current.campaign_revision || 1) + 1 };
  }
  const transition = exportTransition(current, user);
  if (transition.patch){
    const patch = body.draftCopy ? { ...transition.patch, draft_copy:current.draft_copy, campaign_revision:current.campaign_revision } : transition.patch;
    await supabaseServiceRequest(rowsPath(CAMPAIGNS, { campaign_id:`eq.${current.campaign_id}` }), { method:"PATCH", headers:{ Prefer:"return=minimal" }, body:patch });
  }
  return { ...transition.pack, idempotent:transition.idempotent };
}
async function reopenExport(body){
  const current = await campaign(body.campaignId);
  if (!current) throw new CommsError("Campaign not found.", 404, "campaign_not_found");
  const patch = reopenTransition(current);
  await supabaseServiceRequest(rowsPath(CAMPAIGNS, { campaign_id:`eq.${current.campaign_id}` }), { method:"PATCH", headers:{ Prefer:"return=minimal" }, body:patch });
  return { reopened:true, campaignId:current.campaign_id, campaignRevision:patch.campaign_revision };
}
async function changeDismissal(body, restore = false){
  const current = await campaign(body.campaignId);
  const patch = restore ? restoreTransition(current) : dismissTransition(current);
  if (patch) await supabaseServiceRequest(rowsPath(CAMPAIGNS, { campaign_id:`eq.${current.campaign_id}` }), { method:"PATCH", headers:{ Prefer:"return=minimal" }, body:patch });
  return { campaignId:current?.campaign_id || clean(body.campaignId,80), dismissed:!restore, restored:restore, idempotent:!patch };
}

module.exports = async function commsHandler(request, response){
  const mode = clean(request?.query?.mode, 40);
  if (mode === "admin-users") return adminApi.usersHandler(request, response);
  if (mode === "admin-reports") return adminApi.reportsHandler(request, response);
  privateHeaders(response);
  try{
    if (!["GET", "POST"].includes(request.method || "GET")){ response.setHeader("Allow", "GET, POST"); response.status(405).json({ error:"Comms supports GET and POST only.", code:"method_not_allowed" }); return; }
    const user = await adminUser(request);
    if ((request.method || "GET") === "GET"){ response.status(200).json(await queuePayload()); return; }
    const body = bodyOf(request);
    let payload;
    if (body.action === "sync-candidates") payload = await syncCandidates();
    else if (body.action === "edit") payload = await editCampaign(body);
    else if (body.action === "export-mailchimp") payload = await exportCampaign(body, user);
    else if (body.action === "reopen-export") payload = await reopenExport(body);
    else if (body.action === "dismiss-campaign") payload = await changeDismissal(body, false);
    else if (body.action === "restore-campaign") payload = await changeDismissal(body, true);
    else throw new CommsError("Unknown communications action.", 400, "unknown_comms_action");
    response.status(200).json(payload);
  }catch(error){
    if (error instanceof CommsError){ response.status(error.status).json({ error:error.message, code:error.code }); return; }
    if (error instanceof SupabaseRequestError){ const outgoing = publicError(error); response.status(outgoing.status).json(outgoing.body); return; }
    response.status(500).json({ error:"Marquee communications are temporarily unavailable.", code:"comms_unavailable" });
  }
};

module.exports._test = Object.freeze({
  CommsError, EXPORT_SCHEMA_VERSION, campaignPayload, dismissTransition, editableState, exportTransition,
  isAdminRole, mailchimpPack, mergeDraft, resolveCampaign, reopenTransition, restoreTransition, syncPatch,
});
