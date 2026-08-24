"use strict";

const crypto = require("node:crypto");
const {
  authenticatedUser,
  bearerToken,
  publicError,
  supabaseServiceRequest,
} = require("../lib/supabase-server");

function privateHeaders(response){
  response.setHeader("Cache-Control", "private, no-store, max-age=0");
  response.setHeader("Vary", "Authorization");
}

function bodyOf(request){
  if (request?.body && typeof request.body === "object") return request.body;
  try{ return JSON.parse(request?.body || "{}"); }catch(_error){ return {}; }
}

function clean(value, maximum = 180){
  return String(value || "").trim().slice(0, maximum);
}

function sha256(value){
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function validUuid(value){
  const candidate = clean(value, 40).toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(candidate) ? candidate : "";
}

function validHttps(value){
  try{
    const parsed = new URL(clean(value, 4096));
    return parsed.protocol === "https:" ? parsed.toString() : "";
  }catch(_error){ return ""; }
}

async function optionalUser(request){
  const token = bearerToken(request);
  if (!token) return null;
  return authenticatedUser(token);
}

async function installationFor(id){
  const rows = await supabaseServiceRequest(`/rest/v1/nothingsports_push_installations?installation_id=eq.${encodeURIComponent(id)}&select=*`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function verifiedInstallation(id, secret){
  const installation = await installationFor(id);
  if (!installation || !secret || installation.secret_hash !== sha256(secret)){
    const error = new Error("This notification installation could not be verified.");
    error.status = 401;
    error.payload = { code:"invalid_installation" };
    throw error;
  }
  return installation;
}

module.exports = async function notificationsHandler(request, response){
  privateHeaders(response);
  try{
    if ((request.method || "GET") === "GET"){
      response.status(200).json({
        configured:Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY),
        publicKey:clean(process.env.VAPID_PUBLIC_KEY, 256),
        leadMinutes:15,
      });
      return;
    }
    if (request.method !== "POST"){
      response.setHeader("Allow", "GET, POST");
      response.status(405).json({ error:"Notifications supports GET and POST only.", code:"method_not_allowed" });
      return;
    }

    const body = bodyOf(request);
    const installationId = validUuid(body.installationId);
    const secret = clean(body.secret, 256);
    if (!installationId || secret.length < 32){
      response.status(400).json({ error:"A valid notification installation is required.", code:"invalid_installation" });
      return;
    }
    const user = await optionalUser(request);

    if (body.action === "register"){
      const subscription = body.subscription && typeof body.subscription === "object" ? body.subscription : {};
      const endpoint = validHttps(subscription.endpoint);
      const p256dh = clean(subscription.keys?.p256dh, 1024);
      const authKey = clean(subscription.keys?.auth, 1024);
      if (!endpoint || !p256dh || !authKey){
        response.status(400).json({ error:"That browser push subscription is incomplete.", code:"invalid_subscription" });
        return;
      }
      const existing = await installationFor(installationId);
      if (existing && existing.secret_hash !== sha256(secret)){
        response.status(401).json({ error:"This notification installation could not be verified.", code:"invalid_installation" });
        return;
      }
      const matchingEndpoint = await supabaseServiceRequest(`/rest/v1/nothingsports_push_installations?endpoint=eq.${encodeURIComponent(endpoint)}&select=installation_id,secret_hash`);
      if (matchingEndpoint?.[0] && matchingEndpoint[0].installation_id !== installationId && matchingEndpoint[0].secret_hash !== sha256(secret)){
        response.status(409).json({ error:"That push subscription belongs to another installation.", code:"subscription_conflict" });
        return;
      }
      await supabaseServiceRequest("/rest/v1/nothingsports_push_installations?on_conflict=installation_id", {
        method:"POST",
        headers:{ Prefer:"resolution=merge-duplicates,return=minimal" },
        body:{
          installation_id:installationId,
          user_id:user?.id || existing?.user_id || null,
          secret_hash:sha256(secret),
          endpoint,
          p256dh,
          auth_key:authKey,
          timezone:clean(body.timezone, 80) || "Australia/Sydney",
          user_agent:clean(request.headers?.["user-agent"], 512),
          permission:"granted",
          updated_at:new Date().toISOString(),
          last_seen_at:new Date().toISOString(),
        },
      });
      response.status(200).json({ registered:true, installationId });
      return;
    }

    const installation = await verifiedInstallation(installationId, secret);
    if (body.action === "unregister"){
      await supabaseServiceRequest(`/rest/v1/nothingsports_push_installations?installation_id=eq.${encodeURIComponent(installationId)}`, { method:"DELETE" });
      response.status(200).json({ unregistered:true });
      return;
    }
    if (body.action === "remind"){
      const eventId = clean(body.eventId);
      const title = clean(body.title);
      const startsAt = new Date(body.startsAt);
      if (!eventId || !title || !Number.isFinite(startsAt.getTime()) || startsAt.getTime() <= Date.now()){
        response.status(400).json({ error:"The sporting start must be a future time.", code:"invalid_sporting_start" });
        return;
      }
      const remindAt = new Date(startsAt.getTime() - 15 * 60 * 1000);
      const viewingUrl = body.viewingUrl ? validHttps(body.viewingUrl) : null;
      await supabaseServiceRequest("/rest/v1/nothingsports_reminders?on_conflict=installation_id,event_id", {
        method:"POST",
        headers:{ Prefer:"resolution=merge-duplicates,return=minimal" },
        body:{
          installation_id:installationId,
          user_id:user?.id || installation.user_id || null,
          event_id:eventId,
          title,
          starts_at:startsAt.toISOString(),
          remind_at:remindAt.toISOString(),
          viewing_url:viewingUrl,
          fallback_to_broadcast:Boolean(body.fallbackToBroadcast),
          dispatched_at:null,
          attempts:0,
          last_error:null,
          updated_at:new Date().toISOString(),
        },
      });
      response.status(200).json({ reminded:true, eventId, startsAt:startsAt.toISOString(), remindAt:remindAt.toISOString(), leadMinutes:15 });
      return;
    }

    if (body.action === "cancel"){
      const eventId = clean(body.eventId);
      await supabaseServiceRequest(`/rest/v1/nothingsports_reminders?installation_id=eq.${encodeURIComponent(installationId)}&event_id=eq.${encodeURIComponent(eventId)}`, { method:"DELETE" });
      response.status(200).json({ cancelled:true, eventId });
      return;
    }

    response.status(400).json({ error:"Unknown notification action.", code:"unknown_notification_action" });
  }catch(error){
    if (Number(error?.status) >= 400 && Number(error?.status) <= 499){
      response.status(Number(error.status)).json({ error:error.message || "Notification request failed.", code:error?.payload?.code || "notification_request_failed" });
      return;
    }
    const outgoing = publicError(error);
    response.status(outgoing.status).json(outgoing.body);
  }
};
