# Owned pending-receipt baseline reconciliation — 24 October 2026 Sydney

Stage: Ready for DEPLOY review and combined qualification. This worker has not deployed or changed production data. Physical iPhone sync acceptance remains failed/open on live v590.

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

`node scripts/validate-preference-bookkeeping.js` retains the existing bookkeeping and seed-marker suite and adds forty-two cases through the generated Account helper, real bootstrap/queue/persisted receipt and actual API normalization/conditional handler. Coverage includes:

- Exact phone-family-shaped constructed failure becoming one existing read/save/owned ACK; actual preference-system Follow/template writers and full graph shape.
- Restart, explicit manual retry, already-applied/lost ACK, same-record independent field, remote/local removal, OFF, scoped empty and empty-versus-unseen-addition hold.
- Genuine entity/domain overlap, both deletion-versus-edit directions, notifications/other local choices, unknown root/graph/record/view, malformed view/record, missing/non-array lists, duplicate identity/alias/domain and invalid remote clock.
- Real conditional409 disjoint replan and true-overlap hold, unchanged receipt before ACK, no extra reads/retries, older ACK versus R2, sequential newer same-field R2, unknown R2 hold, mismatching normalized response and stale owner/generation at read/ACK.

Four malformed legacy-read fixtures are explicitly injected after a valid API write because the real API rejects malformed comparison metadata at ingress; the non-array read shape is injected into a disposable GET result because the ordinary row normalizer also rejects it. The mismatching ACK and invalid-clock controls are synthetic response mutations. They are refusal controls, not claims that production emitted those shapes.

Targeted checks: existing cross-device sync, server persistence, preference system/reset recovery, account awareness/diagnostic, startup budget, feed performance, generated critical/deferred bundle checks, browser-script syntax and `git diff --check`. Exact command receipts are in the private Codex output folder. These are local source/compiled/API checks; no native browser, installed-upgrade, hosted or physical proof is claimed by this worker.

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

## Shared dependencies, cache and download budget

Shared seams: `index.html` reconciliation/ACK/apply, `config/profile-storage.js` ACK, generated app-shell runtime, deferred Account helper/build inputs, helper cache references and both decision records. Reconcile these with current main and other owners before integration. Base is `3501e6f067da2303718fc75be0d092db9ba0905b`.

Helper URL advances together in HTML and service worker from 5715 to 5716. Shell/app release allocation remains ROOT-owned; this branch retains baseline shell590 until integration. ROOT must allocate a coherent shell/cache/app-version change and check exact served source, both installed upgrades and normal security/update gates.

The pinned Node24.21 metric after source/build changes is seven critical requests, 431407 gzip bytes, ceiling431441. Do not raise the ceiling. To preserve it, twelve redundant non-executable comments move from downloaded HTML into this record; all executable guards and UI text remain:

- Storage failure must not block reload; roll back exactly below; kept in memory below; session state is optional.
- Storage may be unavailable; ignore unavailable storage; fall through to a selectable browser prompt; badging is a progressive enhancement.
- Memory copy is already cleared; blocked storage keeps this session-only.
- Fence account switches before optional metadata; lost reply may follow commit.

## DEPLOY handover and acceptance

DEPLOY remains sole integrator/publisher and owns the final Spec/Standards pair, native allocation, full unchanged normal workflow, exact-SHA release, immutable READY/aliases/served bytes/security/update proof and repeated fresh public reads. No additional review pair is started here. Loading and Football coverage retain their separate owners and acceptance; this change does not qualify them.

After release, actual signed-in Home Screen iPhone proof must show Sync now acknowledges the original pending choices, correct account status, and cross-device preservation of deliberate removal/OFF/empty plus independent remote choices and Feed exclusion. A true conflict must remain visibly held with intact choices. If the phone still holds, its real IDs/intent remain unknown; do not treat this constructed disjoint proof as permission to choose sides. No forced logout, reinstall, storage clear, customer recovery, independent production-data change or automation restart.

Rollback: ROOT reverts this module, profile/HTML hooks, generated bundles and coherent helper/shell/cache references together. Persisted receipt format remains the existing six-field format and has no new key or reset; preserve every pending receipt and customer choice. Stop this worker at Ready.
