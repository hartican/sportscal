#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { build } = require("./build-marquee-candidates");
const comms = require("../api/comms");
const participation = require("../api/participation");
const webhook = require("../api/comms-webhook");
const commsUi = require("../config/admin-comms-workspace");

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
  assert.equal(comms._test.editableState("exported"), true, "handoff snapshots must never lock editing");
  assert.equal(comms._test.editableState("approved"), true, "legacy approved rows remain editable");
  assert.equal(comms._test.editableState("cancelled"), false);
  assert.doesNotThrow(() => comms._test.assertFirstPartyImage({ publicUrl:"https://nothingsport.vercel.app/assets/marquee/example.jpg" }));
  assert.throws(() => comms._test.assertFirstPartyImage({ publicUrl:"https://unapproved.example/hero.jpg" }), error => error.code === "hero_asset_not_approved", "crafted autosave payloads must not introduce arbitrary external media");
  assert.equal(commsUi.countdownLabel("", Date.parse("2026-08-31T00:00:00Z")), "Send date pending");
  assert.equal(commsUi.countdownLabel("2026-09-01T08:00:00Z", Date.parse("2026-08-31T00:00:00Z")), "Send in 1d 08h");
  assert.equal(commsUi.countdownLabel("2026-08-30T22:00:00Z", Date.parse("2026-08-31T00:00:00Z")), "Overdue by 02h");
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
  const exported = comms._test.manualHandoffPack(current, exportTime);
  assert.equal(exported.schemaVersion, "manual-content-handoff.v2");
  assert.equal(exported.campaignRevision, 3);
  assert.equal(exported.contentHash, candidate.contentHash);
  assert.equal(exported.exportedAt, exportTime);
  assert.deepEqual(comms._test.manualHandoffPack(current, exportTime), exported, "same saved revision and timestamp must yield an idempotent handoff payload");
  assert.doesNotMatch(JSON.stringify(exported), /recipient|email_normalized|subscriber/i, "manual handoff exports must never contain recipients");
  assert.equal(comms._test.mailchimpPack(current, exportTime).schemaVersion, "mailchimp-manual.v1", "legacy exports remain readable");
  const snapshot = comms._test.versionSnapshot(current, "test-autosave");
  assert.equal(snapshot.campaign_revision, 3);
  assert.equal(snapshot.reason, "test-autosave");
  assert.deepEqual(snapshot.snapshot.draftCopy.email, candidate.drafts.email);
  const changedCandidate = { ...candidate, contentHash:"a".repeat(64) };
  const changed = comms._test.syncPatch({ ...current, state:"exported", exported_at:exportTime, export_snapshot:exported }, changedCandidate);
  assert.equal(changed.patch.state, "needs_reapproval");
  assert.equal(changed.patch.export_stale, true);
  assert.equal(changed.patch.campaign_revision, 4);
  assert.equal(Object.hasOwn(changed.patch, "export_snapshot"), false, "source changes must retain the previous export for audit");
  assert.equal(changed.patch.draft_copy.email.subject, candidate.drafts.email.subject, "source refreshes must retain an operator's visible draft");
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
  const legacyExport = comms._test.manualHandoffPack(legacyRow, exportTime);
  assert.equal(legacyExport.subject, visibleLegacyDraft.email.subject, "the exact visible operator subject must be handed off");
  assert.deepEqual(legacyExport.bodyParagraphs, visibleLegacyDraft.email.bodyParagraphs, "the exact visible body must be handed off");
  assert.match(legacyExport.primaryCta.url, /^https:\/\/nothingsport\.vercel\.app\/fixture\//, "legacy rows must hydrate their hidden fixture CTA");
  assert.match(legacyExport.image.url, /^https:\/\/nothingsport\.vercel\.app\/assets\/marquee\//, "legacy rows must hydrate the current first-party image");
  assert.match(legacyExport.image.altText, /Bledisloe Cup/, "legacy rows must hydrate image alt text");
  const merged = comms._test.mergeDraft(bledisloe.drafts, visibleLegacyDraft);
  assert.equal(merged.email.subject, visibleLegacyDraft.email.subject);
  assert.equal(merged.email.primaryCta.url, bledisloe.drafts.email.primaryCta.url);
  assert.equal(merged.email.image.publicUrl, bledisloe.drafts.email.image.publicUrl);
  const watching = first.candidates.find(item => !item.readyForExport);
  assert.equal(comms._test.manualHandoffPack({ ...current, campaign_id:watching.campaignId, event_id:watching.eventId, content_hash:watching.contentHash, candidate:watching, draft_copy:watching.drafts, proposed_send_at:null }, exportTime).suggestedSendAt.utc, "", "suggestion stubs remain handoff-capable without inventing a send date");
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
  const tables = ["nothingsports_marquee_campaigns","nothingsports_marquee_campaign_versions","nothingsports_comms_assets","nothingsports_marquee_subscribers","nothingsports_marquee_deliveries","nothingsports_fixture_devices","nothingsports_fixture_participation","nothingsports_fixture_write_limits"];
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
  assert.match(sql, /manual-content-handoff\.v2/);
  assert.match(sql, /nothingsports_marquee_autosave/);
  assert.match(sql, /expected_revision/);
  assert.match(sql, /nothingsports-comms-assets/);
  assert.match(sql, /allowed_mime_types/);
  assert.match(sql, /state in \([^)]*'exported'/s);
  assert.match(sql, /alter table public\.nothingsports_marquee_campaigns alter column proposed_send_at drop not null/i);

  const commsSource = read("api/comms.js") + read("lib/comms-workspace.js"), adminSource = read("admin.html") + read("config/admin-comms-workspace.js"), participatePageSource = read("participate.html"), participationSource = read("api/participation.js"), worker = read("service-worker.js"), vercel = JSON.parse(read("vercel.json"));
  assert.match(commsSource, /app_metadata/);
  assert.doesNotMatch(commsSource, /user_metadata\?\.role/);
  assert.match(commsSource, /export-mailchimp/);
  assert.match(commsSource, /reopen-export/);
  assert.match(commsSource, /dismiss-campaign/);
  assert.match(commsSource, /restore-campaign/);
  assert.doesNotMatch(commsSource, /SEND NOW|send-now|import-consent|resend-broadcasts|instagram-mcp/);
  assert.doesNotMatch(commsSource, /nothingsports_marquee_subscribers|nothingsports_marquee_deliveries/);
  assert.match(adminSource, /An autosaving workspace for Mailchimp, Hootsuite and staged live assets/);
  assert.match(adminSource, /src="\/assets\/brand\/web\/nothingsport-logo\.png"/);
  assert.match(participatePageSource, /src="\/assets\/brand\/web\/nothingsport-logo\.png"/);
  assert.doesNotMatch(adminSource + participatePageSource, /nothingsport-logo-(?:day|night)\.png|nothingsport-helm/i);
  assert.match(adminSource, /manual-content-handoff\.v2/);
  assert.match(adminSource, /Primary CTA label/);
  assert.match(adminSource, /Image alt text/);
  assert.match(adminSource, /draftCopy:draft/);
  assert.match(adminSource, /Unsaved changes/);
  assert.match(adminSource, /Saving…/);
  assert.match(adminSource, /Saved at/);
  assert.match(adminSource, /Load server revision/);
  assert.match(adminSource, /data-save-retry/);
  assert.match(adminSource, /Undo/);
  assert.match(commsSource, /undo_available/);
  assert.match(adminSource, /Publish live revision/);
  assert.match(adminSource, /Upload approved media/);
  assert.match(adminSource, /form\.append\("cacheControl","31536000"\)/, "signed Supabase uploads must use the supported multipart upload contract");
  assert.match(adminSource, /Copy handoffs/);
  assert.match(adminSource, /Copy Hootsuite handoff/);
  assert.match(adminSource, /Copy complete handoff/);
  assert.match(adminSource, /Copy preview/);
  assert.match(adminSource, /Download hero/);
  assert.match(adminSource, /Send date pending/);
  assert.match(adminSource, /Overdue by/);
  assert.match(adminSource, /Sync candidates/);
  assert.doesNotMatch(adminSource, /Send now|connector.blocked|audienceCount|import-consent/i);
  assert.match(participationSource, /same_origin_required/);
  assert.match(participationSource, /rating_not_open/);
  assert.match(participationSource, /rating_window_closed/);
  assert.doesNotMatch(participationSource, /x-forwarded-for|cf-connecting-ip|request\.ip/i);
  assert.match(worker, /nothingsport-shell-v199/);
  assert.match(worker, /admin-comms-workspace\.js\?v=199/);
  assert.match(worker, /marquee-live-renderer\.js\?v=199/);
  assert.match(worker, /\/participate\.html/);
  assert.ok(vercel.rewrites.some(rule => rule.source === "/live" && rule.destination === "/participate.html"));
  assert.ok(vercel.rewrites.some(rule => rule.source === "/fixture/:eventId"));
  assert.ok(vercel.rewrites.some(rule => rule.source === "/admin/comms" && rule.destination === "/admin.html"));
  assert.match(read("scripts/redeploy-and-release.sh"), /data\/marquee-candidates\.v1\.json/);
  assert.match(read("scripts/redeploy-and-release.sh"), /assets\/marquee/);
  assert.doesNotMatch(adminSource + read("admin-comms.html") + read("participate.html"), /SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY|RESEND_WEBHOOK_SECRET|PARTICIPATION_SECRET/);

  console.log("Marquee communications validation passed (autosave, immutable history, manual-content handoffs, staged live publishing, dormant delivery compatibility and guest privacy).");
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
