# Shared fixture API initialization — 4 October 2026

## Outcome and scope

The shared fixture handler now checks method, refresh authentication/maintenance and public fixture/athlete inputs before constructing the published sporting catalogue. Its first valid public reader builds the existing catalogue once; later readers reuse it. The protected refresh owner no longer depends on that public presentation catalogue. This is a scoped backend repair, with production proof pending below.

The actual `/api/feed` route reproduced the problem in isolated cold processes: an unauthorised refresh returned the correct 401 but first read/imported 17 sporting datasets. An invalid athlete returned 400 only after those same loads and two existing read-only database RPCs. The request paths, diagnostics, authentication and cache policy remain; an invalid athlete now returns 400 even if supplied with a current fixture revision, rather than bypassing validation with 304.

## Evidence and root cause

The deterministic red command was `node scripts/validate-live-fixture-initialization-boundary.js --case refresh-no-token`: 401, 17 data reads/imports, then an assertion failure. The malformed-athlete command separately failed with two read-only RPCs before rejection. Saved failures remain under the `live-fixture` prefix in the existing delivery folder. The new regression exercises the actual parent API and its default shared handler in a fresh process, with synthetic read-only services; it does not call production or providers.

Ranked hypotheses were eager factory construction, sporting imports at module initialization, and validation after snapshot reads. Moving only the public library/viewing construction behind input admission eliminates all 17 dataset loads. Moving athlete validation ahead of snapshot reads eliminates the two RPCs. No other module, hash, source adapter or data model needs changing. Failed catalogue construction returns the existing bounded 503 and is not cached; the next valid request can retry construction. A protected refresh still succeeds in the controlled test when the public catalogue deliberately cannot construct.

Three samples per scenario, before/after against `96207ec4357a9e5f58a6126373d1dfc22b213797`, preserve the 13 ordinary rejection statuses and exact JSON diagnostics. These are local synthetic cold-process observations, not cloud p95 or user/account latency.

| Local cold scenario | Before | After | Material interpretation |
|---|---|---|---|
| Missing refresh token | 17 sporting reads/imports; median 253.1 ms and 373,080 µs CPU; RSS 249.0 MB | Zero sporting reads/imports; 14.9 ms and 15,442 µs CPU; RSS 58.9 MB | Avoid building the catalogue merely to reject a request |
| Malformed athlete identity | 17 sporting reads/imports and two read-only RPCs; median 329.9 ms and 459,867 µs CPU; RSS 278.6 MB | Zero sporting reads/imports/RPCs; 16.0 ms and 15,942 µs CPU; RSS 59.0 MB | Reject malformed profile lookups before database and presentation work |

RSS is whole-process resident memory, not allocation attributable solely to this module. Traffic, cloud CPU, quota, cash savings, abuse and effects on valid-user latency have not been measured. Do not extrapolate these local numbers into an infrastructure saving.

## Verification and release boundaries

Thirteen fresh-process direct/rewritten route rejections cover method, missing/wrong token, undersized configured secret, maintenance, fixture syntax/60-ID bound and athlete syntax/200-character bound. They retain statuses, diagnostics, applicable cache/Allow headers and secret redaction with zero sporting reads/imports or service requests. They run through the existing `validate-live-fixture-api.js` production gate, adding no gate owner or parallel workflow.

Actual-handler continuity tests retain published fallback, last-good data, zero scores, source observations, genuine-verification ETags, 304 semantics, retired AI history exclusion and scoped fixture isolation. Additional cases exercise one successful lazy construction, warm reuse, invalid-identity/current-revision rejection, refresh/catalogue independence and retry after failed construction. A separate fixed-clock comparison loads the full real published catalogue: ordinary and selected fixtures, source-backed athlete history, enabled Fantasy evaluation, conditional 304 and unavailable-snapshot fallback remain byte-identical to baseline, including headers and validators. Six before/after comparisons pass; synthetic snapshots are not source evidence.

Affected local checks: live fixture API/boundary, live fixture orchestration, backend efficiency, existing Feed authentication/cache, shared live-coverage publication and match observations. Normal cloud gates, credentialed read-only production publication input and immutable delivery proof remain required. The browser shell, profiles, data, source adapters, projections, SQL and existing scheduled owners are untouched; verify their package bytes rather than perform another unchanged PWA epoch/rehearsal. Existing physical-device and prior waiting-worker limits remain unresolved.

## Recommended course

| Recommendation | Business value and evidence | Effort and dependencies | Cash and owner impact | Acceptance and act/defer decision |
|---|---|---|---|---|
| Ship the narrow admission/initialization repair | Stop demonstrated rejection work and remove a public-catalogue dependency from refresh | Focused half-day estimate including verification; current handler and existing release owner | A$0 new purchases; no new service, scheduler, retry, source request or owner routine | All rejection and valid-response checks plus normal release/production proof; act now |
| Keep caller-level regressions in the current API gate | Prevent recurrence of hidden eager initialization and late validation | Existing isolated-process test seam; under one second locally for the 13 child cases | No owner decisions or new tracking tool | Actual parent route and default handler, exact diagnostics/data-read counts, warm/failure continuity; act with the repair |
| Defer the speculative profile-history trim | The athlete-history file is only about 6 KB, not a large download | No demonstrated valid-user delay or high-volume cost | Save investigation/release work | Measure real profile latency before any new change; defer now |
| Continue Football acceptance and measured package review | Useful repeat visits and trustworthy viewing remain the programme's purpose | Existing six-gate competition contract and dependency/use evidence; 159.36 MB package size is not startup transfer | Existing free tiers; no additional owner checklist | Rights/playback, live-status semantics, real cohort/device/recovery and most-sports certification remain open |

The existing 60-ID/read-deadline/cache and source-cadence budgets stay authoritative. Server-only secret boundaries are consistent with [current official Supabase API-key guidance](https://supabase.com/docs/guides/getting-started/api-keys), reviewed 4 October. No Supabase credential, permission, RPC, database schema, retention or account-state path changes.

The full original CTO architecture/business programme remains open: 0/16 families and 0/3 Football pilots certified, target at least 13/16 families. No subscription, purchases, sporting-source refresh, customer erasure, reminder replay, outreach or independent recovery claim. Passwords/iCloud work stays parked under the instruction to carry on if it fails.
