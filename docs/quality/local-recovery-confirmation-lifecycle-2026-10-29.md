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


## Cold helper lock and failure ownership — 29 October 2026

Source cb341ef56ce79c02bc35d16280c07007e969ad2f closes a deterministic gap before the first helper-load await. The actual scheduled Directory/Follow owner could start a normal sync after confirmation while that helper was cold. Recovery now acquires its existing busy state and invalidates old normal sync first, checks the captured accepted baseline and all existing identity/profile/session/modal/generation/raw/RAM/receipt fences, and settles issued work. A finally block releases busy on every exit.

Retained source failures also prove that a failed helper load could strand Syncing, and that a storage-uncertain failure crossing a settlement await could change another account’s status. Failure status updates now require the same captured account/session/profile/acquired generation. The captured owner’s uncertainty hold remains fail closed. No reset, new storage, request allowance, timeout, polling, database/configuration or scheduler change is introduced.

The existing mandatory recovery validator retains its original51 controls and invokes17 additional actual-producer/cold/failure controls with explicit fixture injection. Separate7 uncertainty and22 UI controls make97 source checks. Both source reviews and the independent final Spec review clear exactcb341. ROOT’s changed Chrome and WebKit loopback recovery cases pass the original one snapshot/one own-row read/zero reset RPC/zero recovery PUT assertions; reopen, unrelated state, held receipt removal and later genuine CAS/ACK remain tested. Temporary request tracing is retained in the output evidence and removed from the release tests. The exact caller of historical request8 remains unverified; source reproduction proves the cold-helper mechanism.

These are source and local browser results. Full exact-revision installed/release/hosted/live checks and the affected physical iPhone remain separate acceptance requirements.


## Scoped recovery read accounting — 29 October 2026

Complete Linux/Playwright1.64.1 evidence from installed run40829390693 shows the disputed normal GET begins in browser sequence9, before trusted confirmation10; the recovery snapshot follows at11 while recovery is locked. The normal handler owns one user-state read and one existing active-recovery lookup/expiry-cleanup RPC. That legacy RPC can delete expired reset metadata; it is not strictly read-only. The snapshot handler owns exactly one read, zero RPCs and zero user-state writes. These are loopback handler/stub observations, not managed database operations.

The old global metric began before the explanation opened, so its expected one total read incorrectly included legitimate existing work before confirmation. The test now preserves exact snapshot one-read/zero-RPC/zero-write assertions and reconciles every global counter against complete per-request evidence. At most one already-pending ordinary Follow GET before confirmation is admitted, with a same-realm immediately preceding pending-work witness and exact successful handler operations. This includes work that finishes before OPEN. Unknown, missing, truncated, failed, extra, post-confirm or unaccounted operations fail closed. No snapshot allowance, timeout, budget, app lock or ordinary-sync behavior changes. Raw global totals and ordinary expiry-cleanup activity remain visible.

The existing required recovery validator retains51 original and17 cold-loader controls and now invokes57 receipt/fault/actual-UI-and-scheduled-owner controls. The 57 include48 negative cases and a meaningful maximum-one-to-two mutation that admits forbidden duplicate normal work and is detected. The observed original global2-versus1 failure remains a regression fixture. Other state, receipt, authentication, restart, exact save/ACK and no-server-reset protections remain required. Separate7 uncertainty and22 UI lifecycle controls make154 source controls. Source proof alone does not replace both-engine installed/full release/hosted/live/physical-device acceptance.
