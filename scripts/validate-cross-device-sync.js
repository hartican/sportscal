#!/usr/bin/env node

const assert = require("node:assert/strict");
const userStateSync = require("../config/user-state-sync");

const lastSyncedState = {
  schemaVersion: "user-state.v1",
  preferences: {
    theme: "day",
    selectedBroadcasters: ["kayo"],
    viewing: { viewingWindowEnabled: true, startHourLocal: 7 },
  },
  profile: { timezone: "Australia/Sydney" },
};

const thisDeviceState = {
  ...lastSyncedState,
  preferences: {
    ...lastSyncedState.preferences,
    theme: "night",
  },
};

const latestCloudState = {
  ...lastSyncedState,
  updatedAt: "2026-08-12T01:00:00.000Z",
  profile: { timezone: "Australia/Sydney", futureProfileField: "keep" },
  preferences: {
    ...lastSyncedState.preferences,
    selectedBroadcasters: ["stan"],
    viewing: { viewingWindowEnabled: false, startHourLocal: 9 },
  },
};

const cloudFollowState = {
  ...latestCloudState,
  preferences: {
    ...latestCloudState.preferences,
    followFirst:{ collectionFollows:["collection:tennis:mens-top-10"] },
  },
};
const stalePreHydrationDevice = {
  ...lastSyncedState,
  preferences:{ ...lastSyncedState.preferences, followFirst:{ collectionFollows:[] } },
};
const unchangedStartupPatch = userStateSync.createPatch(stalePreHydrationDevice, stalePreHydrationDevice, {
  baseUpdatedAt:cloudFollowState.updatedAt,
});
assert.deepEqual(
  userStateSync.applyPatch(cloudFollowState, unchangedStartupPatch).preferences.followFirst.collectionFollows,
  ["collection:tennis:mens-top-10"],
  "a shell/data update must hydrate the saved cloud collection instead of treating a stale local empty list as a new unfollow",
);

const cloudOnlyResult = userStateSync.applyPatch(
  latestCloudState,
  userStateSync.createPatch(lastSyncedState, lastSyncedState, {
    baseUpdatedAt: "2026-08-12T00:00:00.000Z",
  })
);
assert.deepEqual(
  cloudOnlyResult.preferences,
  latestCloudState.preferences,
  "a session with no local changes must load the latest cloud settings exactly"
);

const localChanges = userStateSync.createPatch(lastSyncedState, thisDeviceState, {
  baseUpdatedAt: "2026-08-12T00:00:00.000Z",
});
const reconciledState = userStateSync.applyPatch(latestCloudState, localChanges);

assert.equal(reconciledState.preferences.theme, "night", "the setting changed on this device must win when it syncs last");
assert.equal(reconciledState.profile.futureProfileField, "keep", "newer cloud fields unknown to this device must survive reconciliation");
assert.deepEqual(
  reconciledState.preferences.selectedBroadcasters,
  ["stan"],
  "an untouched setting must inherit the latest cloud value"
);
assert.deepEqual(
  reconciledState.preferences.viewing,
  { viewingWindowEnabled: false, startHourLocal: 9 },
  "untouched nested settings must inherit the latest cloud values"
);

const repeatedPatch = userStateSync.createPatch(reconciledState, reconciledState, {
  baseUpdatedAt: latestCloudState.updatedAt,
});
assert.equal(userStateSync.hasChanges(repeatedPatch), false, "repeating the same sync must be idempotent");

const explicitChoices = {
  ...reconciledState,
  preferences: {
    ...reconciledState.preferences,
    followedSports: [],
    showSpoilers: false,
  },
};
const explicitPatch = userStateSync.createPatch(reconciledState, explicitChoices, {
  baseUpdatedAt: latestCloudState.updatedAt,
});
const explicitResult = userStateSync.applyPatch(reconciledState, explicitPatch);
assert.deepEqual(explicitResult.preferences.followedSports, [], "an explicit empty selection must sync");
assert.equal(explicitResult.preferences.showSpoilers, false, "an explicit false setting must sync");

const stateWithTemporarySetting = {
  ...explicitResult,
  preferences: { ...explicitResult.preferences, temporarySetting: "remove-me" },
};
const removedSettingState = {
  ...stateWithTemporarySetting,
  preferences: { ...stateWithTemporarySetting.preferences },
};
delete removedSettingState.preferences.temporarySetting;
const removalPatch = userStateSync.createPatch(stateWithTemporarySetting, removedSettingState, {
  baseUpdatedAt: latestCloudState.updatedAt,
});
assert.equal(
  Object.prototype.hasOwnProperty.call(userStateSync.applyPatch(stateWithTemporarySetting, removalPatch).preferences, "temporarySetting"),
  false,
  "a setting removed on this device must be removed when it writes last"
);

assert.throws(
  () => userStateSync.applyPatch({}, {
    schemaVersion: "user-state-patch.v1",
    baseUpdatedAt: null,
    changes: [{ path: ["preferences", "__proto__", "polluted"], value: true }],
  }),
  /invalid path/i,
  "unsafe object paths must be rejected"
);

async function validateActualConflictRetry(){
  const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  function source(startMarker, endMarker){
    const start = html.indexOf(startMarker), end = html.indexOf(endMarker, start);
    assert(start >= 0 && end > start, "the actual application orchestration must be tested");
    return html.slice(start, end);
  }
  const orchestration = source("async function reconcileCurrentServerState(", "\nfunction syncCurrentServerState(");
  const accountScope = source("function invalidateServerStateSyncScope(", "\nasync function reconcileCurrentServerState(");
  const preserve = source("function applyServerStatePreservingChanges(", "\nfunction queueServerStateSync(");
  const pins = source("function fixturePinAction(", "\nfunction clearAcknowledgedFixturePinCommands(");
  const clone = value => JSON.parse(JSON.stringify(value));
  const scenarios = [
    { name:"no conflict", conflicts:0 },
    { name:"one conflict", conflicts:1 },
    { name:"two conflicts", conflicts:2 },
    { name:"remote temporarily agrees with local edit", conflicts:2, converge:true },
    { name:"explicit empty, false and OFF", conflicts:1, explicit:true },
    { name:"removed local field", conflicts:1, remove:true },
    { name:"late local edit", conflicts:1, late:true },
    { name:"fixture pin authority", conflicts:1, pins:true },
    { name:"three conflicts stop", conflicts:3, failure:"user_state_conflict" },
    { name:"unrelated 409 stops", conflicts:1, failure:"client_update_required" },
    { name:"ended session stops", conflicts:1, failure:"invalid_refresh_token" },
    { name:"unchanged device loads remote", conflicts:0, unchanged:true },
  ];
  for (const scenario of scenarios){
    const baseline = clone(lastSyncedState);
    baseline.eventUserState = {};
    baseline.preferences.showSpoilers = true;
    baseline.preferences.notificationPreferences = { enabled:true };
    baseline.preferences.preferenceGraph = { entityFollows:[{ participantId:"team:football:arsenal", followLevel:"follow" }] };
    baseline.preferences.temporarySetting = "remove-me";
    let device = clone(baseline);
    if (!scenario.unchanged) device.preferences.theme = "night";
    if (scenario.explicit){
      device.preferences.selectedBroadcasters = [];
      device.preferences.showSpoilers = false;
      device.preferences.notificationPreferences.enabled = false;
      device.preferences.preferenceGraph.entityFollows = [];
    }
    if (scenario.remove) delete device.preferences.temporarySetting;
    if (scenario.pins) baseline.eventUserState = device.eventUserState = { match:{ pinRevision:1, excluded:true } };
    const originalDevice = clone(device);
    let cloud = clone(baseline);
    cloud.preferences.selectedBroadcasters = ["stan"];
    cloud.preferences.viewing = { viewingWindowEnabled:false, startHourLocal:9 };
    cloud.profile.futureProfileField = "keep";
    cloud.updatedAt = "2026-08-12T01:00:00.000Z";
    let writes = 0, reads = 0;
    const patches = [];
    const context = {
      USER_STATE_SYNC:userStateSync, structuredClone, serverSyncTimer:null, serverStateSyncGeneration:0, fixturePinQueue:{},
      serverStateBaseline:{ state:clone(baseline), updatedAt:"2026-08-12T00:00:00.000Z" },
      serverPersistence:{ state:"signedIn", user:{ id:"synthetic-account" } },
      clearTimeout(){}, currentServerStatePayload(){ return clone(device); }, emptyServerStatePayload(){ return {}; },
      setServerPersistence(value){ Object.assign(context.serverPersistence, value); }, setPreferenceRecovery(){},
      clearAcknowledgedFixturePinCommands(){}, applyServerState(state){ device = clone(state); },
      setServerStateBaseline(state){ context.serverStateBaseline = { state:clone(state), updatedAt:state.updatedAt }; },
      serverErrorEndsSession(error){ return error.code === "invalid_refresh_token"; }, showToast(){},
      serverSyncClient:{
        sessionSubject(){ return "synthetic-account"; },
        async loadState(){ reads += 1; return { user:{ id:"synthetic-account" }, state:clone(cloud) }; },
        async savePatch(patch){
          writes += 1;
          patches.push(clone(patch));
          if (writes <= scenario.conflicts){
            if (scenario.converge) cloud.preferences.theme = writes === 1 ? "night" : "day";
            cloud.preferences.viewing.startHourLocal = 9 + writes;
            cloud.updatedAt = `2026-08-12T0${writes + 1}:00:00.000Z`;
            if (scenario.pins) cloud.eventUserState.match = { pinRevision:2, excluded:false };
            const code = scenario.failure && scenario.failure !== "user_state_conflict" ? scenario.failure : "user_state_conflict";
            throw Object.assign(new Error("synthetic concurrent save"), { status:409, code });
          }
          assert.equal(patch.baseUpdatedAt, cloud.updatedAt, scenario.name + ": use the latest comparison timestamp");
          cloud = userStateSync.applyPatch(cloud, patch);
          cloud.updatedAt = "2026-08-12T05:00:00.000Z";
          if (scenario.late) device.preferences.selectedBroadcasters = ["kayo", "sbs"];
          return { user:{ id:"synthetic-account" }, state:clone(cloud) };
        },
      },
    };
    vm.createContext(context);
    vm.runInContext(pins + "\n" + preserve + "\n" + accountScope + "\n" + orchestration, context);
    if (scenario.failure){
      await assert.rejects(context.reconcileCurrentServerState(), error => error.code === scenario.failure, scenario.name);
      assert.equal(writes, scenario.failure === "user_state_conflict" ? 3 : 1, "unchanged retry cap and typed conflict requirement");
      assert.deepEqual(device, originalDevice, "failed saves retain the local copy");
      assert.equal(context.serverPersistence.state, scenario.failure === "invalid_refresh_token" ? "signedOut" : "error");
      continue;
    }
    await context.reconcileCurrentServerState();
    assert.equal(writes, scenario.unchanged ? 0 : scenario.conflicts + 1, scenario.name + ": bounded writes");
    assert.equal(reads, scenario.unchanged ? 1 : scenario.conflicts + 1, scenario.name + ": one new read per actual conflict");
    assert.equal(cloud.preferences.theme, scenario.unchanged ? "day" : "night", "deliberate local edit wins");
    assert.deepEqual(cloud.preferences.selectedBroadcasters, scenario.explicit ? [] : ["stan"], "a retry cannot turn an untouched local field into an overwrite");
    assert.equal(cloud.preferences.viewing.startHourLocal, 9 + scenario.conflicts, "concurrent remote field survives");
    assert.equal(cloud.profile.futureProfileField, "keep", "unknown remote fields survive");
    if (scenario.explicit){
      assert.equal(cloud.preferences.showSpoilers, false);
      assert.equal(cloud.preferences.notificationPreferences.enabled, false, "Remind OFF survives");
      assert.deepEqual(cloud.preferences.preferenceGraph.entityFollows, [], "explicit unfollow does not union old follows");
    }
    if (scenario.remove) assert.equal(Object.hasOwn(cloud.preferences, "temporarySetting"), false, "deliberate removal survives");
    if (scenario.late){
      assert.deepEqual(device.preferences.selectedBroadcasters, ["kayo", "sbs"], "an edit made during save stays local");
      const nextPatch = userStateSync.createPatch(context.serverStateBaseline.state, device);
      assert.deepEqual(nextPatch.changes.map(change => change.path.join(".")), ["preferences.selectedBroadcasters"], "only the late edit remains pending");
    }
    if (scenario.pins){
      assert.deepEqual(cloud.eventUserState.match, { pinRevision:2, excluded:false }, "retry retains remote fixture authority");
      assert.deepEqual(device.eventUserState.match, cloud.eventUserState.match, "unchanged old local pins cannot masquerade as edits made during sync");
    }
    for (const patch of patches){
      assert(!patch.changes.some(change => change.path[0] === "profile"), "no fabricated profile overwrite");
      assert(!patch.changes.some(change => change.path.join(".") === "preferences.viewing.startHourLocal"), "no fabricated viewing overwrite");
    }
  }
  console.log(`Actual account-sync orchestration: ${scenarios.length} synthetic conflict, consent, late-edit and failure scenarios passed.`);
}

validateActualConflictRetry().then(() => require("./lib/user-state-account-scope-tests")()).then(() => {
  console.log("Cross-device sync valid: actual retries preserve untouched cloud choices and original local intent.");
}).catch(error => { console.error(error); process.exitCode = 1; });
