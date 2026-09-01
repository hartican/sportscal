#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const migration = fs.readFileSync("supabase/migrations/20260901003907_preference_reset_recovery.sql", "utf8");
const api = fs.readFileSync("api/user-state.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const resetUi = fs.readFileSync("config/preference-reset-ui.js", "utf8");

assert.match(migration, /user_id uuid primary key references auth\.users \(id\) on delete cascade/i, "only the latest reset snapshot may exist for each account");
assert.match(migration, /on conflict \(user_id\) do update set[^]*preferences = excluded\.preferences/i, "a later reset must supersede the earlier recovery snapshot");
assert.match(migration, /interval '7 days'/i, "preference reset recovery must expire after seven days");
assert.match(migration, /enable row level security[^]*force row level security/i, "the recovery table must enforce RLS even for table owners");
assert.match(migration, /revoke all on table public\.nothingsports_preference_resets from authenticated/i, "signed-in clients must not read recovery snapshots directly");
assert.doesNotMatch(migration, /grant[^;]+nothingsports_preference_resets[^;]+to\s+(?:anon|authenticated)/i, "recovery snapshots must remain service-only");
assert.match(migration, /select \* into previous_state[^]*for update[^]*insert into public\.nothingsports_preference_resets[^]*update public\.nothingsports_user_state/i, "reset must lock, snapshot and update in one database transaction");
assert.match(migration, /where user_id = target_user_id\s+and reset_id = target_reset_id\s+and expires_at > restore_time[^]*for update/i, "undo must require account ownership, the current reset id and an unexpired snapshot");
assert.match(migration, /set preferences = recovery\.preferences/i, "undo must replace preference changes made since reset with the exact snapshot");
assert.match(migration, /delete from public\.nothingsports_preference_resets\s+where user_id = target_user_id and reset_id = target_reset_id/i, "successful undo must consume its recovery snapshot");
assert.match(migration, /delete from public\.nothingsports_preference_resets where expires_at <= reference_time/i, "expired snapshots must have a service purge path");

assert.match(api, /action === "reset-preferences"[^]*nothingsports_reset_preferences/, "the authenticated user-state API must expose reset through the atomic RPC");
assert.match(api, /action === "undo-preferences-reset"[^]*nothingsports_undo_preferences_reset/, "the authenticated user-state API must expose undo through the atomic RPC");
assert.match(api, /const accessToken = bearerToken\(request\);\s+const user = await authenticatedUser\(accessToken\);[^]*const body = requestBody\(request\);[^]*preferenceRecoveryCommand\(user, body\)/, "reset and undo must authenticate before accepting an action body");
assert.doesNotMatch(api, /target_user_id\s*:\s*(?:body|payload)\./, "the API must derive the reset owner from the authenticated session, never request input");

assert.match(html, /renderAccountSettings[^]*appendPreferenceRecoverySettings/, "the destructive reset must mount only inside Account settings");
assert.match(resetUi, /Data & recovery[^]*Reset all preferences…/, "the deferred recovery module must own the destructive reset surface");
assert.match(resetUi, /Warning 2 of 2 · type RESET to confirm[^]*input\.value\.trim\(\) !== "RESET"/, "the second warning must require typing RESET");
assert.match(resetUi, /Undo reset/, "the recovery control must remain visible until expiry");
assert.match(html, /function activeLocalPreferenceRecovery[^]*stored\.expiresAt[^]*localStorage\.removeItem\(PREFERENCE_RESET_STORAGE_KEY\)/, "signed-out profiles must purge expired device-local snapshots");
assert.doesNotMatch(html, /<script[^>]+preference-reset-ui/, "the reset UI must stay off the critical Feed startup path");

console.log("Preference reset recovery valid: double confirmation, seven-day exact undo, forced RLS, service-only RPC access, ownership and supersession are baked in.");
