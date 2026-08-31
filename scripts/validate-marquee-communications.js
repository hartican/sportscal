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
  assert.equal(comms._test.editableState("needs_reapproval"), true);
  assert.equal(comms._test.editableState("exported"), false);
  assert.equal(comms._test.editableState("approved"), false);
  const candidate = first.candidates.find(item => item.readyForExport);
  assert.ok(candidate, "the fixed build must provide a campaign for export transition tests");
  const current = {
    campaign_id:candidate.campaignId,
    event_id:candidate.eventId,
    campaign_revision:3,
    content_hash:candidate.contentHash,
    state:"draft",
    candidate,
    draft_copy:candidate.drafts,
    approved_copy:null,
    proposed_send_at:candidate.proposedSendAt,
  };
  const exportTime = "2026-08-30T01:02:03.000Z";
  const exported = comms._test.exportTransition(current, { id:"00000000-0000-4000-8000-000000000001" }, exportTime);
  assert.equal(exported.pack.schemaVersion, "mailchimp-manual.v1");
  assert.equal(exported.pack.campaignRevision, 3);
  assert.equal(exported.pack.contentHash, candidate.contentHash);
  assert.equal(exported.pack.exportedAt, exportTime);
  assert.equal(exported.patch.state, "exported");
  assert.deepEqual(exported.patch.export_snapshot, exported.pack, "the exact exported revision must be frozen");
  assert.doesNotMatch(JSON.stringify(exported.pack), /recipient|email_normalized|subscriber/i, "manual handoff exports must never contain recipients");
  const repeatedExport = comms._test.exportTransition({ ...current, state:"exported", export_snapshot:exported.pack, export_stale:false }, { id:"00000000-0000-4000-8000-000000000001" }, "2026-08-30T02:02:03.000Z");
  assert.equal(repeatedExport.idempotent, true);
  assert.equal(repeatedExport.patch, null);
  assert.deepEqual(repeatedExport.pack, exported.pack, "repeat export must return the frozen snapshot without rewriting it");
  const reopened = comms._test.reopenTransition({ ...current, state:"exported", approved_copy:candidate.drafts, exported_at:exportTime, export_snapshot:exported.pack }, "2026-08-30T03:02:03.000Z");
  assert.equal(reopened.state, "needs_review");
  assert.equal(reopened.campaign_revision, 4);
  assert.equal(reopened.export_stale, true);
  assert.equal(reopened.approved_copy, null);
  const changedCandidate = { ...candidate, contentHash:"a".repeat(64) };
  const changed = comms._test.syncPatch({ ...current, state:"exported", exported_at:exportTime, export_snapshot:exported.pack }, changedCandidate);
  assert.equal(changed.patch.state, "needs_reapproval");
  assert.equal(changed.patch.export_stale, true);
  assert.equal(changed.patch.campaign_revision, 4);
  assert.equal(Object.hasOwn(changed.patch, "export_snapshot"), false, "source changes must retain the previous export for audit");
  assert.equal(changed.patch.draft_copy.email.subject, candidate.drafts.email.subject, "source refreshes must retain an operator's visible draft");
  const dismissed = comms._test.dismissTransition({ ...current, state:"exported", approved_at:exportTime, export_snapshot:exported.pack }, "2026-08-30T04:02:03.000Z");
  assert.equal(dismissed.state, "cancelled");
  assert.equal(dismissed.draft_copy.cms.previousState, "exported");
  assert.equal(Object.hasOwn(dismissed, "export_snapshot"), false, "dismissal must leave the frozen export columns untouched");
  const restored = comms._test.restoreTransition({ ...current, ...dismissed, approved_at:exportTime, export_snapshot:exported.pack }, "2026-08-30T05:02:03.000Z");
  assert.equal(restored.state, "exported");
  assert.equal(restored.draft_copy.cms.dismissedAt, null);
  const dismissedSync = comms._test.syncPatch({ ...current, state:"cancelled" }, changedCandidate);
  assert.equal(dismissedSync.patch.state, "cancelled", "source sync must not silently restore a dismissed CMS item");

  const bledisloe = first.candidates.find(item => item.eventId === "rugby-australia-new-zealand-2026-10-17");
  const visibleLegacyDraft = {
    email:{
      subject:"5/5 stakes: Bledisloe Cup Game I, Australia v New Zealand — Sat 3:45 pm",
      preheader:"Join the watch party, then rate the fixture after it finishes.",
      headline:"Saturday watch party: Bledisloe Cup I",
      bodyParagraphs:["A rivalry-led Bledisloe introduction.", "Join us for the Bledisloe Cup on Sat at 3:45 pm AEDT."],
    },
    instagram:{ caption:"UNMISSABLE RUGBY: BLEDISLOE CUP." },
  };
  const legacyRow = {
    campaign_id:bledisloe.campaignId,
    event_id:bledisloe.eventId,
    campaign_revision:4,
    content_hash:bledisloe.contentHash,
    state:"needs_review",
    candidate:{ material:bledisloe.material },
    draft_copy:visibleLegacyDraft,
    proposed_send_at:bledisloe.proposedSendAt,
  };
  const legacyExport = comms._test.exportTransition(legacyRow, { id:"00000000-0000-4000-8000-000000000001" }, exportTime);
  assert.equal(legacyExport.pack.subject, visibleLegacyDraft.email.subject, "the exact visible operator subject must be exported");
  assert.deepEqual(legacyExport.pack.bodyParagraphs, visibleLegacyDraft.email.bodyParagraphs, "the exact visible body must be exported");
  assert.match(legacyExport.pack.primaryCta.url, /^https:\/\/nothingsport\.vercel\.app\/fixture\//, "legacy rows must hydrate their hidden fixture CTA");
  assert.match(legacyExport.pack.image.url, /^https:\/\/nothingsport\.vercel\.app\/assets\/marquee\//, "legacy rows must hydrate the current first-party image");
  assert.match(legacyExport.pack.image.altText, /Bledisloe Cup/, "legacy rows must hydrate image alt text");
  const merged = comms._test.mergeDraft(bledisloe.drafts, visibleLegacyDraft);
  assert.equal(merged.email.subject, visibleLegacyDraft.email.subject);
  assert.equal(merged.email.primaryCta.url, bledisloe.drafts.email.primaryCta.url);
  assert.equal(merged.email.image.publicUrl, bledisloe.drafts.email.image.publicUrl);
  const watching = first.candidates.find(item => !item.readyForExport);
  assert.throws(() => comms._test.exportTransition({ ...current, campaign_id:watching.campaignId, event_id:watching.eventId, content_hash:watching.contentHash, candidate:watching, draft_copy:watching.drafts }, { id:"00000000-0000-4000-8000-000000000001" }, exportTime), error => error.code === "campaign_not_ready_for_export");
  assert.throws(() => participation._test.candidateFor(watching.eventId), error => error.code === "fixture_not_participating", "watching stubs must not become public participation fixtures");

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
  assert.match(sql, /export_snapshot/);
  assert.match(sql, /export_stale/);
  assert.match(sql, /mailchimp-manual\.v1/);
  assert.match(sql, /state in \([^)]*'exported'/s);

  const commsSource = read("api/comms.js"), adminSource = read("admin.html") + read("config/admin-comms-ui.js"), participatePageSource = read("participate.html"), participationSource = read("api/participation.js"), worker = read("service-worker.js"), vercel = JSON.parse(read("vercel.json"));
  assert.match(commsSource, /app_metadata/);
  assert.doesNotMatch(commsSource, /user_metadata\?\.role/);
  assert.match(commsSource, /export-mailchimp/);
  assert.match(commsSource, /reopen-export/);
  assert.match(commsSource, /dismiss-campaign/);
  assert.match(commsSource, /restore-campaign/);
  assert.doesNotMatch(commsSource, /SEND NOW|send-now|import-consent|resend-broadcasts|instagram-mcp/);
  assert.doesNotMatch(commsSource, /nothingsports_marquee_subscribers|nothingsports_marquee_deliveries/);
  assert.match(adminSource, /Nothing Sport prepares every 5\/5-stakes suggestion; Mailchimp and your social scheduler send it\./);
  assert.match(adminSource, /src="\/assets\/brand\/web\/nothingsport-logo\.png"/);
  assert.match(participatePageSource, /src="\/assets\/brand\/web\/nothingsport-logo\.png"/);
  assert.doesNotMatch(adminSource + participatePageSource, /nothingsport-logo-(?:day|night)\.png|nothingsport-helm/i);
  assert.match(adminSource, /Prepare Mailchimp export/);
  assert.match(adminSource, /Primary CTA label/);
  assert.match(adminSource, /Image alt text/);
  assert.match(adminSource, /Suggestion stub only/);
  assert.match(adminSource, /draftCopy:draftFromCard/);
  assert.match(adminSource, /Approve \+ export selected/);
  assert.match(adminSource, /Save selected/);
  assert.match(adminSource, /Dismiss selected/);
  assert.match(adminSource, /Restore selected/);
  assert.match(adminSource, /Copy Hootsuite handoff/);
  assert.match(adminSource, /Copy complete handoff/);
  assert.match(adminSource, /Copy preview text/);
  assert.match(adminSource, /Copy headline/);
  assert.match(adminSource, /Copy primary CTA/);
  assert.match(adminSource, /Copy image URL/);
  assert.match(adminSource, /Copy alt text/);
  assert.match(adminSource, /Download image/);
  assert.doesNotMatch(adminSource, /Send now|connector.blocked|audienceCount|import-consent/i);
  assert.match(participationSource, /same_origin_required/);
  assert.match(participationSource, /rating_not_open/);
  assert.match(participationSource, /rating_window_closed/);
  assert.doesNotMatch(participationSource, /x-forwarded-for|cf-connecting-ip|request\.ip/i);
  assert.match(worker, /nothingsport-shell-v197/);
  assert.match(worker, /\/participate\.html/);
  assert.ok(vercel.rewrites.some(rule => rule.source === "/live" && rule.destination === "/participate.html"));
  assert.ok(vercel.rewrites.some(rule => rule.source === "/fixture/:eventId"));
  assert.ok(vercel.rewrites.some(rule => rule.source === "/admin/comms" && rule.destination === "/admin.html"));
  assert.match(read("scripts/redeploy-and-release.sh"), /data\/marquee-candidates\.v1\.json/);
  assert.match(read("scripts/redeploy-and-release.sh"), /assets\/marquee/);
  assert.doesNotMatch(adminSource + read("admin-comms.html") + read("participate.html"), /SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY|RESEND_WEBHOOK_SECRET|PARTICIPATION_SECRET/);

  console.log("Marquee communications validation passed (manual Mailchimp export, frozen revisions, stale-source recovery, dormant delivery compatibility and guest privacy). ");
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
