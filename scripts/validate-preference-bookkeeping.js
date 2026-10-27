#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const profile = require('../config/profile-storage');
const patches = require('../config/user-state-sync');
const clone = value => JSON.parse(JSON.stringify(value));
const base = { theme: 'day', followedSports: [], followFirst: { notifications: { enabled: false },
  refinement: { distinctOpenCount: 1, lastOpenId: 'A', promptedAt: null, completedAt: null, deferred: false } },
  ratingPromptState: { sessionCount: 1, lastSessionId: 'A', dismissedAt: null },
  preferenceGraph: { profileId: 'local-A', updatedAt: 'A', entityFollows: [
    { participantId: 'team:canberra', profileId: 'local-A', followLevel: 'follow' } ],
    domainPreferences: [], competitionPreferences: [], viewing: { profileId: 'local-A' } } };
const desired = clone(base); desired.preferenceGraph.entityFollows[0].followLevel = 'unfollow';
const receipt = { ownerId: 'account-A', basePreferences: base, preferences: desired };
const metadata = clone(base);
metadata.preferenceGraph.profileId = metadata.preferenceGraph.entityFollows[0].profileId = metadata.preferenceGraph.viewing.profileId = 'local-B';
metadata.preferenceGraph.updatedAt = 'B';
metadata.followFirst.refinement.distinctOpenCount++; metadata.followFirst.refinement.lastOpenId = 'B'; metadata.followFirst.refinement.promptedAt = 'B';
metadata.ratingPromptState.sessionCount++; metadata.ratingPromptState.lastSessionId = 'B';
assert(profile.preferenceBaseMatches(receipt, metadata), 'device graph IDs and prompt bookkeeping must not create a preference conflict');
const applied = patches.applyPatch({ preferences: metadata }, patches.createPatch({ preferences: base }, { preferences: desired })).preferences;
assert(profile.preferenceIntentMatches(receipt, applied, patches), 'acknowledge the actual removal while retaining remote bookkeeping');
assert.equal(profile.preferenceIntentMatches(receipt, metadata, patches), false, 'bookkeeping compatibility cannot acknowledge an unapplied unfollow');
const witnessed={...receipt,originalReceipt:clone(receipt)};
assert(profile.preferenceIntentMatches(witnessed,applied,patches),'existing witnesses without optional proof retain their behaviour');
for(const proof of [undefined,null,false,{},'invalid',()=>false,()=>({}),()=>'yes',()=>{throw Error('Disposable invalid proof');}]){
  assert.equal(profile.preferenceIntentMatches({...witnessed,acceptsAcknowledgement:proof},applied,patches),false,'provided invalid or rejecting witness proof fails closed');
}
const pinned={...witnessed,acceptsAcknowledgement:value=>value.theme==='day'};
assert(profile.preferenceIntentMatches({...pinned},applied,patches),'RAM witness proof survives the existing spread construction');
assert.equal(profile.preferenceIntentMatches(pinned,{...applied,theme:'night'},patches),false,'proof also protects values outside the outgoing delta');
assert.equal(profile.preferenceIntentMatches({...witnessed,acceptsAcknowledgement:()=>true},metadata,patches),false,'proof cannot bypass the existing semantic ACK check');
for (const [label, mutate] of [
  ['theme', p => { p.theme = 'night'; }],
  ['explicit OFF', p => { p.followFirst.notifications.enabled = true; }],
  ['empty sports', p => { p.followedSports = ['football']; }],
  ['follow', p => { p.preferenceGraph.entityFollows[0].followLevel = 'unfollow'; }],
  ['unknown graph field', p => { p.preferenceGraph.futurePolicy = true; }],
  ['deliberate prompt choice', p => { p.followFirst.refinement.deferred = true; }],
  ['completed refinement', p => { p.followFirst.refinement.completedAt = 'B'; }],
  ['rating dismissal', p => { p.ratingPromptState.dismissedAt = 'B'; }],
]) {
  const remote = clone(metadata); mutate(remote);
  assert.equal(profile.preferenceBaseMatches(receipt, remote), false, label + ' must still hold the original intent');
}
const values = new Map(), storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
let bundle = profile.loadActiveProfile(storage);
bundle = profile.recordPreferenceIntent(storage, bundle, { ownerId: 'account-A', generation: 1,
  baseUpdatedAt: '2026-10-23T00:00:00Z', basePreferences: base, preferences: desired });
const original = profile.readPreferenceIntent(storage, bundle, 'account-A');
bundle = profile.advancePreferenceIntentBase(storage, bundle, original, { preferences: metadata, updatedAt: '2026-10-23T01:00:00Z' });
assert.deepEqual(profile.readPreferenceIntent(storage, bundle, 'account-A'), original, 'metadata compatibility does not rewrite an in-flight receipt baseline');
const newer = clone(desired); newer.theme = 'night';
bundle = profile.recordPreferenceIntent(storage, bundle, { ownerId: 'account-A', generation: 1,
  baseUpdatedAt: original.baseUpdatedAt, basePreferences: base, preferences: newer });
const pending = profile.readPreferenceIntent(storage, bundle, 'account-A');
bundle = profile.acknowledgePreferenceIntent(storage, bundle, original, applied, patches, { generation: 2, updatedAt: '2026-10-23T02:00:00Z' });
assert.deepEqual(profile.readPreferenceIntent(storage, bundle, 'account-A'), pending, 'another generation cannot advance the newer receipt');
bundle = profile.acknowledgePreferenceIntent(storage, bundle, original, applied, patches, { generation: 1, updatedAt: '2026-10-23T02:00:00Z' });
const continued = profile.readPreferenceIntent(storage, bundle, 'account-A');
assert.equal(continued.receiptId, pending.receiptId, 'metadata-compatible ACK never clears a newer edit');
assert.equal(continued.preferences.theme, 'night');
assert.equal(continued.preferences.preferenceGraph.entityFollows[0].followLevel, 'unfollow');
assert.equal(continued.basePreferences.preferenceGraph.profileId, 'local-B', 'only the owned ACK advances the newer receipt to the acknowledged base');
console.log('Preference bookkeeping: compatible metadata, exact unfollow ACK, eight real-choice holds and immutable in-flight baseline passed.');

require('./lib/user-state-seed-marker-tests')().then(()=>require('./lib/user-state-receipt-base-tests')()).then(()=>require('./lib/user-state-optional-view-tests')()).then(()=>require('./lib/user-state-collection-hydration-tests')()).then(()=>require('./lib/user-state-events-scope-tests')()).catch(error=>{console.error(error);process.exitCode=1;});
