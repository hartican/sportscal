#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const { SupabaseRequestError } = require("../lib/supabase-server");

const ROOT = require("node:path").resolve(__dirname, "..");
const notificationsPath = require.resolve("../api/notifications.js");
const dispatchPath = require.resolve("../api/notification-dispatch.js");
const socialAlertsPath = require.resolve("../lib/social-reward-alerts.js");
const liveAlertsPath = require.resolve("../lib/live-rating-alerts.js");
const serverPath = require.resolve("../lib/supabase-server.js");
const sendGuardPath=require.resolve("../lib/notification-send.js");
const webPushPath = require.resolve("web-push");

function responseHarness(){
  return {
    headers:{},
    statusCode:0,
    payload:null,
    setHeader(name, value){ this.headers[name] = value; },
    status(value){ this.statusCode = value; return this; },
    json(value){ this.payload = value; return this; },
  };
}

function publicError(error){
  return {
    status:Number(error?.status) || 500,
    body:{ error:error?.message || "Request failed.", code:error?.payload?.code || "request_failed" },
  };
}

function withMockedModule(modulePath, exportsValue){
  const previous = require.cache[modulePath];
  require.cache[modulePath] = { id:modulePath, filename:modulePath, loaded:true, exports:exportsValue };
  return () => {
    if (previous) require.cache[modulePath] = previous;
    else delete require.cache[modulePath];
  };
}

async function notificationsHarness({ user = null, serviceRequest }){
  const restoreServer = withMockedModule(serverPath, {
    authenticatedUser:async () => user,
    bearerToken:request => String(request?.headers?.authorization || "").replace(/^Bearer\s+/i, ""),
    publicError,
    supabaseServiceRequest:serviceRequest,
  });
  const fixture={id:'event:fanout',name:'Verified final',status:'upcoming',scheduleStatus:'confirmed',timePrecision:'exact',startTimeUtc:new Date(Date.now()+7200000).toISOString(),sourceUrl:'https://organiser.example/fixture',sourceCheckedAt:new Date().toISOString()};
  const restoreFixtures=withMockedModule(require.resolve('../lib/reminder-fixtures'),{catalogue:async()=>({resolve:id=>id==='event:fanout'?fixture:null}),published:()=>[fixture],index:()=>({resolve:id=>id==='event:fanout'?fixture:null})});
  const restoreAutomatic=withMockedModule(require.resolve('../lib/automatic-reminders'),{choose:args=>serviceRequest('/rest/v1/rpc/nothingsports_set_reminder_choice',{method:'POST',body:{target_user:args.userId,fixture_key:args.fixture.id,enabled:args.enabled}})});
  delete require.cache[sendGuardPath];
  delete require.cache[notificationsPath];
  const handler = require(notificationsPath);
  return {
    async run(body, { authenticated = Boolean(user) } = {}){
      const response = responseHarness();
      await handler({
        method:"POST",
        body,
        headers:authenticated ? { authorization:"Bearer test-token", "user-agent":"Notification validation" } : { "user-agent":"Notification validation" },
      }, response);
      return response;
    },
    close(){ delete require.cache[notificationsPath]; restoreAutomatic();restoreFixtures();restoreServer(); },
  };
}

async function dispatchHarness({ serviceRequest, sendNotification, scheduleError=false }){
  const restoreServer = withMockedModule(serverPath, { publicError, SupabaseRequestError, supabaseMaintenanceMode:()=>false, supabaseServiceRequest:(path,options)=>path.endsWith("/nothingsports_activate_fixture_reminders")?Promise.resolve(null):path.endsWith('/nothingsports_reminder_schedule_candidates')?(scheduleError?Promise.reject(Error('Private database detail')):Promise.resolve([])):serviceRequest(path,options) });
  const restoreWebPush = withMockedModule(webPushPath, {
    setVapidDetails(){},
    sendNotification,
  });
  const restoreAutomatic=withMockedModule(require.resolve('../lib/automatic-reminders'),{reconcile:async()=>({accounts:0,fixtures:0})});
  const restoreLiveAlerts = withMockedModule(liveAlertsPath, { dispatch:async()=>({ checked:0, sent:0, failed:0, skipped:0 }) });
  const restoreSocialAlerts = withMockedModule(socialAlertsPath, { dispatch:async()=>({ checked:0, sent:0, failed:0, skipped:0 }) });
  delete require.cache[sendGuardPath];
  delete require.cache[require.resolve('../lib/reminder-schedules')];
  delete require.cache[require.resolve('../lib/comms-refresh')];
  delete require.cache[require.resolve('../lib/comms-post-alerts')];
  delete require.cache[dispatchPath];
  const handler = require(dispatchPath);
  return {
    async run({env={},authorization="Bearer cron-secret"}={}){
      const response = responseHarness();
      const previousEnvironment = {
        CRON_SECRET:process.env.CRON_SECRET,
        VAPID_PUBLIC_KEY:process.env.VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY:process.env.VAPID_PRIVATE_KEY,
      };
      Object.assign(process.env, { CRON_SECRET:"cron-secret", VAPID_PUBLIC_KEY:"public", VAPID_PRIVATE_KEY:"private",...env });
      try{
        await handler({ method:"GET", headers:{ authorization } }, response);
      }finally{
        Object.entries(previousEnvironment).forEach(([key, value]) => {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        });
      }
      return response;
    },
    close(){ delete require.cache[require.resolve('../lib/reminder-schedules')]; delete require.cache[dispatchPath]; restoreSocialAlerts(); restoreLiveAlerts(); restoreAutomatic();restoreWebPush(); restoreServer(); },
  };
}

async function main(){
  const html = fs.readFileSync(`${ROOT}/index.html`, "utf8")+fs.readFileSync(`${ROOT}/config/fantasy-deadline-ui.js`,"utf8");
  const worker = fs.readFileSync(`${ROOT}/service-worker.js`, "utf8");
  const migration = fs.readFileSync(`${ROOT}/supabase/reliable-web-push-reminders.sql`, "utf8");
  const installationMigration = fs.readFileSync(`${ROOT}/supabase/follow-first-user-meta-and-notifications.sql`, "utf8");
  const socialMigration = fs.readFileSync(`${ROOT}/supabase/migrations/20260915231544_social_reward_notifications.sql`, "utf8");
  const vercel = JSON.parse(fs.readFileSync(`${ROOT}/vercel.json`, "utf8"));
  const quickReminder = html.match(/async function toggleQuickReminder[\s\S]*?\n\}/)?.[0] || "";
  assert(quickReminder.includes("return ensureWebPushReminder(ev, timing)") && quickReminder.includes("rollback:prior"), "optimistic Remind must await server confirmation and roll back failure");
  assert(quickReminder.includes("return removeWebPushReminder(ev)"), "turning a reminder off must confirm server cancellation");
  assert(quickReminder.includes("if (enabled && !reminderCanBeScheduled(timing))"), "an expired reminder window must block creation without blocking cancellation");
  assert(!quickReminder.includes("localNotificationRegistration"), "Remind me must not fall back to an active-app timer");
  assert(!html.includes("scheduleBrowserReminders()"), "the retired active-app scheduler must not run alongside Web Push");
  assert(html.includes("backfillWebPushReminders") && html.includes('Notification.permission !== "granted"'), "already-permitted installations must backfill future reminders without prompting");
  assert(html.includes("await disablePushInstallation({ preserveSubscription:true })"), "sign-out must detach the current installation before the account session is cleared");
  assert.match(html, /action:"register"[\s\S]{0,700}socialAlertsEnabled:[\s\S]{0,300}chatAlertsEnabled:[\s\S]{0,300}badgesEnabled:/, "push registration must send saved social, chat and badge preferences");
  assert(html.includes('id="socialAlertsEnabled"')&&html.includes('New followers and bonus points'),"Settings must expose the social and externally earned points alert opt-out");
  assert(html.includes("Background notifications") && !html.includes("Local reminder—keep Nothing Sport open"), "notification copy must describe background delivery honestly");
  assert(worker.includes("new URL(targetUrl, self.location.origin)"), "notification taps must resolve an origin-safe event URL");
  assert(migration.includes("claimed_at timestamptz") && migration.includes("grant select, insert, update, delete"), "the database update must add claims and retain service-role grants");
  assert.match(migration, /delivery_mode text not null default 'match-15'/i, "reminders must persist whether they target match, broadcast, or session timing");
  assert.match(migration, /create table if not exists public\.nothingsports_notification_dispatch_health/i, "dispatcher health must be queryable from one server-only row");
  assert.match(migration, /create table if not exists public\.nothingsports_notification_tests/i, "test notifications must retain sent and received diagnostics");
  assert.match(worker, /nothingsport-notification-received[\s\S]{0,500}testId/, "the service worker must acknowledge a displayed test to an open client when possible");
  assert.match(html, /action:"status"[\s\S]{0,800}action:"test"/, "Settings must expose live reminder status and a real system-notification test");
  assert.match(html,/function eventReminderTiming[\s\S]{0,120}NOTHINGSPORTS_REMINDER_POLICY.manualTiming/,"Both manual surfaces use the shared verified or provisional fixture timing contract");
  [migration, installationMigration].forEach(source => {
    assert.match(source, /chat_alerts_enabled boolean not null default true/i, "chat alerts must default on per installation");
    assert.match(source, /badges_enabled boolean not null default true/i, "unread app badges must default on per installation");
  });
  [installationMigration,socialMigration].forEach(source=>assert.match(source,/social_alerts_enabled boolean not null default true/i,"social and reward alerts default on per installation"));
  assert.match(socialMigration,/nothingsports_social_notifications[\s\S]*enable row level security/i,"social notification outbox must use RLS");
  assert.match(socialMigration,/nothingsports_claim_social_notifications[\s\S]*for update skip locked/i,"social notifications must be claimed transactionally");
  assert.match(socialMigration,/nothingsports_copy_person_rewards[\s\S]*primary key \(copier_user_id, source_user_id\)/i,"copy bonuses must be permanently unique per copier and source person");
  assert.match(socialMigration,/select distinct copier_id,source_id from public\.nothingsports_pick_rewards/i,"existing per-sport rewards must be backfilled into the person-wide ledger");
  const socialPayload=require(socialAlertsPath).payload;
  assert.match(socialPayload({id:'follow',kind:'profile_followed',points:1},'Amy').body,/earned 1 point/);
  assert.match(socialPayload({id:'copy',kind:'follows_copied',points:20,sport:'nrl'},'Jim').body,/sporting follows.+once-off 20 points/);
  const socialCalls=[],socialRows=[],socialPushes=[],socialNotification={id:'social-1',recipient_user_id:'recipient',actor_user_id:'actor',kind:'follows_copied',points:20,sport:'nrl'};
  const socialDispatch=await require(socialAlertsPath).dispatch({
    now:new Date('2026-09-16T00:00:00Z'),
    api:{
      identityMaps:async()=>({profiles:new Map([['actor',{display_name:'Amy',visibility:'visible'}]]),personas:new Map()}),
      rows:async(table,params)=>{socialRows.push({table,params});return table==='nothingsports_push_installations'?[{installation_id:'install-1',endpoint:'https://push.test/social',p256dh:'key',auth_key:'auth'}]:[{notification_id:'social-1',installation_id:'install-1',status:'pending',attempts:0}];},
    },
    request:async(path,options={})=>{socialCalls.push({path,options});return path.includes('nothingsports_begin_notification_send')?{leaseId:'lease',subscription:{endpoint:'https://push.test/social',keys:{p256dh:'key',auth:'auth'}}}:path.includes('nothingsports_claim_social_notifications')?[socialNotification]:null;},
    send:async(_subscription,body)=>socialPushes.push(JSON.parse(body)),
  });
  assert.deepEqual(socialDispatch,{checked:1,sent:1,failed:0,skipped:0});
  assert.equal(socialPushes[0].title,'Amy copied your follows');
  assert.match(socialPushes[0].body,/once-off 20 points/);
  assert(socialRows.some(call=>call.table==='nothingsports_push_installations'&&call.params.social_alerts_enabled==='eq.true'),'social delivery must honour the per-installation opt-out');
  assert(!Array.isArray(vercel.crons) || !vercel.crons.some(cron => cron.path === "/api/notification-dispatch"), "cron-job.org must be the sole dispatcher scheduler");

  const pushQueueSource = html.match(/function createPushInstallationMutationQueue\(\)[\s\S]*?const enqueuePushInstallationMutation = createPushInstallationMutationQueue\(\);/)?.[0] || "";
  assert(pushQueueSource, "push registration and teardown need one shared mutation queue");
  const createPushInstallationMutationQueue = Function(`${pushQueueSource}; return createPushInstallationMutationQueue;`)();
  const enqueuePushMutation = createPushInstallationMutationQueue();
  let finishDelayedRegistration;
  const delayedRegistrationGate = new Promise(resolve => { finishDelayedRegistration = resolve; });
  const mutationOrder = [];
  const delayedRegistration = enqueuePushMutation(async () => {
    mutationOrder.push("register-started");
    await delayedRegistrationGate;
    mutationOrder.push("register-finished");
  });
  const signOutUnregister = enqueuePushMutation(async () => { mutationOrder.push("unregistered"); });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(mutationOrder, ["register-started"], "sign-out unregister must wait while an older registration is still pending");
  finishDelayedRegistration();
  await Promise.all([delayedRegistration, signOutUnregister]);
  assert.deepEqual(mutationOrder, ["register-started", "register-finished", "unregistered"], "the final server mutation after a delayed register must be sign-out unregister");
  assert.match(html, /async function ensurePushInstallation[\s\S]*?return enqueuePushInstallationMutation\(/, "registration must enter the shared mutation queue when requested");
  assert.match(html, /async function disablePushInstallation[\s\S]*?return enqueuePushInstallationMutation\(/, "unregister must enter the same mutation queue when requested");

  const installationId = "11111111-1111-4111-8111-111111111111";
  const secondInstallationId = "22222222-2222-4222-8222-222222222222";
  const secret = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";
  const secretHash = crypto.createHash("sha256").update(secret, "utf8").digest("hex");
  const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const serviceCalls = [];
  const notificationService = async (path, options = {}) => {
    serviceCalls.push({ path, options });
    if (path.includes("nothingsports_push_installations?installation_id=eq.")){
      return [{ installation_id:installationId, user_id:"user-1", secret_hash:secretHash, social_alerts_enabled:false, chat_alerts_enabled:false, badges_enabled:false }];
    }
    if (path.includes("nothingsports_push_installations?user_id=eq.")){
      return [{ installation_id:installationId }, { installation_id:secondInstallationId }];
    }
    if (path.includes("nothingsports_reminders?installation_id=in.")){
      return [{ installation_id:installationId, starts_at:startsAt, dispatched_at:"2026-08-30T00:00:00.000Z", attempts:1, last_error:null }];
    }
    return null;
  };
  const notificationApi = await notificationsHarness({ user:{ id:"user-1" }, serviceRequest:notificationService });
  try{
    let registration = await notificationApi.run({
      action:"register", installationId, secret,
      subscription:{ endpoint:"https://push.example.test/subscription", keys:{ p256dh:"key", auth:"auth" } },
      timezone:"Australia/Sydney", socialAlertsEnabled:false, chatAlertsEnabled:false, badgesEnabled:false,
    });
    assert.equal(registration.statusCode, 200);
    let registrationWrite = serviceCalls.find(call => call.path.includes("nothingsports_push_installations?on_conflict=installation_id"));
    assert.equal(registrationWrite.options.body.chat_alerts_enabled,false,"an explicit chat-alert opt-out must be persisted");
    assert.equal(registrationWrite.options.body.social_alerts_enabled,false,"an explicit social-alert opt-out must be persisted");
    assert.equal(registrationWrite.options.body.badges_enabled,false,"an explicit badge opt-out must be persisted");

    serviceCalls.length = 0;
    registration = await notificationApi.run({
      action:"register", installationId, secret,
      subscription:{ endpoint:"https://push.example.test/subscription", keys:{ p256dh:"key", auth:"auth" } },
      timezone:"Australia/Sydney",
    });
    assert.equal(registration.statusCode, 200);
    registrationWrite = serviceCalls.find(call => call.path.includes("nothingsports_push_installations?on_conflict=installation_id"));
    assert.equal(registrationWrite.options.body.chat_alerts_enabled,false,"an omitted legacy field must preserve an existing chat-alert opt-out");
    assert.equal(registrationWrite.options.body.social_alerts_enabled,false,"an omitted legacy field must preserve an existing social-alert opt-out");
    assert.equal(registrationWrite.options.body.badges_enabled,false,"an omitted legacy field must preserve an existing badge opt-out");

    serviceCalls.length = 0;
    const response = await notificationApi.run({
      action:"remind",
      installationId,
      secret,
      eventId:"event:fanout",
      title:"Fan-out final",
      startsAt,
      deliveryMode:"match-15",
      viewingUrl:"https://nothingsport.vercel.app/?event=event%3Afanout",
    });
    assert.equal(response.statusCode, 200, JSON.stringify(response.payload));
    const choice=serviceCalls.find(c=>c.path.endsWith('/nothingsports_set_reminder_choice'));
    assert.deepEqual(choice.options.body,{target_user:'user-1',fixture_key:'event:fanout',enabled:true},'Account intent is persisted independently of installation fan-out');
    assert.notEqual(response.payload.startsAt,startsAt,'Submitted timing is ignored in favour of verified catalogue timing');

    serviceCalls.length = 0;
    const sessionResponse = await notificationApi.run({
      action:"remind",
      installationId,
      secret,
      eventId:"event:session-follows",
      title:"Session-relative match",
      startsAt,
      deliveryMode:"session-start",
    });
    assert.equal(sessionResponse.statusCode,409,'A follows-only unpublished fixture cannot borrow a parent session start');
    assert.equal(sessionResponse.payload.code,'unverified_fixture_start');

    serviceCalls.length = 0;
    const cancelled = await notificationApi.run({ action:"cancel", installationId, secret, eventId:"event:fanout" });
    assert.equal(cancelled.statusCode, 200);
    assert(serviceCalls.some(call => call.path.endsWith("/nothingsports_set_reminder_choice") && call.options.body.target_user === "user-1" && call.options.body.enabled === false), "signed-in cancellation must persist account-wide OFF");
  }finally{
    notificationApi.close();
  }

  const healthCalls=[];
  const brokenDispatcher=await dispatchHarness({
    serviceRequest:async(path,options={})=>{healthCalls.push({path,body:options.body});if(path.includes('notification_dispatch_health')||path.endsWith('/nothingsports_inbox_maintenance'))return [];throw new Error('private upstream detail must not leak');},
    sendNotification:async()=>{throw new Error('preflight must not send');},
  });
  try{
    const missing=await brokenDispatcher.run({env:{VAPID_PRIVATE_KEY:""}});
    assert.equal(missing.statusCode,503);
    assert(healthCalls[0].body.last_started_at,"authorised invocation is recorded before VAPID preflight");
    assert.equal(healthCalls.at(-1).body.last_error,"push_not_configured");
    assert(!healthCalls.some(call=>call.body?.last_success_at));
    healthCalls.length=0;
    await brokenDispatcher.run();
    assert.equal(healthCalls.at(-1).body.last_error,"notification_dispatch_failed","stored health must not expose raw upstream errors");
    healthCalls.length=0;
    const denied=await brokenDispatcher.run({authorization:"Bearer wrong"});
    assert.equal(denied.statusCode,401);
    assert.equal(healthCalls.length,0,"unauthorised callers must not alter dispatcher health");
  }finally{brokenDispatcher.close();}

  const reminder = {
    id:"reminder-1",
    installation_id:installationId,
    event_id:"event:claim",
    title:"Claimed final",
    starts_at:new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    remind_at:new Date(Date.now() - 1000).toISOString(),
    claimed_at:null,
    attempts:0,
    delivery_mode:"session-start",
  };
  const installation = {
    installation_id:installationId,
    endpoint:"https://push.example.test/subscription",
    p256dh:"key",
    auth_key:"auth",
    timezone:"Australia/Sydney",
  };
  let sends = 0;
  const dispatchedPayloads = [];
  let claimAllowed = true;
  let suppressSend = false;
  const dispatchCalls = [];
  const dispatchService = async (path, options = {}) => {
    dispatchCalls.push({ path, options });
    if(path==='/rest/v1/rpc/nothingsports_comms_claim_refresh')return null;
    if(path==='/rest/v1/rpc/nothingsports_comms_claim_posts')return [];
    if(path.includes("nothingsports_begin_fixture_reminder"))return true;
    if(path.includes("nothingsports_begin_notification_send"))return suppressSend ? null : {leaseId:"lease",subscription:{endpoint:installation.endpoint,keys:{p256dh:installation.p256dh,auth:installation.auth_key}}};
    if (path === "/rest/v1/rpc/nothingsports_claim_due_reminders") return claimAllowed ? [{ ...reminder, claimed_at:options.body.claim_at }] : [];
    if (options.method === "PATCH" && options.headers?.Prefer === "return=representation") return claimAllowed ? [{ ...reminder, claimed_at:options.body.claimed_at }] : [];
    if (path.includes("nothingsports_reminders?dispatched_at=is.null")) return [reminder];
    if (path.includes("nothingsports_push_installations?installation_id=in.")) return [installation];
    return null;
  };
  const dispatcher = await dispatchHarness({ serviceRequest:dispatchService, sendNotification:async (_subscription, payload) => { sends += 1; dispatchedPayloads.push(JSON.parse(payload)); } });
  try{
    let response = await dispatcher.run();
    assert.equal(response.statusCode, 200, JSON.stringify(response.payload));
    assert.equal(sends, 1);
    assert.equal(response.payload.claimed, 1);
    assert.equal(dispatchedPayloads[0].title, "Claimed final", "push titles put the fixture first; timing belongs in the body");
    assert(dispatchCalls.some(call => call.options.method === "POST" && call.path === "/rest/v1/rpc/nothingsports_claim_due_reminders"), "dispatch must atomically claim a due batch before sending");

    claimAllowed = false;
    sends = 0;
    dispatchCalls.length = 0;
    response = await dispatcher.run();
    assert.equal(response.statusCode, 200);
    assert.equal(sends, 0, "a dispatcher that loses the claim race must not send");
    assert.equal(response.payload.claimed, 0);
    claimAllowed=true;suppressSend=true;dispatchCalls.length=0;
    response=await dispatcher.run();
    assert.equal(sends,0,"a suppressed admission never contacts the provider");
    assert(dispatchCalls.some(call=>call.options.body?.delivery_started_at===null&&call.options.body?.last_error==='Notification suppressed before provider contact.'),"pre-provider suppression releases the claim without a delivery receipt");
  }finally{
    dispatcher.close();
  }

  const blockedHealth=[];
  const blockedDispatch=await dispatchHarness({scheduleError:true,serviceRequest:async(p,o)=>{blockedHealth.push(o.body);return [];},sendNotification:async()=>{throw Error('Provider must not be called');}});
  try{const result=await blockedDispatch.run();assert.equal(result.statusCode,503);assert.equal(result.payload.code,'reminder_schedule_reconciliation_failed');assert(blockedHealth.some(b=>b.last_error==='reminder_schedule_reconciliation_failed'));}finally{blockedDispatch.close();}
  console.log("Reliable Web Push validation passed: UI confirmation, account fan-out, cancellation, and atomic dispatch claims are enforced.");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
