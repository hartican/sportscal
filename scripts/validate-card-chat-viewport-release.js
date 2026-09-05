#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const chatApi = fs.readFileSync(path.join(root, "api", "chat.js"), "utf8");
const authApi = fs.readFileSync(path.join(root, "api", "auth.js"), "utf8");
const serverSync = fs.readFileSync(path.join(root, "config", "server-sync.js"), "utf8");
const mediaUi = fs.readFileSync(path.join(root, "config", "chat-media-ui.js"), "utf8");
const mediaCss = fs.readFileSync(path.join(root, "config", "chat-media-ui.css"), "utf8");

const fixtureReconciliation = require("../config/feed-fixture-reconciliation");
const mediaContract = require("../config/chat-media");
const refreshPolicy = require("../config/session-refresh-policy");

const placeholder = {
  eventId:"event:afl:legacy-cd_m20260142603",
  canonicalEventId:"event:afl:cd_m20260142603",
  name:"Geelong Cats v Lowest-ranked WF Winner",
  competitionId:"competition:afl",
  startTimeUtc:"2026-09-04T09:40:00.000Z",
  participantIds:["team:afl:geelong-cats", "team:afl:carlton"],
  manualPin:true,
};
const canonical = {
  eventId:"event-afl-cd_m20260142603",
  canonicalEventId:"event:afl:cd_m20260142603",
  name:"Geelong Cats v Carlton",
  competitionId:"competition:afl",
  startTimeUtc:"2026-09-04T09:40:00.000Z",
  participantIds:["team:afl:geelong-cats", "team:afl:carlton"],
  editorialNarrative:{ synopsis:"Carlton's rescue faces its elimination test." },
};

assert.equal(
  fixtureReconciliation.semanticFixtureKey(placeholder),
  fixtureReconciliation.semanticFixtureKey(canonical),
  "provider and saved placeholder IDs must converge on participant/time identity"
);
assert.deepEqual(
  fixtureReconciliation.reconcileFixtures([canonical], [placeholder]),
  [canonical],
  "canonical current data must replace the stale saved placeholder instead of appending a duplicate"
);
assert.deepEqual(
  fixtureReconciliation.repairSavedFixture(placeholder, [canonical]),
  { fixture:canonical, aliases:[placeholder.eventId] },
  "saved actions must retain old aliases while adopting canonical current fixture data"
);

assert.deepEqual(mediaContract.targetDimensions(4032, 3024), { width:1080, height:810 });
assert.deepEqual(mediaContract.targetDimensions(1170, 2532), { width:499, height:1080 });
assert.deepEqual(mediaContract.targetDimensions(800, 600), { width:800, height:600 });
assert.equal(mediaContract.shouldCompress("image/png"), true);
assert.equal(mediaContract.shouldCompress("image/gif"), false, "animated GIFs must not be transcoded");
assert.equal(mediaContract.MAX_STATIC_IMAGE_EDGE, 1080);
assert.deepEqual(mediaContract.outputPlan("image/png"), { contentType:"image/png", quality:null, extension:".png", preserveAlpha:true });
assert.equal(mediaContract.outputPlan("image/webp").contentType, "image/webp", "transparent WebP inputs must not be flattened into JPEG");

assert.equal(refreshPolicy.classify({ status:503, code:"auth_upstream_failed" }), "retryable");
assert.equal(refreshPolicy.classify({ status:429, code:"too_many_requests" }), "retryable");
assert.equal(refreshPolicy.classify({ status:400, code:"refresh_token_not_found" }), "terminal");
assert.equal(refreshPolicy.classify({ status:400, code:"refresh_token_already_used" }), "terminal");

assert.match(html, /control\("minimise", "Minimise"/);
assert.match(html, /control\("expand", "Expand"/);
assert.match(html, /expand\.setAttribute\("aria-expanded", String\(expanded\)\)/);
assert.match(html, /recordEventFeedAction\(ev, "open", \{ surface:"card-control" \}\)/);
assert.doesNotMatch(html, /Read more/);
assert.doesNotMatch(html, /Show less/);
assert.doesNotMatch(html, /Less of this|More of this/);
assert.match(html, /if \(!eventIsHighStakesSuggestion\(ev\)\) return \[\]/);
assert.match(html, /interactionName:"card-dismiss-undo"/);
assert.match(mediaCss, /chat-gif-picker[^\n]*position:\s*fixed/s);
assert.match(mediaUi, /Preparing…/);
assert.match(mediaUi, /Uploading/);
assert.match(mediaUi, /Ready — tap Send/);
assert.match(html, /visualViewport/);
assert.match(html, /window\.setTimeout\(stopStabilizing, 1250\)/);
assert.match(html, /if \(observedMutationElement\) resizeObserver\?\.observe/);
assert.match(html, /lateRestoreTimer = window\.setInterval/);
assert.match(html, /padding-bottom: calc\(124px \+ env\(safe-area-inset-bottom\)\)/);
assert.match(html, /function serverErrorEndsSession\(error\)/);
assert.doesNotMatch(html, /const signedOut = error\?\.status === 401/);
assert.match(serverSync, /navigator\.locks/);
assert.match(serverSync, /BroadcastChannel/);
assert.match(serverSync, /activeRefreshToken !== event\.data\.previousRefreshToken/);

assert.match(chatApi, /gif-import/);
assert.match(chatApi, /source_metadata/);
assert.doesNotMatch(chatApi, /gif-import[\s\S]{0,3000}body\.originalUrl/);
assert.match(chatApi, /finalHostAllowed/);
assert.match(authApi, /refresh_session_terminal/);
assert.match(authApi, /refresh_session_retryable/);
assert.doesNotMatch(serverSync, /catch\s*\(error\)\s*\{\s*clearSession\(\);\s*throw error;/);

const migrations = fs.readdirSync(path.join(root, "supabase", "migrations"))
  .filter(name => name.endsWith("_chat_media_source_metadata.sql"));
assert.ok(migrations.length, "chat media provenance migration must exist");
const migration = fs.readFileSync(path.join(root, "supabase", "migrations", migrations.at(-1)), "utf8");
assert.match(migration, /source_metadata\s+jsonb\s+not null\s+default\s+'\{\}'::jsonb/i);
assert.match(migration, /force row level security/i);
assert.match(migration, /revoke all[^;]+authenticated/i);

console.log("Card, chat and viewport release validation passed.");
