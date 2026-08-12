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

console.log("Cross-device sync valid: local changes win while untouched settings inherit the latest cloud state.");
