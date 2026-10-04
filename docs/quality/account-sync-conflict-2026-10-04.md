# Account-sync conflict integrity — 4 October 2026

Status: implemented locally; publication and production acceptance pending. Base `14b5606b57b482121defd1783d8ab6a09bf65c5c`, deployed baseline `99504438`, shell 421. This is the next bounded account-lifecycle outcome in the CTO queue; it does not certify Football, a whole sport or physical cross-device use.

## Verified defects and repair

The actual `reconcileCurrentServerState` retry recomputed changes by comparing the newest server state with the entire older local snapshot. A controlled save conflict changed an untouched viewing provider from the latest Stan choice back to Kayo. The existing pure patch tests passed because they did not exercise this orchestration. Retry now keeps the original local edit baseline and the latest server comparison timestamp. Only deliberate local changes receive the existing last-writer treatment; untouched and unknown remote fields survive. Temporary remote agreement does not erase the original local intent before a later conflict.

A second actual orchestration test found that pin normalization changed the snapshot used to identify edits made while saving. An unchanged old local fixture choice could then masquerade as new input and overwrite the returned choice locally. Preserve the actual local start snapshot before normalization; compare late edits against that snapshot. Server fixture authority, explicit consent/exclusions/OFF, the typed conflict requirement and the three-write cap remain.

The existing production workflow adds this meaningful regression to its required contracts (138 commands, previously 137). No new sync owner, request cadence, retry allowance, API, schema, Auth/RLS rule, provider, source refresh or service is added. Shell 422 and exact runtime cache URLs deliver the changed inline page; generated runtime and deferred Follow module bytes remain unchanged.

## Acceptance and limits

Twelve synthetic scenarios execute the actual orchestration and late-edit/pin helpers: zero/one/two conflicts, temporary convergence, explicit empty/false/unfollow and Remind OFF, removed fields, late local edits, remote fixture authority, the three-conflict stop, unrelated 409, ended session and an unchanged device. Original pure patch/prototype safety cases remain. Failure leaves the local copy intact. These tests make no database connection or production account operation.

Additional browser acceptance uses the actual frozen server client and request/response parsing through intercepted synthetic API responses, actual profile normalization and native saved storage. Both browser engines must preserve the new remote viewing choice, explicit empty follow/provider choices and a late local theme edit. All API requests are intercepted; no real backend request is allowed. This proves integration through this browser path, not a real customer account, two physical devices, JWT/issuer/RLS acceptance or recovery of already lost choices.

Required release proof: stable candidate checks, both genuine-worker 421→422 upgrade/offline/resume rehearsals, exact published Git SHA, normal production gates and protected inputs, READY/project/aliases/release metadata/served hashes, and hosted intercepted-browser acceptance. Retain failed test-fixture observations separately; none is a release waiver.

Business value: reduce unexpected loss of saved club/viewing choices during concurrent use without another owner decision or maintenance routine. Estimated engineering effort: approximately half a day including verification; estimate, not attributable billed time. A$0 added subscription/service spend; existing CI/model cash and token savings remain unmeasured. The wider account lifecycle, source permission, playback, physical device, independent recovery and actual cohort gates stay open. Passwords/iCloud retries stay parked. Certification remains 0/16 families and 0/3 Football pilots, target ≥13/16.

Evidence: `/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/account-sync-conflict-20261004`.
