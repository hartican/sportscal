#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { build } = require("./build-marquee-candidates");
const comms = require("../api/comms");
const participation = require("../api/participation");
const webhook = require("../api/comms-webhook");

const ROOT = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(ROOT, file), "utf8");

function responseCapture(){
  return { headers:{}, statusCode:0, body:null, setHeader(name,value){this.headers[name]=value;}, status(value){this.statusCode=value;return this;}, json(value){this.body=value;return this;} };
}

async function main(){
  const first = await build({ now:"2026-08-29T00:00:00.000Z" });
  const firstJson = JSON.stringify(first);
  const second = await build({ now:"2026-08-29T00:00:00.000Z" });
  assert.equal(JSON.stringify(second), firstJson, "fixed-input campaign builds must be idempotent");

  assert.equal(comms._test.isAdminRole({ app_metadata:{ role:"admin" }, user_metadata:{ role:"viewer" } }), true);
  assert.equal(comms._test.isAdminRole({ app_metadata:{ role:"viewer" }, user_metadata:{ role:"admin" } }), false, "editable metadata must never grant admin access");
  assert.equal(comms._test.isAdminRole({ app_metadata:{ role:"admin" } }), true);
  assert.equal(comms._test.isAdminRole({ app_metadata:{ role:"pilot" } }), false, "removed roles must take effect on the next server verification");
  assert.equal(comms._test.editableState("draft"), true);
  assert.equal(comms._test.editableState("approved"), false);
  assert.equal(comms._test.validEmail(" Person@Example.com "), "person@example.com");
  assert.equal(comms._test.validEmail("not-an-email"), "");

  const cookieResponse = responseCapture();
  const identity = participation._test.deviceIdentity({ headers:{} }, cookieResponse, { PARTICIPATION_SECRET:"a".repeat(64) });
  assert.match(identity.hash, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(cookieResponse.headers["Set-Cookie"], new RegExp(identity.hash), "cookie must contain only the opaque token, never its stored hash");
  assert.match(cookieResponse.headers["Set-Cookie"], /HttpOnly; Secure; SameSite=Lax/);
  const token = participation._test.parseCookies(cookieResponse.headers["Set-Cookie"])[participation._test.COOKIE_NAME];
  const repeatResponse = responseCapture();
  const repeated = participation._test.deviceIdentity({ headers:{ cookie:`${participation._test.COOKIE_NAME}=${token}` } }, repeatResponse, { PARTICIPATION_SECRET:"a".repeat(64) });
  assert.equal(repeated.hash, identity.hash, "one device token must deduplicate joins and rating edits");
  assert.equal(participation._test.sameOrigin({ url:"/api/participation", headers:{ origin:"https://nothingsport.vercel.app", host:"nothingsport.vercel.app", "x-forwarded-proto":"https" } }), true);
  assert.equal(participation._test.sameOrigin({ url:"/api/participation", headers:{ origin:"https://attacker.test", host:"nothingsport.vercel.app", "x-forwarded-proto":"https" } }), false);
  assert.equal(webhook._test.deliveryStatus("email.delivered"), "delivered");
  assert.equal(webhook._test.deliveryStatus("unknown"), "");
  assert.equal(webhook._test.recipient({ data:{ to:["Person@example.com"] } }), "person@example.com");

  const sql = read("supabase/marquee-communications.sql");
  const tables = ["nothingsports_marquee_campaigns","nothingsports_marquee_subscribers","nothingsports_marquee_deliveries","nothingsports_fixture_devices","nothingsports_fixture_participation","nothingsports_fixture_write_limits"];
  tables.forEach(table => {
    assert.match(sql, new RegExp(`alter table public\\.${table} force row level security`, "i"));
    assert.match(sql, new RegExp(`revoke all on public\\.${table} from anon, authenticated`, "i"));
  });
  assert.doesNotMatch(sql, /\bip_address\b|\braw_ip\b/i);
  assert.match(sql, /content_hash/);
  assert.match(sql, /suppression_reason/);

  const commsSource = read("api/comms.js"), participationSource = read("api/participation.js"), worker = read("service-worker.js"), vercel = JSON.parse(read("vercel.json"));
  assert.match(commsSource, /app_metadata/);
  assert.doesNotMatch(commsSource, /user_metadata\?\.role/);
  assert.match(commsSource, /requested_connector_not_installed/);
  assert.match(commsSource, /operator_sender_configuration_required/);
  assert.match(commsSource, /confirmation !== "SEND NOW"/);
  assert.match(participationSource, /same_origin_required/);
  assert.match(participationSource, /rating_not_open/);
  assert.match(participationSource, /rating_window_closed/);
  assert.doesNotMatch(participationSource, /x-forwarded-for|cf-connecting-ip|request\.ip/i);
  assert.match(worker, /nothingsport-shell-v169/);
  assert.match(worker, /\/participate\.html/);
  assert.ok(vercel.rewrites.some(rule => rule.source === "/live" && rule.destination === "/participate.html"));
  assert.ok(vercel.rewrites.some(rule => rule.source === "/fixture/:eventId"));
  assert.ok(vercel.rewrites.some(rule => rule.source === "/admin/comms"));
  assert.match(read("scripts/redeploy-and-release.sh"), /data\/marquee-candidates\.v1\.json/);
  assert.match(read("scripts/redeploy-and-release.sh"), /assets\/marquee/);
  assert.doesNotMatch(read("admin-comms.html") + read("participate.html"), /SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY|RESEND_WEBHOOK_SECRET|PARTICIPATION_SECRET/);

  console.log("Marquee communications validation passed (pipeline, approval gate, consent safety, webhooks, guest privacy and deep links). ");
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
