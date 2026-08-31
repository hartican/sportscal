"use strict";

const crypto = require("node:crypto");
const webpush = require("web-push");
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

function sameInstant(first, second){
  const firstTime = Date.parse(first || "");
  const secondTime = Date.parse(second || "");
  return Number.isFinite(firstTime) && Number.isFinite(secondTime) && firstTime === secondTime;
}

function reminderDeliveryReset(existing, startsAt, deliveryMode){
  if (existing && sameInstant(existing.starts_at, startsAt) && String(existing.delivery_mode || "match-15") === deliveryMode) return {};
  return { dispatched_at:null, claimed_at:null, attempts:0, last_error:null };
}

function validDeliveryMode(value){
  const mode = clean(value, 24) || "match-15";
  return ["match-15", "broadcast-15", "session-start"].includes(mode) ? mode : "";
}

function platformLabel(userAgent){
  const value = String(userAgent || "");
  if (/iPhone|iPad|iPod/i.test(value)) return "iPhone or iPad";
  if (/Android/i.test(value)) return "Android";
  if (/Macintosh|Mac OS X/i.test(value)) return "Mac";
  if (/Windows/i.test(value)) return "Windows";
  return "Browser";
}

function installationPreference(body, requestField, existing, databaseField){
  if (Object.hasOwn(body, requestField)) return body[requestField] !== false;
  return existing ? existing[databaseField] !== false : true;
}

async function enabledInstallationIds(user, installation){
  if (!user) return [installation.installation_id];
  if (installation.user_id !== user.id){
    const error = new Error("This notification installation is not registered to the signed-in account.");
    error.status = 403;
    error.payload = { code:"installation_account_mismatch" };
    throw error;
  }
  const rows = await supabaseServiceRequest(`/rest/v1/nothingsports_push_installations?user_id=eq.${encodeURIComponent(user.id)}&permission=eq.granted&select=installation_id`);
  return [...new Set((rows || []).map(row => validUuid(row.installation_id)).filter(Boolean))];
}

async function existingReminders(installationIds, eventId){
  if (!installationIds.length) return new Map();
  const rows = await supabaseServiceRequest(`/rest/v1/nothingsports_reminders?installation_id=in.(${installationIds.map(encodeURIComponent).join(",")})&event_id=eq.${encodeURIComponent(eventId)}&select=installation_id,starts_at,delivery_mode,dispatched_at,claimed_at,attempts,last_error`);
  return new Map((rows || []).map(row => [row.installation_id, row]));
}

async function notificationsHandler(request, response){
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
    const user = await optionalUser(request);
    if (body.action === "cancel" && user){
      const eventId = clean(body.eventId);
      if (!eventId){
        response.status(400).json({ error:"An event is required to cancel a reminder.", code:"invalid_event" });
        return;
      }
      await supabaseServiceRequest(`/rest/v1/nothingsports_reminders?user_id=eq.${encodeURIComponent(user.id)}&event_id=eq.${encodeURIComponent(eventId)}`, { method:"DELETE" });
      response.status(200).json({ cancelled:true, eventId });
      return;
    }
    const installationId = validUuid(body.installationId);
    const secret = clean(body.secret, 256);
    if (!installationId || secret.length < 32){
      response.status(400).json({ error:"A valid notification installation is required.", code:"invalid_installation" });
      return;
    }
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
          user_id:user?.id || null,
          secret_hash:sha256(secret),
          endpoint,
          p256dh,
          auth_key:authKey,
          timezone:clean(body.timezone, 80) || "Australia/Sydney",
          user_agent:clean(request.headers?.["user-agent"], 512),
          permission:"granted",
          chat_alerts_enabled:installationPreference(body, "chatAlertsEnabled", existing, "chat_alerts_enabled"),
          badges_enabled:installationPreference(body, "badgesEnabled", existing, "badges_enabled"),
          updated_at:new Date().toISOString(),
          last_seen_at:new Date().toISOString(),
        },
      });
      response.status(200).json({ registered:true, installationId });
      return;
    }

    const installation = await verifiedInstallation(installationId, secret);
    if (body.action === "status"){
      const installationIds = await enabledInstallationIds(user, installation);
      const encodedIds = installationIds.map(encodeURIComponent).join(",");
      const [installations, reminders, tests, health] = await Promise.all([
        installationIds.length ? supabaseServiceRequest(`/rest/v1/nothingsports_push_installations?installation_id=in.(${encodedIds})&select=installation_id,permission,user_agent,last_seen_at,updated_at`) : [],
        installationIds.length ? supabaseServiceRequest(`/rest/v1/nothingsports_reminders?installation_id=in.(${encodedIds})&dispatched_at=is.null&starts_at=gte.${encodeURIComponent(new Date().toISOString())}&order=remind_at.asc&select=event_id,title,starts_at,remind_at,delivery_mode,attempts,last_error`) : [],
        supabaseServiceRequest(`/rest/v1/nothingsports_notification_tests?installation_id=eq.${encodeURIComponent(installationId)}&order=requested_at.desc&limit=1&select=test_id,requested_at,dispatched_at,received_at,last_error`),
        supabaseServiceRequest("/rest/v1/nothingsports_notification_dispatch_health?health_id=eq.dispatcher&limit=1&select=*"),
      ]);
      response.status(200).json({
        configured:true,
        installations:(installations || []).map(row => ({ installationId:row.installation_id, platform:platformLabel(row.user_agent), permission:row.permission, lastSeenAt:row.last_seen_at || row.updated_at })),
        reminders:{
          pending:(reminders || []).length,
          failed:(reminders || []).filter(row => row.last_error).length,
          next:(reminders || []).slice(0, 5).map(row => ({ eventId:row.event_id, title:row.title, startsAt:row.starts_at, remindAt:row.remind_at, deliveryMode:row.delivery_mode, attempts:Number(row.attempts || 0), error:row.last_error || null })),
        },
        dispatcher:(health || [])[0] || null,
        latestTest:(tests || [])[0] || null,
      });
      return;
    }
    if (body.action === "receipt"){
      const testId = validUuid(body.testId);
      if (!testId){
        response.status(400).json({ error:"A valid notification test is required.", code:"invalid_notification_test" });
        return;
      }
      await supabaseServiceRequest(`/rest/v1/nothingsports_notification_tests?test_id=eq.${encodeURIComponent(testId)}&installation_id=eq.${encodeURIComponent(installationId)}`, {
        method:"PATCH",
        headers:{ Prefer:"return=minimal" },
        body:{ received_at:new Date().toISOString() },
      });
      response.status(200).json({ received:true, testId });
      return;
    }
    if (body.action === "test"){
      const created = await supabaseServiceRequest("/rest/v1/nothingsports_notification_tests", {
        method:"POST",
        headers:{ Prefer:"return=representation" },
        body:{ installation_id:installationId },
      });
      const testId = validUuid(created?.[0]?.test_id);
      if (!testId) throw new Error("The notification test could not be recorded.");
      try{
        webpush.setVapidDetails(String(process.env.VAPID_SUBJECT || "https://nothingsport.vercel.app/"), String(process.env.VAPID_PUBLIC_KEY), String(process.env.VAPID_PRIVATE_KEY));
        await webpush.sendNotification({ endpoint:installation.endpoint, keys:{ p256dh:installation.p256dh, auth:installation.auth_key } }, JSON.stringify({
          kind:"test",
          testId,
          title:"Nothing Sport test",
          body:"System notifications are reaching this device.",
          tag:`nothingsport-test-${testId}`,
          url:"/?notificationTest=received",
        }), { TTL:300, urgency:"high" });
        const dispatchedAt = new Date().toISOString();
        await supabaseServiceRequest(`/rest/v1/nothingsports_notification_tests?test_id=eq.${encodeURIComponent(testId)}`, { method:"PATCH", headers:{ Prefer:"return=minimal" }, body:{ dispatched_at:dispatchedAt, last_error:null } });
        response.status(200).json({ sent:true, testId, dispatchedAt });
      }catch(error){
        await supabaseServiceRequest(`/rest/v1/nothingsports_notification_tests?test_id=eq.${encodeURIComponent(testId)}`, { method:"PATCH", headers:{ Prefer:"return=minimal" }, body:{ last_error:clean(error?.message || "Push delivery failed.", 500) } }).catch(() => null);
        response.status(502).json({ error:"The test notification could not be delivered to this device.", code:"notification_test_failed", testId });
      }
      return;
    }
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
      const deliveryMode = validDeliveryMode(body.deliveryMode);
      if (!deliveryMode){
        response.status(400).json({ error:"That reminder timing mode is not supported.", code:"invalid_delivery_mode" });
        return;
      }
      const leadMinutes = deliveryMode === "session-start" ? 0 : 15;
      const remindAt = new Date(startsAt.getTime() - leadMinutes * 60 * 1000);
      if (remindAt.getTime() <= Date.now()){
        response.status(409).json({ error:leadMinutes ? "It is already less than 15 minutes before this sport starts." : "That published session has already started.", code:"reminder_window_passed" });
        return;
      }
      const viewingUrl = body.viewingUrl ? validHttps(body.viewingUrl) : null;
      const installationIds = await enabledInstallationIds(user, installation);
      if (!installationIds.length){
        response.status(409).json({ error:"This account has no enabled notification installations.", code:"no_enabled_installations" });
        return;
      }
      const existingByInstallation = await existingReminders(installationIds, eventId);
      await Promise.all(installationIds.map(targetInstallationId => (
        supabaseServiceRequest("/rest/v1/nothingsports_reminders?on_conflict=installation_id,event_id", {
          method:"POST",
          headers:{ Prefer:"resolution=merge-duplicates,return=minimal" },
          body:{
          installation_id:targetInstallationId,
          user_id:user?.id || null,
          event_id:eventId,
          title,
          starts_at:startsAt.toISOString(),
          remind_at:remindAt.toISOString(),
          delivery_mode:deliveryMode,
          viewing_url:viewingUrl,
          fallback_to_broadcast:Boolean(body.fallbackToBroadcast),
          ...reminderDeliveryReset(existingByInstallation.get(targetInstallationId), startsAt.toISOString(), deliveryMode),
          updated_at:new Date().toISOString(),
          },
        })
      )));
      response.status(200).json({ reminded:true, eventId, startsAt:startsAt.toISOString(), remindAt:remindAt.toISOString(), leadMinutes, deliveryMode, installations:installationIds.length });
      return;
    }

    if (body.action === "cancel"){
      const eventId = clean(body.eventId);
      if (!eventId){
        response.status(400).json({ error:"An event is required to cancel a reminder.", code:"invalid_event" });
        return;
      }
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
}

module.exports = notificationsHandler;
module.exports._test = { platformLabel, reminderDeliveryReset, sameInstant, validDeliveryMode };
