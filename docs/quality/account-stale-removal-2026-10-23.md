# Follow removal after another device signs in

Base: accepted/main `65af3bdc84ba9f4fda79bc12ce6d5dc8233aeb6a`, shell 586. This is the bounded follow-up to PR31's still-open hosted acceptance, returned to the original account worker by DEPLOY. Work remains isolated; DEPLOY alone owns integration, publication, hosted allocation and production acceptance. No loading/provider work belongs to this repair.

## Causal local reproduction

The earlier browser roundtrip pre-reconciled A before its unfollow and mocked writes with direct patch application. It did not certify the hosted sequence of A following/reloading, B independently signing in, then A removing the Follow from its existing baseline.

The expanded regression runs the actual `api/user-state.js` handler, including its preference/event normalization, original conditional comparison, empty-CAS-response 409 and response shape. Only authentication and database I/O are replaced with disposable in-memory adapters. The mounted client uses its existing auth transport and receipt writer. External browser origins are blocked; no credentials, provider configuration or service calls are used.

On served release 586, B's sign-in changes local graph profile pointers and prompt/session counters without changing the account's Follow choices. A's deliberate unfollow then remains in a pending receipt: the full-object preference-base comparison considers these bookkeeping differences a conflict. A real-handler timestamp-only revision succeeds, while a genuine changed preference correctly holds. The independent pure receipt regression also fails on the original metadata comparison. These establish a local application defect, not attribution of the earlier uninstrumented hosted timeout.

## Minimal repair and invariants

Preference-base and intent-acknowledgement comparisons now omit only:

- `preferenceGraph.profileId` and `updatedAt`; `profileId` on its domain, competition and entity records and viewing/learning records.
- `followFirst.refinement` open count, last-open identifier, first-swipe timestamp and prompted timestamp.
- `ratingPromptState` session count and session identifier.

Every unknown field remains in the comparison. Follow levels, formats, explicit OFF, empty selections, all genuine preferences, refinement completion/defer choices and rating dismissals remain protected. Account identity is still enforced by the existing authenticated user, generation and request scope; local graph pointers never replace it.

Compatibility does not rewrite an in-flight receipt's base. `advancePreferenceIntentBase` keeps its original exact comparison. An owned acknowledgement may advance a newer receipt using the existing R1/R2 path; it cannot clear the newer edit or advance a different generation. There is no broad automatic merge policy or schema change.

To retain the unchanged download ceiling, Account's existing status/date formatting moves into the existing deferred account module. The core keeps its error message or neutral Account & sync fallback before that helper is available. Normal ready/error/progress copy is unchanged. The helper and required worker cache share the new numeric cache key `5712`; no synchronous request is added. Worker shell/app version stays 586 for DEPLOY's allocation.

## Qualification

Use pinned Node 24.21 for build/budget qualification. Set `PLAYWRIGHT_MODULE` to the installed module when necessary.

```sh
node scripts/validate-preference-bookkeeping.js
ACCOUNT_RECOVERY_CASE=all node scripts/validate-account-sync-recovery-browser.js
```

The full matrix contains the original 22 browser cases plus eight real-handler cases: direct stale-baseline removal, timestamp-only revision, an injected real conditional 409/retry, and a genuine changed-preference safe hold in Chromium and WebKit. The first three verify the second context receives the removal. The actual handler tests seed consent with the current OFF writer, retain OFF, and log only context/phase, changed paths, timestamps, scoped state and receipt presence. No customer state is captured.

The pure receipt check verifies metadata compatibility, refusal to acknowledge an unapplied unfollow, eight genuine/unknown-choice conflicts, immutable in-flight bases, newer-receipt retention and generation fencing. Existing cross-device tests remain required. Navigation waits for the first Follow's fixture reads before reloading, preventing test-induced cancellation of a WebKit worker fetch; it does not reconcile A before the removal.

Final engine results, original failed evidence, pinned budget and review receipts live in `/Users/jackhartican/Documents/AI/Codex/ios-account-sync-20261023/stale-removal`; report exact outcomes in the draft PR handover. No failed run is treated as passing. Normal local regression, build-cache, Follow/backend/startup checks and installed/offline upgrade rehearsals remain required; no threshold or assertion is weakened.

## DEPLOY handover

- Shared dependencies: profile receipt comparisons, generated critical runtime, Account formatter/helper and required worker cache. Preserve PR30 and PR31. Do not import inactive onboarding hooks or touch the separate loading-owner investigation.
- Database, schema/API wire, provider configuration and shared-service changes: none. There are no production reads/writes, source refreshes or automation restarts by this worker.
- Risks: the bookkeeping allowlist must stay narrow; unknown and deliberate fields continue to hold. Budget headroom is small and must be remeasured after DEPLOY assigns the final version and combines source.
- Acceptance: rerun the direct stale-baseline hosted scenario without a pre-unfollow sync, with per-context request and scoped receipt/path diagnostics. A 409/200 status pair alone does not establish success. Verify removal persistence and Feed exclusion on the second context, then the existing physical iPhone/Home Screen path. Those gates remain with DEPLOY.
- Rollback: revert the receipt comparison, generated runtime and Account formatter/cache-key changes together through the normal release lane. No database rollback. Retain pending receipts; no forced sign-out, storage clearing, historical union or guessed restoration.

Deliver a tested draft PR and frozen head, then stop at Ready. No direct main push, deployment or independent shared-data action is authorised.
