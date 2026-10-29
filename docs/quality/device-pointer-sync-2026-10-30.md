# Device-pointer sync repair — 30 October 2026

## Problem and behavior

After a successful stale-device Unfollow save, applying the server response normalized graph and record pointers to the local profile while the accepted baseline correctly retained the raw server pointers. A later manual sync therefore sent a second pointer-only conditional PUT. The source control reproduces the exact three extra paths observed in hosted599: graph entityFollows, profileId and viewing.profileId. A timestamp-only remote change does not trigger this fault. The original hosted catch hides which post-Unfollow assertion failed first; no Follow loss or Feed-removal defect is established.

`SERVER_SYNC.settingsForServer` now merges settings and projects only known device `profileId` slots back to their exact accepted pointers. It requires the current slot to equal the actual local profile ID and a valid accepted string pointer. Record lists must have unique valid identities on both sides; entities reuse the existing canonical participant identity. Malformed, missing or colliding lists remain untouched. Aliases retain their current spelling, and new records retain their current pointer. Meaningful/unknown properties, OFF, empty lists and Unfollow survive. The allowlist is graph/viewing and uniquely matched entity/domain/competition record pointers. `learning.profileId` has no device-normalization producer and remains an ordinary incoming property, as do unrelated nested `profileId` fields. A direct regression retains the previously rewritten learning field as an outgoing patch. The existing profile-storage comparison exemption for `learning.profileId` remains unchanged; that exemption does not establish an outgoing normalization producer. This review finding establishes an unsupported rewrite, not private user-choice loss.

`currentServerStatePayload` activates this only when baseline account, SDK subject, current UI owner, session generation and the local profile captured at baseline acceptance match. `setServerStateBaseline` keeps the raw accepted state and timestamp and adds only the ephemeral local profile fence. There is no change to low-level patch collection, receipt/base/ACK comparison, authenticated transport, API, persistence schema or Feed admission.

## Validation

The regression is required by `scripts/validate-preference-bookkeeping.js`. The actual default writer queues its normal timer and Follow owner; the real Follow owner naturally cancels the redundant timer and saves through the real handler and normalizers with disposable auth/database I/O. Manual confirmation then performs no PUT attempt and retains the acknowledged timestamp. Before the fix this fails with two saves instead of one.

Controls cover same profile, timestamp-only remote advance, individual pointer families, persisted restart and in-flight newer receipt, disjoint real409/rebase and conflicting409/hold, missing/duplicate/malformed/canonical-alias identities, new records, genuine and unknown changes, and account/profile/session/subject/UI-owner/generation fences. Existing bookkeeping, cross-device, persistence, snapshot/recovery, cold loader, UI lifecycle and diagnostic checks remain required. UI/Feed effects are inert and manual invocation is a controller call; these are source controls, not native-click, hosted or physical-device proof.

Source and regenerated runtime remain subject to the unchanged startup budget and ROOT's complete CI/browser/hosted qualification. An extra build-cache check was stopped by the local source process guard at its child-Node launch; it was not passed or waived. ROOT must run its normal complete gate in the allocated environment.

## Release handover

Base is exact main `bac309ff79e39d154e0ffddc42377787da598ceb`. Shared dependencies: app shell source/runtime, current payload and accepted baseline, profile persistence and preference receipts, canonical participant identity, and existing required bookkeeping tests. No customer or production operations were performed. ROOT owns integration, version and asset bindings, full CI/browser qualification, a newly allocated protected hosted attempt and the eventual iPhone step. Version595 phone diagnosis and physical acceptance remain open.

Rollback is the inverse of this source commit, including its exact generated runtime and regression hook. No database or customer-state undo is needed. Keep the original zero-extra-PUT and ACK-timestamp assertions.

A separate inert operator-only patch adds allowlisted failure-site codes for the three post-Unfollow assertions, with no new request/evaluation/wait/note or assertion change. It is not an app or release change. Local admission checks show the existing published Canberra fixture22278881 (29 October) is still Follow-eligible and Unfollow-excluded across 30 October Sydney; this is not a hosted snapshot or source-freshness check. Do not alter the live clock or use an unchanged spent hosted attempt.
