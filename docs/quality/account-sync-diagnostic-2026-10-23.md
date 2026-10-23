# Account sync diagnostic — 23 October 2026

## Approved boundary

Prepare a separate diagnostic-only draft PR from accepted 587 (`df8390462dd45c36814bbb06b0fc59a15c8c5f2c`). DEPLOY remains the sole integrator and publisher. Stop Ready: no production deployment, main push, customer-state read/write, account restoration, new refresh owner, scheduler, migration or loading/calendar work.

The phone's generic failure message does not identify its cause. Local causal replay can produce it for read/transport/response/identity failures, write failures, exhausted conditional conflicts, the genuine changed-preference hold, missing confirmation and local application failure after a fulfilled save. This change gathers the next deliberate attempt's evidence; it does not certify the phone is repaired.

## Contract

- Retain one last attempt in memory in the existing deferred Account helper. The existing serial sync owner calls synchronous, defensive lifecycle hooks; there is no additional await, request, retry, polling, storage, endpoint or telemetry.
- Copy only after the user clicks **Copy sync diagnostic**. Output fixed format, safelisted stage/code/category, integer HTTP status, bounded elapsed time, public shell/worker versions and boolean/null pending-receipt, base-compatibility, response-owner and client-generation facts. Worker version is null until the existing update owner has measured it; do not probe independently.
- Never copy identifiers, email, handle, tokens, receipt IDs, preferences, wire payloads, raw error text/stack or unknown server codes. Unknown codes become `unclassified`. Private values used by the existing scope remain in its closure and are never serialized.
- Scope the record to the existing account/app scope and captured client generation. Reads and late callbacks discard invalid lifetimes; older attempt callbacks cannot overwrite a newer attempt. Account changes also trigger a discard check.
- Mark success only on the original completed path with no pending receipt. A fulfilled save response is a separate boolean, not success. A later ACK/local application failure retains its stage and reports completed=false. End timing on completion/failure. Clipboard completion messages remain fenced to the exact captured attempt/lifetime, including after an awaited clipboard result.
- Observe base compatibility from the existing verifier reaching save/ACK or throwing its fixed guard code; do not repeat preference comparisons. Sample receipt presence only at preparation and completion/failure (two additional local reads per settled attempt).
- Give the existing genuine changed-base Error the fixed code `preference_base_changed`; retain its condition, message, throw, CAS, receipt and generation decisions. Terminal session behavior is unchanged. Ordinary failure copy becomes “Sync could not be confirmed. Try Sync now.” It makes no claim that local application succeeded or another edit will resolve the failure.
- Keep the seven critical requests and unchanged 431441-byte critical gzip ceiling. Move the existing explanatory Account paragraph intact into its existing deferred helper; use a short truthful fallback until it loads. Regenerate the helper and advance its cache URL together. Leave shell587 to DEPLOY's allocation.

## Validation and release handover

`node scripts/validate-account-sync-diagnostic.js` executes the actual queue/reconcile and production deferred helper, comparing diagnostics active/inactive byte-for-byte saved state, baseline, pending receipt, call counts, original error and displayed state. Cases cover read503, timeout, invalid response, owner mismatch, save503/413, exhausted409, real preference hold, missing response state, ACK failure, post-save quota failure, refresh failure, unknown code, success and newer pending intent. Explicit-copy, secret sentinels, safelists, frozen elapsed time and stale-attempt fencing are also tested, plus two actual persisted profile/receipt byte-equivalence controls (successful ACK and failed save), six delayed clipboard/account-generation-session controls and bounded receipt sampling.

`ACCOUNT_RECOVERY_CASE=all node scripts/validate-account-sync-recovery-browser.js` retains the existing30 mounted Chromium/WebKit cases and adds one explicit-copy/error/sign-out case in each engine. It uses disposable loopback I/O only. The normal release workflow's original250 commands remain unchanged; The existing account-awareness command now also runs the new diagnostic regression; DEPLOY must allocate the final version, then qualify exact combined bytes and installed upgrade.

Shared files: index sync hooks/Account copy, existing deferred Account source/runtime/builder and the matching service-worker helper cache URL. The separately owned loading/snapshot/calendar experiment must be integrated by DEPLOY, with the same budget rechecked after combination. No loading/calendar logic is changed here.

Worker evidence and two-axis review are retained with the release handover. Hosted runtime, repeated account reads, cross-device Follow removal/Feed exclusion and physical iPhone Home Screen acceptance remain DEPLOY-owned and open. A diagnostic copied from the failing phone is required before attributing its cause.

## Integration follow-up: preserve the native sign-in form

DEPLOY's first shell588 matrix exposed an obsolete diagnostic assertion (`587` hardcoded) and recurring initial-sign-in timeouts before any user-state read/write. The harness now binds its expected diagnostic version to the exact served source (including an explicitly selected historical Git source), rather than to a worker's version allocation.

A bounded delayed-helper probe in each engine reproduced a separate, real UI defect: fill both required fields on form1, then finish the existing deferred Account helper request. Its mount called the full Account renderer, creating empty form2. A native click triggered `invalid` for email/password and no native submit. This explains the observed setup failure; it does not establish the authenticated iPhone sync failure's cause.

The approved repair changes only the existing helper's mount refresh. If the native sign-in form already exists, update Account help/status copy in place and retain its actual form/input nodes, listeners and focus. Do not copy credentials, submit automatically, store a draft or alter requests/session/sync decisions. Other Account states retain the existing full render. Matching helper loader/worker cache URLs advance together to5714; DEPLOY owns the shell version.

The permanent `helper-mount` case holds the actual helper response until after input, asserts original node identity, focus and native validity, clicks the real button, and requires one submit and one password-sign-in request. Both engines join the existing matrix; all original32 cases remain, for34 total. Sanitized setup traces contain form instance numbers, boolean presence/validity and event/state labels only. Wait durations and application acceptance assertions are unchanged.

Original failing traces, including a first fixed probe's failed test counter, are retained. That first fixed probe already retained the form and submitted; its attempted wrapper counter was ineffective because the real SDK object is frozen. The corrected regression observes native submit and the existing routed auth request directly, without SDK mutation.

DEPLOY must qualify the combined588/5714 runtime, complete34-case matrix, both installed upgrades and all250 release commands. The original phone diagnostic and physical two-device/Feed gates remain open. This addition repairs a proven helper-arrival UI race while preserving the diagnostic's original privacy and sync boundaries.
