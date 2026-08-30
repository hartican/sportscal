#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");

const ROOT = require("node:path").resolve(__dirname, "..");
const notificationsPath = require.resolve("../api/notifications.js");
const dispatchPath = require.resolve("../api/notification-dispatch.js");
const serverPath = require.resolve("../lib/supabase-server.js");
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
    close(){ delete require.cache[notificationsPath]; restoreServer(); },
  };
}

async function dispatchHarness({ serviceRequest, sendNotification }){
  const restoreServer = withMockedModule(serverPath, { publicError, supabaseServiceRequest:serviceRequest });
  const restoreWebPush = withMockedModule(webPushPath, {
    setVapidDetails(){},
    sendNotification,
  });
  delete require.cache[dispatchPath];
  const handler = require(dispatchPath);
  return {
    async run(){
      const response = responseHarness();
      const previousEnvironment = {
        CRON_SECRET:process.env.CRON_SECRET,
        VAPID_PUBLIC_KEY:process.env.VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY:process.env.VAPID_PRIVATE_KEY,
      };
      Object.assign(process.env, { CRON_SECRET:"cron-secret", VAPID_PUBLIC_KEY:"public", VAPID_PRIVATE_KEY:"private" });
      try{
        await handler({ method:"GET", headers:{ authorization:"Bearer cron-secret" } }, response);
      }finally{
        Object.entries(previousEnvironment).forEach(([key, value]) => {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        });
      }
      return response;
    },
    close(){ delete require.cache[dispatchPath]; restoreWebPush(); restoreServer(); },
  };
}

async function main(){
  const html = fs.readFileSync(`${ROOT}/index.html`, "utf8");
  const worker = fs.readFileSync(`${ROOT}/service-worker.js`, "utf8");
  const migration = fs.readFileSync(`${ROOT}/supabase/reliable-web-push-reminders.sql`, "utf8");
  const vercel = JSON.parse(fs.readFileSync(`${ROOT}/vercel.json`, "utf8"));
  const quickReminder = html.match(/async function toggleQuickReminder[\s\S]*?\n\}/)?.[0] || "";
  assert(quickReminder.includes("await ensureWebPushReminder(ev, timing)"), "Remind me must confirm a server reminder before updating local state");
  assert(quickReminder.includes("await removeWebPushReminder(ev)"), "turning a reminder off must confirm server cancellation first");
  assert(quickReminder.includes("if (enabled && !reminderCanBeScheduled(timing))"), "an expired reminder window must block creation without blocking cancellation");
  assert(!quickReminder.includes("localNotificationRegistration"), "Remind me must not fall back to an active-app timer");
  assert(!html.includes("scheduleBrowserReminders()"), "the retired active-app scheduler must not run alongside Web Push");
  assert(html.includes("backfillWebPushReminders") && html.includes('Notification.permission !== "granted"'), "already-permitted installations must backfill future reminders without prompting");
  assert(html.includes("await disablePushInstallation({ preserveSubscription:true })"), "sign-out must detach the current installation before the account session is cleared");
  assert(html.includes("Background notifications") && !html.includes("Local reminder—keep Nothing Sport open"), "notification copy must describe background delivery honestly");
  assert(worker.includes("new URL(targetUrl, self.location.origin)"), "notification taps must resolve an origin-safe event URL");
  assert(migration.includes("claimed_at timestamptz") && migration.includes("grant select, insert, update, delete"), "the database update must add claims and retain service-role grants");
  assert(!Array.isArray(vercel.crons) || !vercel.crons.some(cron => cron.path === "/api/notification-dispatch"), "cron-job.org must be the sole dispatcher scheduler");

  const installationId = "11111111-1111-4111-8111-111111111111";
  const secondInstallationId = "22222222-2222-4222-8222-222222222222";
  const secret = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";
  const secretHash = crypto.createHash("sha256").update(secret, "utf8").digest("hex");
  const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const serviceCalls = [];
  const notificationService = async (path, options = {}) => {
    serviceCalls.push({ path, options });
    if (path.includes("nothingsports_push_installations?installation_id=eq.")){
      return [{ installation_id:installationId, user_id:"user-1", secret_hash:secretHash }];
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
    const response = await notificationApi.run({
      action:"remind",
      installationId,
      secret,
      eventId:"event:fanout",
      title:"Fan-out final",
      startsAt,
      viewingUrl:"https://nothingsport.vercel.app/?event=event%3Afanout",
    });
    assert.equal(response.statusCode, 200);
    const writes = serviceCalls.filter(call => call.path.startsWith("/rest/v1/nothingsports_reminders?on_conflict="));
    assert.equal(writes.length, 2, "signed-in reminder must fan out to every enabled account installation");
    const unchanged = writes.find(call => call.options.body.installation_id === installationId).options.body;
    const newDevice = writes.find(call => call.options.body.installation_id === secondInstallationId).options.body;
    assert(!Object.prototype.hasOwnProperty.call(unchanged, "dispatched_at"), "unchanged sporting starts must preserve delivery state");
    assert.equal(newDevice.dispatched_at, null, "a newly scheduled installation must start undispatched");

    serviceCalls.length = 0;
    const cancelled = await notificationApi.run({ action:"cancel", installationId, secret, eventId:"event:fanout" });
    assert.equal(cancelled.statusCode, 200);
    assert(serviceCalls.some(call => call.options.method === "DELETE" && call.path.includes("user_id=eq.user-1")), "signed-in cancellation must be account-wide");
  }finally{
    notificationApi.close();
  }

  const reminder = {
    id:"reminder-1",
    installation_id:installationId,
    event_id:"event:claim",
    title:"Claimed final",
    starts_at:new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    remind_at:new Date(Date.now() - 1000).toISOString(),
    claimed_at:null,
    attempts:0,
  };
  const installation = {
    installation_id:installationId,
    endpoint:"https://push.example.test/subscription",
    p256dh:"key",
    auth_key:"auth",
    timezone:"Australia/Sydney",
  };
  let sends = 0;
  let claimAllowed = true;
  const dispatchCalls = [];
  const dispatchService = async (path, options = {}) => {
    dispatchCalls.push({ path, options });
    if (options.method === "PATCH" && options.headers?.Prefer === "return=representation") return claimAllowed ? [{ ...reminder, claimed_at:options.body.claimed_at }] : [];
    if (path.includes("nothingsports_reminders?dispatched_at=is.null")) return [reminder];
    if (path.includes("nothingsports_push_installations?installation_id=in.")) return [installation];
    return null;
  };
  const dispatcher = await dispatchHarness({ serviceRequest:dispatchService, sendNotification:async () => { sends += 1; } });
  try{
    let response = await dispatcher.run();
    assert.equal(response.statusCode, 200);
    assert.equal(sends, 1);
    assert.equal(response.payload.claimed, 1);
    assert(dispatchCalls.some(call => call.options.method === "PATCH" && call.path.includes("claimed_at.is.null")), "dispatch must atomically claim a due row before sending");

    claimAllowed = false;
    sends = 0;
    dispatchCalls.length = 0;
    response = await dispatcher.run();
    assert.equal(response.statusCode, 200);
    assert.equal(sends, 0, "a dispatcher that loses the claim race must not send");
    assert.equal(response.payload.claimed, 0);
  }finally{
    dispatcher.close();
  }

  console.log("Reliable Web Push validation passed: UI confirmation, account fan-out, cancellation, and atomic dispatch claims are enforced.");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
