# Owned pending-receipt baseline reconciliation — 24 October 2026 Sydney

Stage: Returned to the same final Spec/Standards pair after local review repairs; release remains blocked until that review and renewed qualification pass. This worker has not deployed or changed production data. Physical iPhone sync acceptance remains failed/open on live v590.

## Evidence and cause

The actual v590 phone diagnostic reaches `verify`, then holds with `preference_base_changed`, `pendingReceipt:true`, `baseCompatible:false`, matching owner/generation, and no save response. Its three difference lists contain `localView`, `entities`, `domains`; `receiptBaseMatchesAccepted:false`. These categories do not disclose real IDs, values or intended conflict resolution.

The deterministic red uses an actual persisted owned receipt, application bootstrap, queue, guard and API handler/normalizers, replacing only auth/database I/O. Bootstrap accepts newer remote state as its baseline while retaining the receipt's older base. Manual Sync now then refuses even demonstrably disjoint edits before upload. The red reproduced all three family lists and the false receipt-versus-accepted-base value, with zero writes and unchanged receipt bytes. Private preserved evidence: `ios-account-sync-20261024/receipt-base/red-bootstrap.log` in the Codex output folder. It is constructed causal evidence, not a capture of private customer choices.

A second preserved red, `red-new-receipt.log`, proves that simply using a latest-base ACK witness leaves a sequential newer same-field edit apparently conflicting with its own R1 save. The bounded post-ACK continuation below addresses this without rewriting intent before acknowledgement.

## Bounded implementation

- The existing deferred Account runtime contains a pure conservative planner. Before it loads, the original strict guard remains. No endpoint, SDK wire/schema, database, provider, scheduler, extra read, retry, timer, store or independent sync owner is added.
- Require a structurally valid owned receipt and dated remote state; all projected preferences outside entity/domain records and explicitly typed existing local views must remain unchanged. Existing narrowly named bookkeeping exclusions remain exact. Unknown fields/types and ambiguous shapes stay held.
- Entity identity uses `FOLLOW_FIRST.participantFollowIdentityKey`; duplicate canonical aliases are rejected. Domain identity is exact `sportDomainId`; duplicate/invalid IDs and legacy `sport:rally` are refused rather than guessed. Validate the existing record fields/types. Scoped string arrays stay atomic, never unioned.
- Compare original base, recorded intent and latest remote record/field. Apply only a recorded change when remote is unchanged there or already agrees. Keep independently changed identities/fields. Deletion versus edit and differing same-field edits stay held. Preserve explicit empty, removal and OFF; whole-list reset holds when it would discard an unseen remote addition.
- `followBrowse` allows only existing typed sport/category/section/page/scheduleScope fields; `feedCompact` is boolean. Keep remote views on the server. The unchanged `applyServerState` view owner retains this device's values. Unknown view keys/types cannot bypass the hold.
- A RAM-only ACK witness carries the exact original receipt identity and original receipt. Persisted receipt/base remains unchanged throughout reads, planning, conditional retry and save. A CAS conflict replans from that same original receipt against the new verified response.
- The existing profile ACK owner verifies the witness and identity. A matching R1 can clear only its original receipt. R2 retains its ID and generation; only the confirmed owned ACK can advance it. Its continuation is planned from original R1 intent to R2 intent against acknowledged state, using the same field/conflict policy. Unknown/ambiguous continuation remains byte-for-byte pending. Safely continued preferences feed the existing in-flight apply path so wholesale domain-array replay cannot discard independent remote domains locally.
- An already-applied/lost ACK also applies accepted remote choices locally even when bootstrap already accepted that timestamp. A no-save response with a newer receipt reports pending/error and retains retry instead of falsely claiming all choices synced.

## Local regression proof

`node scripts/validate-preference-bookkeeping.js` retains the existing bookkeeping and seed-marker suite and adds fifty-five cases through the generated Account helper, real bootstrap/queue/persisted receipt and actual API normalization/conditional handler. Coverage includes:

- Exact phone-family-shaped constructed failure becoming one existing read/save/owned ACK; actual preference-system Follow/template writers and full graph shape.
- Restart, explicit manual retry, already-applied/lost ACK, same-record independent field, remote/local removal, OFF, scoped empty and empty-versus-unseen-addition hold.
- Genuine entity/domain overlap, both deletion-versus-edit directions, notifications/other local choices, unknown root/graph/record/view, malformed view/record, missing/non-array lists, duplicate identity/alias/domain and invalid remote clock.
- Real conditional409 disjoint replan and true-overlap hold, unchanged receipt before ACK, no extra reads/retries, older ACK versus R2, sequential newer same-field R2, unknown R2 hold, mismatching normalized response and stale owner/generation at read/ACK.

Four malformed legacy-read fixtures are explicitly injected after a valid API write because the real API rejects malformed comparison metadata at ingress; the non-array read shape is injected into a disposable GET result because the ordinary row normalizer also rejects it. The mismatching ACK and invalid-clock controls are synthetic response mutations. They are refusal controls, not claims that production emitted those shapes.

Targeted checks: existing cross-device sync, server persistence, preference system/reset recovery, account awareness/diagnostic, startup budget, feed performance, generated critical/deferred bundle checks, browser-script syntax and `git diff --check`. Exact command receipts are in the private Codex output folder. These are local source/compiled/API checks; no native browser, installed-upgrade, hosted or physical proof is claimed by this worker.

## Returned review repairs — 24 October 2026

The final source pair identified two pre-release data-preservation defects. The original normalization refusal test asserted only receipt/status; it did not prove that the current and durable preferences retained the requested choices. The extended test now executes the actual `applyServerState`, profile/legacy storage writes and generated helper with disposable API responses. It reproduces current **and primary persisted** Unfollow becoming Priority while the receipt stays pending. The existing owned ACK helper now verifies semantic receipt acknowledgement before either applying the returned state or accepting its baseline. Refusal preserves all local bytes, receipt, current choices and accepted baseline. Valid later state can be accepted by an existing explicit retry. Five mismatch controls cover bounded/strict paths, OFF, empty and newer R2; the ordinary structurally identical timestamp advancement remains its existing exact-base behaviour.

The second defect used receipt-only patch entries despite already captured current preferences containing an ordinary Settings/standings write made after R1. Tests execute the actual `saveSettingsPreferences`, `saveStandingsSportKeys`, `savePreferences` and durable `commitSections` path, with rendering/optional callbacks and UI normalization inert over pre-normalized test preferences. The generated helper compares that existing current snapshot to the original receipt intent before planning, also on a compatible base. Only the exact named bookkeeping and typed view fields are allowed to differ; theme, notification OFF, empty standings and unknown choices hold visibly with zero user-state upload and unchanged current/persisted state and receipt. No writer or intent policy expands.

A causal continuation regression additionally shows a real ordinary Settings save after R2 is recorded being overwritten by blindly substituted continued preferences. The existing in-flight owner now supplies its already read current snapshot; the helper replays only the delta after the known R2 snapshot onto safe continued preferences, using the same bounded entity/domain merge to retain independent remote additions and ignore pointer-only array differences. The ordinary late choice remains current and durable, R2 retains its exact identity and recorded intent, and the next manual retry holds the unaccounted projected choice before any upload. A late pointer-only control still progresses without losing remote records. No additional state-payload read, network read, request or timer is added.

Three causal red logs and the in-memory single-guard counterfactual runner are private under `ios-account-sync-20261024/receipt-base`: `red-mismatching-ACK-591.log`, `red-unrecorded-Settings-591.log`, `red-R2-late-Settings-591.log`, `counterfactual-reds.cjs`. These remain constructed local proof; no customer data or production transport is involved. The suite now has fifty-five compiled/helper/bootstrap/API cases. Earlier ROOT native passes (four new cases on 85e81) are pre-fix evidence only; this returned source still requires the same pair and ROOT's renewed browser/normal/installed checks.

One further non-executable HTML comment moves into this source record to preserve the unchanged critical cap: “Recover only this valid timed-out attempt.” Its attempt/phase/validation guards remain executable and unchanged. The twelve earlier comment relocations and historical decision-record tails remain exact.

## Mounted cases authored for ROOT execution

The existing `scripts/validate-account-sync-recovery-browser.js` keeps all seventeen cases per engine and adds `receipt-base-disjoint` and `receipt-base-overlap`. Each uses the real mounted app, actual auth transport and disposable API handler, writes a real owned local intent, advances remote state, reloads with the real helper response held, proves stale-base bootstrap retains the exact receipt, then loads the real helper and clicks Sync now. Only existing automatic recovery is suppressed by a temporary offline fact during this deliberate manual-path test. No production request is allowed. Disjoint checks both independent entities/domains, local/server views and OFF; overlap checks no upload, intact receipt and enabled retry.

ROOT commands, using its existing pinned Node/Playwright runtime:

```sh
ACCOUNT_RECOVERY_BROWSER=chromium ACCOUNT_RECOVERY_CASE=receipt-base-disjoint node scripts/validate-account-sync-recovery-browser.js
ACCOUNT_RECOVERY_BROWSER=webkit ACCOUNT_RECOVERY_CASE=receipt-base-disjoint node scripts/validate-account-sync-recovery-browser.js
ACCOUNT_RECOVERY_BROWSER=chromium ACCOUNT_RECOVERY_CASE=receipt-base-overlap node scripts/validate-account-sync-recovery-browser.js
ACCOUNT_RECOVERY_BROWSER=webkit ACCOUNT_RECOVERY_CASE=receipt-base-overlap node scripts/validate-account-sync-recovery-browser.js
ACCOUNT_RECOVERY_CASE=all node scripts/validate-account-sync-recovery-browser.js
```

These new mounted cases are authored and syntax-checked, unexecuted by this worker. The full invocation includes nineteen cases per engine. Preserve failures and fix the actual path rather than relaxing the assertions or expanding the conflict policy.

## Native harness timing correction after frozen4667

ROOT's renewed Chromium `receipt-base-disjoint` run on4667 failed before any sync assertion: the visible Tune modal intercepted the native Sync now click. Preserve `/Users/jackhartican/Documents/AI/Codex/ios-account-sync-20261024/deploy-v591/native-4667/native-chromium-receipt-base-disjoint.log`; the remaining three cases were not run and no unchanged retry is claimed. Both final source reviews cleared4667 independently.

Source timing explains the test-order defect: `runStartupPostLoadActions` records the named automatic promptedAt marker, then schedules Tune visibility250ms later, independently of Account button readiness. The harness checked prompt visibility only once before waiting for that button, so the modal could appear after the check. The Not now button deliberately saves refinement.deferred; using it after the stale receipt would introduce a real unaccounted preference and should correctly hold under the reviewed product policy.

Only the mounted receipt-base test path changes: register a one-use visible-overlay handler around the existing native Sync click. It verifies an actual backdrop hit point, uses the existing native backdrop-dismiss gesture and waits for hidden state. That application gesture closes the prompt without saving a preference. The harness asserts projected choices and the exact owned receipt remain unchanged, then retains every original disjoint/overlap sync assertion. The handler is removed immediately after the action. No force click, hidden prompt mutation/suppression, sleep/time padding, blanket handler or test retry is added. Existing seventeen scenarios remain; no product, helper,591 metadata or historical decision record changes. This correction is syntax-checked only by the worker; ROOT owns renewed native execution and qualification.

## WebKit resource-lifetime diagnosis after frozen8dc85

ROOT's changed-source qualification passed Chromium disjoint and overlap. WebKit disjoint reached the final unchanged no-pageerror assertion and failed with a loopback `data/follow-schedule/football.json` access-control message; WebKit overlap was not run. Preserve the exact failure and `mounted-new-cases.json` under `/Users/jackhartican/Documents/AI/Codex/ios-account-sync-20261024/deploy-v591/native-8dc85`. No unchanged retry or error filtering is authorised.

Source inspection finds the schedule read itself wrapped in try/catch and Promise.allSettled. The receipt-base setup also edits Follow and deliberately reloads while deferred fixture readiness can still be active; the older api-stale branch explicitly drains fixture work before navigation. This makes old-document cancellation a leading hypothesis, not a proven cause. A real route/origin/response failure or a separately unhandled task remains possible.

The next frozen harness change is diagnostic only, scoped to the two receipt-base cases: bounded160-entry schedule-request/server-response/route/navigation lifetime traces, request-start document epoch, controlled-reload/manual-action phase and passive window error/unhandled-rejection facts. It captures no auth headers, bodies, preferences, identities or production traffic, creates no requests and never attaches a promise catch or prevents an error event. The original pageerror array and final empty-errors assertion remain unchanged. A failure prints the trace and completeness/drop count before that same gate. Read-only frame/console introspection failures are explicit diagnostic-unavailable facts, not new application exceptions. There is no loader, route/CORS policy, product, byte-budget, retry, sleep or assertion relaxation. Syntax/scope checks only are worker-owned; ROOT must allocate any changed-source native diagnostic run before a causal correction is selected.

## Fixture-work boundaries and separate cancellation control

ROOT allocated one af126 WebKit disjoint diagnostic. The closed/reaped receipt in `ios-account-sync-20261024/receipt-base/resource-lifetime-591/native-af126` records4.832seconds, exact clean source, Node24.21/PW1.62.1, no limit/retry and a complete zero-drop trace. It passed the original sync/error assertions. The trace nevertheless proves test-induced cancellation: epoch2 starts allowed same-origin Football at3514ms, controlled reload3515ms, browser cancellation3517ms and HTTP aborted/unfinished close3519ms, before epoch3. A second Football read is still active at the final trace. This identifies an independent fixture-lifetime overlap in the test; it does **not** prove that overlap caused the original8dc pageerror.

The prepared harness correction finishes baseline fixture readiness through the existing application owner before recording R1, drains currently registered fixture promises immediately before controlled reload, and finishes current fixture readiness/promises before the final unchanged no-pageerror gate. These are task completion waits, with no sleep/networkidle/retry or new product catch. The two existing readiness calls may coalesce with, or use, the existing loopback fixture reader; they add no account endpoint read/save. Boundary assertions retain projected account choices, exact pending receipt, authenticated owner/generation and accepted baseline; final counts assert no extra account state operation. Normal restart cases now also reject cancelled schedule requests. All original sync assertions remain and all nineteen cases per engine stay in the existing all-case matrix.

A separate explicit control, outside that normal matrix, holds the first real Football response after one original byte, deliberately navigates with its actual app read pending, then releases/cleans up the original response and requires an observed old-document cancellation. Original bytes, status and routing policy remain; the control uses no forced browser API cancellation or new application catch. It runs all original account/receipt/error assertions and final fixture settlement. Any genuine cancellation-induced pageerror therefore still fails instead of being hidden by the normal test's settlement. ROOT command: `ACCOUNT_RECOVERY_BROWSER=webkit ACCOUNT_RECOVERY_CASE=receipt-base-disjoint ACCOUNT_RECOVERY_CANCEL_CONTROL=1 node scripts/validate-account-sync-recovery-browser.js`. The control is separately labelled in its trace and cannot be selected for all-case runs.

Both the settlement correction and control are source-prepared/syntax-checked only. ROOT must allocate their native executions; no further runtime ran under the closed af126 lease. The af126 trace-only pass, original8dc failure, unrun prior overlap and exact source/hash receipts remain distinct. No claim of causal CORS repair, full native acceptance, product change or release follows from this preparation.

## Shared dependencies, cache and download budget

Shared seams: `index.html` reconciliation/ACK/apply, `config/profile-storage.js` ACK, generated app-shell runtime, deferred Account helper/build inputs, helper cache references and both decision records. Reconcile these with current main and other owners before integration. Original base is `3501e6f067da2303718fc75be0d092db9ba0905b`; this returned delta fast-forwards from ROOT's `2c70f89bd20132dd1041ee2712dbd1f0375f2521`.

Helper URL advances together in HTML and service worker from 5715 to 5716. ROOT already allocated coherent app/shell/worker591 on the isolated PR; this returned delta retains that metadata unchanged. ROOT must allocate a coherent shell/cache/app-version change and check exact served source, both installed upgrades and normal security/update gates.

The pinned Node24.21 metric after source/build changes is seven critical requests, 431419 gzip bytes, ceiling431441. Do not raise the ceiling. To preserve it, twelve redundant non-executable comments move from downloaded HTML into this record; all executable guards and UI text remain:

- Storage failure must not block reload; roll back exactly below; kept in memory below; session state is optional.
- Storage may be unavailable; ignore unavailable storage; fall through to a selectable browser prompt; badging is a progressive enhancement.
- Memory copy is already cleared; blocked storage keeps this session-only.
- Fence account switches before optional metadata; lost reply may follow commit.

## DEPLOY handover and acceptance

DEPLOY remains sole integrator/publisher and owns the final Spec/Standards pair, native allocation, full unchanged normal workflow, exact-SHA release, immutable READY/aliases/served bytes/security/update proof and repeated fresh public reads. No additional review pair is started here. Loading and Football coverage retain their separate owners and acceptance; this change does not qualify them.

After release, actual signed-in Home Screen iPhone proof must show Sync now acknowledges the original pending choices, correct account status, and cross-device preservation of deliberate removal/OFF/empty plus independent remote choices and Feed exclusion. A true conflict must remain visibly held with intact choices. If the phone still holds, its real IDs/intent remain unknown; do not treat this constructed disjoint proof as permission to choose sides. No forced logout, reinstall, storage clear, customer recovery, independent production-data change or automation restart.

Rollback: ROOT reverts this module, profile/HTML hooks, generated bundles and coherent helper/shell/cache references together. Persisted receipt format remains the existing six-field format and has no new key or reset; preserve every pending receipt and customer choice. Stop this worker at Ready.
