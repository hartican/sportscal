# Exact sync refusal diagnostic — 24 October 2026

Actual iPhone acceptance failed on591. This change identifies the existing refusing branch; it does not change sync policy, resolve the private phone cause, choose a winning preference or qualify phone acceptance.

## Evidence and scope

Published source baseline is91862967ccd85f2785b7b0c164d3101f379dc1dc. The phone copy reports verify/preference_base_changed/guarded_hold, pending receipt, no completed acknowledgement, no fulfilled save response, and localView/entities/domains in all three family lists. The original family output does not inspect the captured current preferences. It cannot distinguish real field conflict, unsupported/malformed record/view shape, missing baseline clock or current-not-in-receipt. Source-only disposable reproduction proves five such actual branches produce identical591 records. Duplicate remote entity identity is a distinct uncoded comparison exception, correctly unclassified.

A verify-stage failure can occur after a rejected conditional PUT and re-read. No fulfilled save response does not prove zero upload attempts or no server commit. No approved supplied evidence contains the phone's owned original receipt and captured current preference snapshots; server-only history cannot establish the intended winner. No customer read, reset, restoration, sign-out, storage clear, inferred union, source job, production mutation or new phone request occurs here.

## Additive copied contract

Keep existing sync-diagnostic.v1 fields. New bounded fields count execution reaching the existing SDK call sites, not HTTP sends or commits: stateLoadCallsStarted0..3 and stateSaveCallsStarted0..3. Counters increment at the existing read/save step, without new requests.

Optional preferenceGuard contains format=preference-guard.v1; fixed site, decision and reason; side=base/intent/remote/current/null; family=localView/entities/domains/other/null; verifyPass=initial/after_conflict; nullable receiptOwnerMatches and receiptGenerationMatches; currentToReceipt=null or a fixed-family array. Only the first actual blocking/refused/exception branch survives within a verification pass. A409 re-read starts a fresh pass. Compatible/planned facts may be replaced by a later actual ACK refusal. Scope-unavailable facts survive a generic fallback. No raw field, identity, choice, timestamp, receipt ID, stable hash, record count, exception name/message/stack or arbitrary enum appears.

currentToReceipt is derived only after the actual existing current-versus-recorded-intent comparison fails. It uses that predicate's already-created withoutViews operands and the existing preference-family vocabulary/projected comparator. Thus typed device-local views are excluded exactly as in the predicate. It is a diagnostic family summary, not a second policy decision; unavailable observation gives null and preserves the original hold. No planner rerun or additional retained preference snapshot.

The fixed private ordinal codebook in account-sync-diagnostic.js avoids repeating long labels in critical/deferred downloads. Inline source comments decode producer operands. guardFact safelists/decodes producer events; the recorder independently safelists again and copies only fixed text. Ordinals never enter persisted receipts, API payloads or copied labels. Out-of-range indices, unknown strings, malformed values/prototypes and nonboolean scope values are rejected or fixed null/unknown. The small exported verify facade in the existing deferred owner executes the same original guard/throw; HTML retains the original strict helper-unavailable fallback. No new script request or dependency.

## Covered actual seams

- Helper availability and existing owner/account/generation rejection; current container/view validity and exact projected current/receipt mismatch. Receipt-generation diagnostic fact is observational; it adds no policy validation.
- Existing compatibility comparisons and uncoded exceptions; original envelope/ID/owner/generation/base/remote clock predicates; base/intent/remote graph and known typed-view validation; outside-supported-scope refusal.
- Each actual record list/shape/identity/unknown-field/value/Follow-level/domain-alias/canonical-collision check. Concurrent empty reset, add/add, delete/edit, edit/delete and same-field conflict. Exception paths preserve the original caught-null/rethrow behavior.
- Existing strict fallback, semantic ACK boundary, ACK scope/witness/current receipt/original receipt, newer-generation/clock/base/patch availability and refused continuation. R2's same conservative planner and in-flight preserve failure keep their actual prior returns. Diagnostic callbacks are optional/nonthrowing; persisted receipt shape and owned ACK/CAS/apply semantics stay exact.

The actual first branch is reported; no additional policy validation is introduced solely to label a field. The producer can distinguish missing patch helper separately from newer-generation rejection without altering their original short-circuit outcome. Exceptions without a more precise observed seam use a fixed unexpected reason, never an inferred cause.

## Deterministic proof

The new account-sync-guard-tests module joins the existing account diagnostic validator, leaving normal workflow commands and all nineteen mounted recovery cases per engine unchanged. It exercises95 source/generated and actual branch controls: envelope/view/record/identity/conflict predicates, current and compatibility exceptions, five original collisions, actual atomic profile ACK return/error/durable-byte equivalence, actual serialized owner with post409 re-read, semantic ACK refusal, duplicate comparison exception, successful receipt completion, actual R2 continuation/preserve, privacy/codebook/current-family sanitization, first-refusal precedence, scope invalidation, honest bounded counters and nonthrowing observer failure. Existing15 queue equivalence,2 persisted-byte,6 clipboard/lifetime, family privacy and all55 receipt/queue/API/ACK/CAS/R2/ordinary-writer cases remain in their existing commands.

Baseline RED command: GUARD_DIAGNOSTIC_BASELINE=91862967 node scripts/lib/account-sync-guard-tests.js. It fails because published591 has no specific refusal observation. The original five-collision RED/log is retained under the approved output folder. New source and generated tests compare against actual published591 return values, error message/code/type, current/baseline/device data, durable profile/receipt bytes and SDK operation counts. Synthetic data is labelled; this is not private phone proof or hosted/native acceptance.

## Download and formatting budget

No redundant HTML comments remained. To preserve both unchanged byte ceilings, leading JavaScript indentation only was removed inside the existing contiguous Account section. Acorn token boundaries preserve multiline strings/templates; before/after Terser canonical output with compress:false/mangle:false is identical. The earlier reconcile-only indentation step is likewise canonical-equivalent. This explains the large whitespace-only diff; git diff -w isolates executable changes. No UI, accessibility, attribution or executable token is removed by formatting.

Current prepared source is seven critical requests/431260 gzip bytes against the unchanged431441 ceiling (181 bytes headroom), and3142798 precache bytes against3145728 (2930 bytes headroom). Current prepared source retains591/5716; ROOT allocates coherent version/cache references before publication. Seven critical requests remain. Worker records exact critical gzip and precache/headroom with final source hashes; neither threshold is raised. Canonical formatter proof is retained outside the repository. Source/module build checks remain mandatory.

## Handover and rollback

Shared seams: existing diagnostic/Account helper and build inputs, HTML verify/ACK observer hooks, profile ACK, generated app shell and Account runtime, both decision records. Flag these to AS/PF and other shared owners; ROOT remains sole integrator/publisher. No new migration, store, wire shape, request, timer, retry, scheduler or dependency. No native/browser/heavy test is launched without ROOT allocation. Final source reviews, exact full38/installed CI, served bytes/security/hosted proof and actual iPhone acceptance remain separate gates.

Rollback reverts diagnostic producers/recorder, observer hooks and generated runtime together with ROOT's coherent version/cache allocation. Keep every persisted receipt and customer choice; there is no data rollback/reset. Do not request another phone copy until ROOT verifies the useful diagnostic live. Stop implementation at Ready with a tested draft PR and standard DEPLOY handover.
