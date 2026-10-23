# Installed-app account and Follow sync recovery

Approved scope: repair the iOS Home Screen account/sync contradiction and failed manual retry; recover valid saved sessions automatically on open/resume; preserve explicit Follow choices across devices. User requires an isolated draft PR, priority after DEPLOY's current task, standard handover and a stop at Ready. DEPLOY confirmed the preceding release is complete and this task is first in Queue #28.

Base: `8d5b279928299b3c3d2b589dec208d5f48861831` (accepted release 585 / PR30). Preserve its durable preference receipts, owner/generation fences, conditional writes and account bootstrap baseline protections.

## Reproduced defects and changes

The new loopback browser regression drives the mounted application and existing auth transport with disposable responses. All outbound origins other than the controlled loopback servers are blocked.

- **Hidden failures:** a manual user-state request returning 503 sets the application to `error`, but Account renders only its timestamp (`Last synced…`, or `Not synced yet` when absent). Account now shows its existing progress/error message before the timestamp.
- **Disabled retry:** a newer durable receipt created while a save response is in flight survives the acknowledgement correctly, but the completed request leaves the state at `syncing`, disabling Sync now. It now shows the pending-choice message with an available retry. Receipt acknowledgement and merge semantics are unchanged.
- **Foreground recovery:** after optional sign-in activity settles, returning with an expired access token redraws the header but makes no refresh request. Existing deferred account UI now calls the existing serialised sync path on pageshow, visibility return and online. It coalesces the same account lifetime's events and allows at most one automatic attempt per 15-second burst; it does no polling and skips hidden/offline/busy states. Offline clears the burst throttle. A stored session without a hydrated user retries through the existing bootstrap rather than asking for another password.
- Account's identity prefix uses the same model as the header: an expired/unverified identity says `Saved account:` rather than asserting it is signed in. The helper has a new numeric asset cache key shared with the required worker cache.

These counterexamples establish defects in the released code, not the exact cause of the customer's phone incident. No device session, customer account state or production data was inspected.

## Reproduction and validation

Set `PLAYWRIGHT_MODULE` to an installed Playwright module when it is not available through ordinary Node resolution. Chromium uses the installed Chrome channel by default.

```sh
ACCOUNT_RECOVERY_CASE=all node scripts/validate-account-sync-recovery-browser.js
```

This runs eleven scenarios in both Chromium and WebKit: hidden manual failure/retry, newer receipt after response, expired-token resume, failed cold restore with Retry account, offline/hidden/event-burst recovery, revoked session, transient refresh failure, two-context Follow/unfollow/reload, cross-origin local/session isolation, an actual 15-second transport timeout, and a manual retry queued behind a held automatic recovery request. All 22 pass locally. The three defect cases fail when served directly from the pinned published base, without changing tracked files:

```sh
ACCOUNT_RECOVERY_BASELINE=8d5b279928299b3c3d2b589dec208d5f48861831 ACCOUNT_RECOVERY_CASE=pending-receipt node scripts/validate-account-sync-recovery-browser.js
```

Use `retry-error` or `resume` for the other baseline counterexamples.

The Follow case uses retained fixture `football-australian-championship-2026-22278878`, Canberra Croatia v Sutherland Sharks, dated 24 October. It verifies a saved explicit Canberra follow admits that fixture through the server Feed pipeline, then an explicit unfollow excludes it and reaches the second context on later resume/reload. Sydney United's retained home fixture is a different event/date. This is neither a fresh official schedule check nor proof of the customer's Feed admission.

Existing cross-device (24 orchestration, eight accepted-bootstrap and 75 account-isolation cases plus durable-receipt checks), 124 account-awareness checks, authenticated Feed startup, Follow policy/parity, backend efficiency, startup/download budget and build-cache checks pass. Existing mounted Account regression passes at 390px (18 layouts, 41 behaviours, no uncaught errors). The Follow interaction performance check passes. Existing Account layout checks also pass across 320/390/768/1280px in both engines; full 390px behaviour checks pass in both engines. Critical assets total **430,783 gzip bytes**, seven requests, below the unchanged **431,441-byte** ceiling.

Local logs and browser/upgrade results are retained in `/Users/jackhartican/Documents/AI/Codex/ios-account-sync-20261023`. Chromium and WebKit installed/offline upgrade rehearsals from accepted shell 584 to this candidate pass, including the exact cached account helper. These retain shell 585 in the worker candidate; DEPLOY must repeat 585-to-final-version checks after allocating the release version. Independent source review is clear on Standards; Spec requested the additional timeout/overlap regressions, whose final review is recorded in the PR handover. Do not infer physical iOS acceptance from a desktop engine.

## DEPLOY handover and acceptance

- **State:** worker stops at Ready after the pinned implementation passes relevant tests/reviews; draft status remains. DEPLOY selects and integrates it. No production candidate is started by this worker.
- **Shared dependencies:** Account UI, auth lifetime, deferred helper/worker cache and app shell overlap the inactive/unapplied onboarding candidate; do not import its old hooks. PR29 is documentation-only. No overlapping DEPLOY auth edit was allocated. Recheck combined payload after integration.
- **Database/config/shared services:** no migration, schema/API wire change, provider configuration, production query/write, canonical/source refresh, customer preference import or automation restart. Recovery reuses existing authenticated reads and conditional writes only when the user operates the released app.
- **Versioning:** worker leaves shell/app version 585 unchanged. DEPLOY assigns the release version and reruns installed 585-to-final-version upgrade/cache checks against the combined revision. Local previous-release-to-candidate rehearsals are supporting evidence, not that final release proof.
- **Required hosted/phone acceptance:** on the existing primary-domain Home Screen installation, confirm exact deployed shell/helper bytes; open and resume; confirm header/Account identity and error agreement; recover a still-valid refreshable session; verify a deliberate Follow addition/removal survives reload and is read by a second device. Compare the old/new URL's actual account ownership, pending receipts and explicit Follow state before attributing the missing Canberra fixture to auth.
- **Origin/history boundary:** old-origin local-only choices cannot be read by the new origin. No automatic merge/union, guessed restoration, reinstall, forced sign-out or storage clearing is part of this repair. Any historical reconciliation or separate coverage defect needs its own evidence and DEPLOY allocation. Record a confirmed independent coverage repair under the existing local request-register rules, without reranking.
- **Risks:** foreground sync can reveal an existing preference-base conflict; preserve it rather than overwriting. Slow/failed optional helper loading retains the neutral core account fallback. The recovery burst throttle deliberately avoids repeated reads, so an immediate repeated foreground event can wait until a later event or deliberate retry.
- **Rollback:** revert this PR's source, generated deferred helper and matching cache-key changes together through DEPLOY's normal release process. There is no database rollback. Retain PR30 and local preference receipts. No release safeguard is waived.
