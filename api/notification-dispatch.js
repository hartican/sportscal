"use strict";

const webpush = require("web-push");
const {guardedSend,suppressed}=require("../lib/notification-send");
const { publicError, supabaseMaintenanceMode, supabaseServiceRequest } = require("../lib/supabase-server");

function bearer(request){
  const header = String(request?.headers?.authorization || "");
  return /^Bearer\s+/i.test(header) ? header.replace(/^Bearer\s+/i, "").trim() : "";
}

const CLAIM_STALE_MS = 10 * 60 * 1000;

async function patchClaimedReminder(id, claimedAt, body, serviceRequest=supabaseServiceRequest){
  return serviceRequest(`/rest/v1/nothingsports_reminders?id=eq.${encodeURIComponent(id)}&claimed_at=eq.${encodeURIComponent(claimedAt)}`, {
    method:"PATCH",
    headers:{ Prefer:"return=minimal" },
    body:{ ...body, updated_at:new Date().toISOString() },
  });
}

async function recordDispatchHealth(body){
  return supabaseServiceRequest("/rest/v1/nothingsports_notification_dispatch_health?on_conflict=health_id", {
    method:"POST",
    headers:{ Prefer:"resolution=merge-duplicates,return=minimal" },
    timeoutMs:3000,
    body:{ health_id:"dispatcher", ...body, updated_at:new Date().toISOString() },
  });
}

function notificationPayload(reminder, startLabel){
  const sessionStart = reminder.delivery_mode === "session-start";
  return {
    title:reminder.title,
    body:reminder.timing_precision === "not-before" ? `Not before ${startLabel}. Tap to open Nothing Sport.` : sessionStart
      ? `Broadcast starts at ${startLabel}; this match follows. Tap to open Nothing Sport.`
      : `Starts at ${startLabel}. Tap to open Nothing Sport.`,
    tag:`nothingsport-${reminder.event_id}`,
    url:reminder.viewing_url || `/?event=${encodeURIComponent(reminder.event_id)}`,
  };
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
    const now = new Date();
    const dispatchBudget=require("../lib/reminder-dispatch-budget").budget({request:supabaseServiceRequest});
    const serviceRequest=dispatchBudget.request;
    await recordDispatchHealth({ last_started_at:now.toISOString(), last_error:null }).catch(() => null);
    if (supabaseMaintenanceMode()){
      await recordDispatchHealth({ last_completed_at:new Date().toISOString(), last_error:"supabase_maintenance" }).catch(() => null);
      response.status(503).json({ error:"Notification dispatch paused for database recovery.", code:"supabase_maintenance" });
      return;
    }
    await serviceRequest("/rest/v1/rpc/nothingsports_activate_fixture_reminders",{method:"POST",body:{}});
    let sharedCatalogue;
    const loadCatalogue=()=>sharedCatalogue ||= require("../lib/reminder-fixtures").catalogue({request:serviceRequest,now});
    const automaticChecks=await require('../lib/automatic-reminders').reconcile({now,request:serviceRequest,loadCatalogue}).catch(()=>{throw Object.assign(new Error('Account reminder reconciliation is unavailable.'),{status:503,payload:{code:'reminder_schedule_reconciliation_failed'}});});
    const scheduleChecks=await require('../lib/reminder-schedules').reconcile({now,request:serviceRequest,loadCatalogue}).catch(()=>{throw Object.assign(new Error('Reminder schedule reconciliation is unavailable.'),{status:503,payload:{code:'reminder_schedule_reconciliation_failed'}});});
    await serviceRequest('/rest/v1/rpc/nothingsports_inbox_maintenance',{method:'POST',body:{}});
    const publicKey = String(process.env.VAPID_PUBLIC_KEY || "");
    const privateKey = String(process.env.VAPID_PRIVATE_KEY || "");
    if (!publicKey || !privateKey) throw Object.assign(new Error("Web Push is not configured."), { status:503, payload:{ code:"push_not_configured" } });
    webpush.setVapidDetails(String(process.env.VAPID_SUBJECT || "https://nothingsport.vercel.app/"), publicKey, privateKey);

    const oldest = new Date(now.getTime() - 60 * 60 * 1000);
    const staleBefore = new Date(now.getTime() - CLAIM_STALE_MS).toISOString();
    const claimedAt=now.toISOString();
    let reminders=[];
    let claimed=[];
    const rows=await serviceRequest('/rest/v1/rpc/nothingsports_claim_due_reminders',{method:'POST',body:{claim_at:claimedAt,oldest_due:oldest.toISOString(),stale_before:staleBefore,batch_limit:10}});
    reminders=Array.isArray(rows)?rows:[];
    claimed=reminders.map(reminder=>({reminder,claimedAt}));
    const ids = [...new Set(claimed.map(item => item.reminder.installation_id).filter(Boolean))];
    const installationRows = ids.length
      ? await serviceRequest(`/rest/v1/nothingsports_push_installations?installation_id=in.(${ids.map(encodeURIComponent).join(",")})&select=*`)
      : [];
    const installations = new Map((installationRows || []).map(item => [item.installation_id, item]));
    let sent = 0;
    let failed = 0;
    await require("../lib/reminder-dispatch-budget").workers(claimed, async claim=>{
      const { reminder, claimedAt } = claim;
      const installation = installations.get(reminder.installation_id);
      if (!installation){
        failed += 1;
        await patchClaimedReminder(reminder.id, claimedAt, { claimed_at:null, attempts:Number(reminder.attempts || 0) + 1, last_error:"Push installation is unavailable." },serviceRequest);
        return;
      }
      try{
        const admitted=await serviceRequest("/rest/v1/rpc/nothingsports_begin_fixture_reminder",{method:"POST",body:{reminder_id:reminder.id,expected_claim:claimedAt}});
        if(!admitted)return;
        const startLabel = new Intl.DateTimeFormat("en-AU", { hour:"numeric", minute:"2-digit", timeZone:installation.timezone || "Australia/Sydney" }).format(new Date(reminder.starts_at));
        await guardedSend({request:serviceRequest,send:dispatchBudget.send(webpush.sendNotification.bind(webpush)),installationId:installation.installation_id,expectedUserId:installation.user_id||null,relatedUserIds:[reminder.user_id],payload:JSON.stringify(notificationPayload(reminder,startLabel)),options:{timeout:3000,TTL:900,urgency:"high",topic:String(reminder.event_id).replace(/[^A-Za-z0-9_-]/g, "").slice(0,32)||undefined}});
        sent += 1;
        await patchClaimedReminder(reminder.id, claimedAt, { claimed_at:null, dispatched_at:new Date().toISOString(), attempts:Number(reminder.attempts || 0) + 1, last_error:null },serviceRequest);
      }catch(error){
        if(suppressed(error)){
          await patchClaimedReminder(reminder.id,claimedAt,{claimed_at:null,delivery_started_at:null,last_error:"Notification suppressed before provider contact."},serviceRequest);
          return;
        }
        failed += 1;
        const status = Number(error?.statusCode || 0);
        await patchClaimedReminder(reminder.id, claimedAt, { claimed_at:null, attempts:Number(reminder.attempts || 0) + 1, last_error:String(error?.message || "Push delivery failed.").slice(0, 500), ...(status?{delivery_started_at:null}:{}), ...(!status?{dispatched_at:new Date().toISOString()}: {}) },serviceRequest);
        if (status === 404 || status === 410){
          await serviceRequest(`/rest/v1/nothingsports_push_installations?installation_id=eq.${encodeURIComponent(installation.installation_id)}`, { method:"DELETE" });
        }
      }
    },2);
    const nsc=require('../lib/nothingscore-server');
    const api={...nsc,rows:(t,p)=>nsc.rows(t,p,serviceRequest),identityMaps:ids=>nsc.identityMaps(ids,serviceRequest),refreshEventSnapshots:ids=>nsc.refreshEventSnapshots(ids,{request:serviceRequest})};
    const otherOptions={now,api,request:serviceRequest,send:dispatchBudget.send(webpush.sendNotification.bind(webpush))};
    const deferred={checked:0,sent:0,failed:0,deferred:'dispatch_deadline'};
    const liveRatings=dispatchBudget.remaining()>5000?await require('../lib/live-rating-alerts').dispatch(otherOptions).catch(()=>({error:'live_rating_dispatch_failed'})):deferred;
    const socialRewards=dispatchBudget.remaining()>5000?await require('../lib/social-reward-alerts').dispatch(otherOptions).catch(()=>({error:'social_reward_dispatch_failed'})):deferred;
    const ownerPosts=dispatchBudget.remaining()>5000?await require('../lib/comms-post-alerts').dispatch({now,request:serviceRequest,send:dispatchBudget.send(webpush.sendNotification.bind(webpush))}).catch(()=>({error:'owner_post_dispatch_failed'})):deferred;
    const contentRefresh=dispatchBudget.remaining()>5000?await require('../lib/comms-refresh').reconcile({now:now.getTime(),request:serviceRequest}).catch(()=>({error:'content_refresh_failed'})):deferred;
    const completedAt = new Date().toISOString();
    await recordDispatchHealth({
      last_completed_at:completedAt,
      ...(failed === 0 && !ownerPosts.error && !ownerPosts.failed && !contentRefresh.error && !liveRatings.error && !liveRatings.failed && !socialRewards.error && !socialRewards.failed ? { last_success_at:completedAt } : {}),
      checked_count:(reminders || []).length,
      claimed_count:claimed.length,
      sent_count:sent + (ownerPosts.sent || 0) + (liveRatings.sent || 0) + (socialRewards.sent || 0),
      failed_count:failed + (ownerPosts.failed||0) + (ownerPosts.error?1:0) + (liveRatings.failed || 0) + (socialRewards.failed || 0) + (liveRatings.error ? 1 : 0) + (socialRewards.error ? 1 : 0),
      last_error:ownerPosts.error || contentRefresh.error || liveRatings.error || socialRewards.error || (failed ? `${failed} notification delivery${failed === 1 ? "" : "ies"} failed in the latest run.` : null),
    }).catch(() => null);
    response.status(liveRatings.error || socialRewards.error || ownerPosts.error ? 503 : 200).json({ automaticChecks, scheduleChecks, contentRefresh, ownerPosts, liveRatings, socialRewards, checked:(reminders || []).length, claimed:claimed.length, sent, failed, at:now.toISOString() });
  }catch(error){
    await recordDispatchHealth({ last_completed_at:new Date().toISOString(), last_error:['push_not_configured','reminder_schedule_reconciliation_failed'].includes(error?.payload?.code) ? error.payload.code : 'notification_dispatch_failed' }).catch(() => null);
    const outgoing = publicError(error);
    response.status(outgoing.status).json(outgoing.body);
  }
};

module.exports._test = { CLAIM_STALE_MS, notificationPayload, recordDispatchHealth };
