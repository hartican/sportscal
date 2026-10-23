# Pending sync and the automatic seed marker — 24 October 2026

## Evidence and scope

The physical Home Screen diagnostic on shell588/worker588 reports `stage:verify`, `code:preference_base_changed`, `category:guarded_hold`, `pendingReceipt:true`, `baseCompatible:false`, matching owner/generation, completed=false and no save response. This proves the existing preference guard stopped the attempt before upload. It does not identify the differing preference field. No fixture-timeout, session, quota or historical account-recovery cause is inferred.

A disposable actual-code reproduction proves one false-hold mechanism. B's ordinary `FOLLOW_FIRST.applyMetaSeed` against already identical metadata changes only `followFirst.appliedSeedHash`. A's earlier owned pending unfollow then throws that exact guard error before any write. The marker records automatic hydration, while actual sports, events, location, consent, notification and Follow decisions are unchanged. The original named bookkeeping projection did not exclude it.

This is a bounded candidate repair for a proven mechanism, not a claim that this was the phone's exact differing field. The required physical acceptance is one retry on the qualified deployed candidate, then its existing safe diagnostic and cross-device/removal/OFF/empty/Feed checks. If the phone still holds, identify the remaining mismatch rather than enlarging the exclusion list speculatively. No customer saved-state read, import or restoration is included.

## Change

Exclude only the nested automatic `followFirst.appliedSeedHash` from existing preference-decision compatibility/ACK comparisons. Keep all other existing exclusions, unknown fields and genuine choices compared. Exact in-flight receipt baseline advancement remains full comparison; original receipt identity, owner/generation and conditional-save handling remain.

A second actual-API restart control proves exclusion alone is insufficient: after the accepted app baseline has the newer server marker, the older receipt can attempt to write its old null marker back. In the existing conditional PUT, preserve the prior marker only when the metadata's seedHash is unchanged and the incoming marker does not match that hash. An actual hydration's valid marker and genuine changed metadata remain allowed. This touches only the automatic marker; it adds no preference merge/union, starter follows, wire field, endpoint, request, retry, storage key, schema or database operation. The existing owner/CAS and no-op/normalization path remain in charge.

## Deterministic tests

`scripts/lib/user-state-seed-marker-tests.js` executes actual queue/reconcile, actual owned receipt persistence, actual metadata hydration, real API handler/normalizers and conditional-save behavior. Only auth/database I/O is replaced by disposable local storage. Its initial owned-unfollow test is RED on live588 code. An intermediate restart test is RED on projection-only code because the server marker becomes null; both failed logs remain.

Twelve final cases cover unfollow, restart with null and older non-null markers, explicit empty and OFF; genuine theme/notification/metadata choices; unknown root and nested followFirst fields; real conditional409 followed by a newly changed-choice hold; changed owner and app generation. Positive cases use one read/one save with the latest marker retained and the original receipt acknowledged. Holds preserve exact stored receipt bytes and newer remote state; stale scopes perform no save/ACK/apply. Existing R1/R2, exact in-flight base and bookkeeping tests remain. The normal `validate-preference-bookkeeping.js` command includes the new suite without removing any release command.

An initial test fixture omitted notification `userChoice:false`, so the established notification migration restored its default. That failure is retained; the final synthetic fixture explicitly represents the existing OFF contract rather than changing runtime notification behavior.

## Release boundaries

Base live588/main `9df58ea0faf9c1497abc9de09a44b31516b0536d`. Existing original worktree is reused on isolated branch `codex/ios-sync-guard-20261024`; DEPLOY owns the merged PR33 branch and remains sole integrator/publisher. Worker leaves shell588 for DEPLOY's version allocation. The critical runtime is regenerated from its source; no deadline, request count or byte ceiling changes. Source overlap: profile storage projection/core runtime and the existing user-state conditional PUT. Other owners' Feed/All Sports/loading work is excluded.

Targeted tests and pinned Node24.21 budget/build/startup evidence accompany the draft PR. DEPLOY runs the one final pair of Spec/Standards reviews and required combined/version/installed/normal/live qualification, reusing unchanged evidence appropriately. No independent main push, deployment, customer write, broad saved-state read, production data correction, sign-out, reinstall, storage clearing, guessed follows, automation or restart.
