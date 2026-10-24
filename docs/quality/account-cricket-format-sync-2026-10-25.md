# Existing Cricket format choices at the receipt boundary

Prepared 25 October 2026 Sydney. Source-tested draft handover to DEPLOY; stop at Ready. ROOT remains the sole integrator and publisher.

## Evidence and limit

The actual592 phone copy reports `preference_base_changed`, initial `record_validation / record_unknown_field / intent / entities`, a pending receipt, matching owner and live-job generation, and a nonmatching receipt generation. It records one SDK load-call start and zero save-call starts; those counters alone do not establish network activity or server effects. The diagnostic does not expose the unknown field or private records.

`config/cricket-coverage.js:setFormatFollow` already writes `cricketFormats`. Both `follow-first.migratePreferences` and the existing user-state API normalization retain it. The receipt planner previously allowed only `profileId`, `participantId` and `followLevel` on entity records. An ordinary format choice was therefore rejected whenever independent remote changes required this planner.

The regression uses the real writer, a real profile receipt persisted and read again after bootstrap, the generated Account helper, the actual serialized manual sync path and actual `/api/user-state` handler/normalizers/CAS. Only authentication and database I/O use disposable accounts. It reproduces the phone's three preference families, exact intent/entity unknown-field refusal, matching live generation and nonmatching older receipt generation. The current request owner is valid; that older receipt generation is observed, not the cause of this refusal.

Two executions against the unchanged helper fail. Removing only `cricketFormats` from the disposable writer output passes with the same older receipt generation. Restoring the writer output and adding the typed field passes. An explicit replay of the `6aa5979` helper also exits1 at the expected assertion. This establishes this source schema bug; it does **not** identify the private phone field or prove its remaining edits are independent.

## Repair

Add only `cricketFormats` to the existing entity field contract: an array of unique strings from `Tests`, `ODIs`, `T20Is`, `BBL`. These spellings come from the established writer and readers. Empty is valid. Do not coerce malformed data or filter unknown values into a valid decision.

The existing field comparison handles the entire array, including its order and presence. Preserve the writer's order. Whole-team `PREFERENCE_SYSTEM.setEntityFollow` can remove this field; absence (unrestricted formats) remains distinct from an explicit empty list. Different concurrent edits to this field hold; there is no format union or per-element merge. No other unknown record field becomes valid.

The existing current-choice comparison, owner/generation fences, original receipt, conditional version, real409 reread/recalculation, exact owned ACK, R2 continuation, ordinary Settings and empty/OFF/unfollow protections are unchanged. No API, SDK, database, config, storage key, request, polling, retry, scheduler or customer-data change is added. No sign-out, reinstall, reset, storage clear or restoration is performed. The deliberate 11 follows are not changed by this work.

## Qualification

Node24.21.0, existing runtime; no dependency installation. All 12 affected commands passed:

- `node scripts/validate-preference-bookkeeping.js`
- `node scripts/validate-account-sync-diagnostic.js`
- `node scripts/validate-account-awareness.js`
- `node scripts/validate-cross-device-sync.js`
- `node scripts/validate-server-persistence.js`
- `node scripts/validate-preference-system.js`
- `node scripts/validate-preference-reset-recovery.js`
- `node scripts/validate-cricket-coverage.js`
- `node scripts/validate-startup-budget.js`
- `node scripts/validate-feed-performance.js`
- `node scripts/build-app-shell-runtime.js --check`
- `node scripts/build-deferred-sports-ui.js --check`

The bookkeeping gate now runs 78 receipt cases: all55 previous cases plus23 Cricket cases. New coverage includes source-created fields, removal of one/last format, explicit empty/unfollow, BBL alias, untouched base/remote formats, real whole-team field removal and remote absence, exact writer order, conflicting formats/empty/order, malformed enum/type/duplicates/null and malformed base/remote records, unknown field refusal, actual conditional409 disjoint/conflicting outcomes, R2 format edits during older ACK and a semantically wrong successful format response. Cricket cases use the actual apply/profile persistence path. Refusals preserve current preferences, persisted receipt bytes and accepted baseline. A mismatching ACK cannot clear the pending receipt; a later deliberate retry may accept the genuine saved state.

One new `receipt-base-cricket` scenario joins the existing mounted recovery matrix (20 per engine). It creates the field with the actual browser writer, persists/reloads the receipt, clicks the mounted manual retry and checks accepted formats, unrelated remote choices and retained device-local views. Existing resource/error gates are unchanged. **Browser/native/installed execution is reserved to ROOT and is not claimed here.** Previous6aa results can support unchanged seams, but do not qualify the new case or generated helper.

Static budgets against6aa: 7 critical requests and431262 critical gzip bytes, unchanged; Account helper37299→37378 bytes, gzip12150→12185. Precache3142877/3145728 bytes (2851 headroom). No threshold is raised. ROOT must recompute budgets after loading work and final release/cache allocation.

Syntax and whitespace checks pass. Local evidence is under `/Users/jackhartican/Documents/AI/Codex/ios-sync-cricket-record-20261025/`, including baseline RED, repeat RED, field-removal control, final GREEN, command results and budget measurements.

## Integration and release handover

Base: `6aa5979ab440b38765fe1038ab3b1203e354fe40` (592), in the original isolated worktree on `codex/ios-sync-cricket-record-20261025`. Runtime scope is the one field validator plus its deterministically generated `assets/js/account-awareness-runtime.js`. Other changes are regression tests and prepended decision/source records. No loading or `index.html` change.

Shared dependencies: the deferred Account helper and decision docs may overlap other work. Rebuild the helper from integrated source; preserve historical decision tails. ROOT owns final review, normal source/browser/installed gates, final version/cache allocation and the existing loading/release acceptance blocker. Do not bypass those gates or use this worker's local tests as physical-iPhone proof. No further phone request is needed now.

Rollback is a code-only revert of this PR plus deterministic helper rebuild in ROOT's normal release path. It restores conservative rejection of these format records and can leave them visibly pending. No receipt/customer-state rewrite or database undo is needed.

After SYNC delivery, queue order remains the full All Sports task, then Public Feed. Deliver draft PR and handover; stop Ready. No main push, merge, deployment or independent production-data work is authorised here.
