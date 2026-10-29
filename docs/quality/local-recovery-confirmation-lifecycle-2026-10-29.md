# Recovery confirmation survives legitimate Account rerenders

Source-only correction based on frozen PR100/695c5240135428b93ae6959b4fb070029b9fc6cd. No recovery data-policy, server/auth, storage-schema, generated version or release operation changes.

## Causal defect and RED

ROOT's actual Chrome natural-owner trial reached a visible/enabled recovery confirmation, then Account rerender detached it and created a hidden replacement. The deferred component mount always wrote a hidden warning; explanation/busy/status existed only on the discarded section. setServerPersistence legitimately rerenders an open Account; appendPreferenceRecoverySettings remounts the same component. This is a product lifecycle defect, not a reason to force click or reopen the warning in the test.

Before changing behavior, the actual module's mount → explanation click → same-body legitimate remount failed deterministically in the disposable DOM test (0.215s), with network/child/worker attempts zero. ui-lifecycle-red-proof retains the RED. No native replay was performed by this source owner.

## Existing component and scope

The existing deferred recovery component now owns its ephemeral local-recovery state in a WeakMap keyed by the existing settings body. It preserves only explanation-expanded/status/busy across the same account/profile/SDK session generation/settings opening. The existing settingsViewportAnchor object, created by openSettings and nulled by closeSettings, supplies the opening token; no parallel settings lifetime counter or persistent store is introduced.

A readonly adapter captures owner/profile/session and that existing token. Closing Settings or rendering another section clears/invalidate this component state. Changing identity/profile/session/opening resets it. Detached old sections cannot confirm; a new current section still requires an explicit fresh click after the explanation is open. A request in progress keeps replacement controls disabled and progress visible. Old completions cannot update a new scope.

The UI's captured current predicate is passed into the existing local action and checked after helper loading and throughout its existing asynchronous/current/readback gates. Closing/leaving/reopening during a pending read therefore refuses before commit, even if the same account returns. The action's own server-sync generation invalidation is deliberately not a new UI lifetime: owner/profile/session/modal remain the same and busy must survive its own rerenders. Existing requireCurrent and account/receipt/storage guards remain.

Internal direct source-controller calls without UI scope retain their previous operation guards for the original source harness; the sole production UI caller always supplies the captured confirmation scope. No automatic confirmation or replacement action is invoked by restoring visual state.

Reset/Undo handlers and Account form are unchanged. The two existing optional clear calls tolerate older module shapes. The deferred module query now uses the existing app-shell-version rather than a fixed423 cache token, ensuring release-matched component bytes; ROOT still owns the version/cache/runtime allocation and generated outputs.

## Validation and remaining gates

Final source controls: 51 recovery cases (original49 plus two actual action UI-cancellation guards) and22 component lifecycle/adapter/Reset/Undo/cache checks. Real module, profile storage, existing normalizer/payload/planner/CAS/ACK and the existing disposable DOM/service doubles. Tests cover same-scope remount, stale detached controls, fresh explanation, busy preservation through own sync invalidation, double-confirm refusal, identity/profile/session/opening change, clear-on-navigation, stale completion, error/uncertainty message persistence, actual readonly adapter predicates, current/stored receipt preservation and refusal before commit.

Both finite Node runs passed with zero network/child/worker attempts; no browser/service/customer operation. Source pins unchanged during final controls. Earlier failed test-fixture attempts remain retained; no passing fixture was waived. This is not actual Chrome/WebKit or phone acceptance.

Shared files: config/preference-reset-ui.js and index.html. ROOT must integrate with its current recovery599 source/budget/cache work, regenerate through its single release lane, rerun the unchanged native actual recovery case in Chrome/WebKit and all required gates. Frozen PR100/695 and comprehensive backup checkpoint remain untouched. Rollback is reverting this correction and its release outputs; no persistent/production-data rollback is required. Stop at source Ready with a draft PR and handover.
