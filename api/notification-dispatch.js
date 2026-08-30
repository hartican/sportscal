"use strict";

const webpush = require("web-push");
const { publicError, supabaseServiceRequest } = require("../lib/supabase-server");

function bearer(request){
  const header = String(request?.headers?.authorization || "");
  return /^Bearer\s+/i.test(header) ? header.replace(/^Bearer\s+/i, "").trim() : "";
}

const CLAIM_STALE_MS = 10 * 60 * 1000;

function claimFilter(id, staleBefore){
  return `/rest/v1/nothingsports_reminders?id=eq.${encodeURIComponent(id)}&dispatched_at=is.null&or=(claimed_at.is.null,claimed_at.lt.${encodeURIComponent(staleBefore)})&select=*`;
}

async function claimReminder(reminder, claimedAt, staleBefore){
  const rows = await supabaseServiceRequest(claimFilter(reminder.id, staleBefore), {
    method:"PATCH",
    headers:{ Prefer:"return=representation" },
    body:{ claimed_at:claimedAt, updated_at:claimedAt },
  });
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function patchClaimedReminder(id, claimedAt, body){
  return supabaseServiceRequest(`/rest/v1/nothingsports_reminders?id=eq.${encodeURIComponent(id)}&claimed_at=eq.${encodeURIComponent(claimedAt)}`, {
    method:"PATCH",
    headers:{ Prefer:"return=minimal" },
    body:{ ...body, updated_at:new Date().toISOString() },
  });
}

module.exports = async function notificationDispatchHandler(request, response){
  response.setHeader("Cache-Control", "no-store");
  try{
    if ((request.method || "GET") !== "GET"){
      response.setHeader("Allow", "GET");
      response.status(405).json({ error:"Notification dispatch supports GET only." });
      return;
    }
    const cronSecret = String(process.env.CRON_SECRET || "");
    if (!cronSecret || bearer(request) !== cronSecret){
      response.status(401).json({ error:"Notification dispatch is not authorised.", code:"unauthorised" });
      return;
    }
    const publicKey = String(process.env.VAPID_PUBLIC_KEY || "");
    const privateKey = String(process.env.VAPID_PRIVATE_KEY || "");
    if (!publicKey || !privateKey) throw Object.assign(new Error("Web Push is not configured."), { status:503, payload:{ code:"push_not_configured" } });
    webpush.setVapidDetails(String(process.env.VAPID_SUBJECT || "https://nothingsport.vercel.app/"), publicKey, privateKey);

    const now = new Date();
    const oldest = new Date(now.getTime() - 60 * 60 * 1000);
    const staleBefore = new Date(now.getTime() - CLAIM_STALE_MS).toISOString();
    const reminders = await supabaseServiceRequest(`/rest/v1/nothingsports_reminders?dispatched_at=is.null&remind_at=lte.${encodeURIComponent(now.toISOString())}&remind_at=gte.${encodeURIComponent(oldest.toISOString())}&or=(claimed_at.is.null,claimed_at.lt.${encodeURIComponent(staleBefore)})&order=remind_at.asc&limit=100&select=*`);
    const claimed = [];
    for (const reminder of reminders || []){
      const claimedAt = new Date().toISOString();
      const row = await claimReminder(reminder, claimedAt, staleBefore);
      if (row) claimed.push({ reminder:row, claimedAt });
    }
    const ids = [...new Set(claimed.map(item => item.reminder.installation_id).filter(Boolean))];
    const installationRows = ids.length
      ? await supabaseServiceRequest(`/rest/v1/nothingsports_push_installations?installation_id=in.(${ids.map(encodeURIComponent).join(",")})&select=*`)
      : [];
    const installations = new Map((installationRows || []).map(item => [item.installation_id, item]));
    let sent = 0;
    let failed = 0;
    for (const claim of claimed){
      const { reminder, claimedAt } = claim;
      const installation = installations.get(reminder.installation_id);
      if (!installation){
        failed += 1;
        await patchClaimedReminder(reminder.id, claimedAt, { claimed_at:null, attempts:Number(reminder.attempts || 0) + 1, last_error:"Push installation is unavailable." });
        continue;
      }
      try{
        const startLabel = new Intl.DateTimeFormat("en-AU", { hour:"numeric", minute:"2-digit", timeZone:installation.timezone || "Australia/Sydney" }).format(new Date(reminder.starts_at));
        await webpush.sendNotification({
          endpoint:installation.endpoint,
          keys:{ p256dh:installation.p256dh, auth:installation.auth_key },
        }, JSON.stringify({
          title:`Starts in 15 minutes: ${reminder.title}`,
          body:`Sporting start at ${startLabel}. Tap to open Nothing Sport.`,
          tag:`nothingsport-${reminder.event_id}`,
          url:reminder.viewing_url || `/?event=${encodeURIComponent(reminder.event_id)}`,
        }), { TTL:900, urgency:"high", topic:String(reminder.event_id).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || undefined });
        sent += 1;
        await patchClaimedReminder(reminder.id, claimedAt, { claimed_at:null, dispatched_at:new Date().toISOString(), attempts:Number(reminder.attempts || 0) + 1, last_error:null });
      }catch(error){
        failed += 1;
        const status = Number(error?.statusCode || 0);
        await patchClaimedReminder(reminder.id, claimedAt, { claimed_at:null, attempts:Number(reminder.attempts || 0) + 1, last_error:String(error?.message || "Push delivery failed.").slice(0, 500) });
        if (status === 404 || status === 410){
          await supabaseServiceRequest(`/rest/v1/nothingsports_push_installations?installation_id=eq.${encodeURIComponent(installation.installation_id)}`, { method:"DELETE" });
        }
      }
    }
    response.status(200).json({ checked:(reminders || []).length, claimed:claimed.length, sent, failed, at:now.toISOString() });
  }catch(error){
    const outgoing = publicError(error);
    response.status(outgoing.status).json(outgoing.body);
  }
};

module.exports._test = { CLAIM_STALE_MS, claimFilter };
