# Old match-data copies: safe cleanup repair — 12 October 2026

**Status: published and applied to the live database; ordinary cleanup verified. Match Centre reliability remains open.** The latest card app remains live at `fbd5d32f` / shell 516. This repair affects storage upkeep, with no new subscription or owner routine.

Old match copies were cleared only when a source changed. Normal successful checks will now clear expired copies even when results stay the same. Current results, original fact dates, saved activity and the latest useful copies remain protected. Cleanup happens gradually through the existing update process.

## Scope and acceptance

The actual existing publisher keeps its signature, service-only access, empty search path, source-row lock, lease/input checks and live/quiet timing. Both successful branches share one cutoff and retain the source's current revision plus the highest stored revision. Each accepted check removes only older-than-seven-day non-keepers: oldest first, at most 64 copies and 4 MiB of stored payload. A first copy exceeding that cap is retained for separate assessment. Failed/rejected publications never prune. No immediately executed deletion, provider call, refresh, scheduler, retry, browser change or customer-data operation accompanies the migration.

The CLI-created migration `20261012113815_expire_unchanged_fixture_history.sql` refuses a publisher other than the reviewed baseline digest `4e6cd3c84f8a2211d04e1f271540451f`. The short migration transaction has a two-second lock timeout and eight-second statement timeout. Normal publication keeps its existing eight-second request budget and 45-second owner budget. A missing acknowledgement is not proof of rollback; inspect definition and migration history before any retry.

## Meaningful checks

The project regression loads actual existing schema and baseline migrations, then applies the real guarded migration in memory. Twenty cases cover unchanged and changed persistence including zero scores, both keepers, original facts/dates, leases, invalid input, empty primary responses, missing history, age boundary, other sources/activity, reruns, quiet timing, both work limits, actual service execution, denied anonymous/authenticated execution, source failure and restoring the reviewed old function. Reapplying after a changed definition is refused and rolled back. The old publisher fails the same unchanged-history regression. The first integration run exposed a synthetic fixture shaped as an array where the real table requires an object; the test input was corrected, without weakening the actual constraint.

The same check runs in full and ordinary quick canonical routes and the normal production workflow. The existing compact-score database suite also loads the migration to verify its real delegated write/read path. No package or runtime was installed. Earlier temporary PostgreSQL 17.6 rollback mechanics passed 15 bounded cases; the local actual-migration engine is PGlite 0.5.8 / PostgreSQL 18.3. These are separate evidence layers, not a claim of production load or full recovery.

## Current read-only evidence

At 11:18 UTC the deployed baseline still matched, anonymous/authenticated execution was denied and service-role execution allowed. All three source tables had forced row-level security; snapshot history had the existing source/revision and source/age indexes, no incoming foreign keys and no user triggers. A read-only NRL candidate search selected 24 of its first 64 expired candidates within the 4 MiB cap, in 5.317 ms, with no written/dirtied blocks. This is a warm read sample, not a deletion, cold/concurrent benchmark or reclaimed-space measurement.

The database allocation remained 558,394,515 bytes; retained copies had advanced to 2,319 with 150,537,127 stored payload bytes during genuine ongoing updates. The earlier 782-copy /79,140,857-byte candidate estimate is dated scope, not a verified disk saving. Source counters now showed Golf 47, WTA 19 and Bathurst 57 failures; EPL retained 380 fixtures and no failures. Those provider-health gaps are separate work. No forced refresh was used.

Supabase advisors reported existing no-policy notices for these service-owned tables; denying public access is intentional here. They also reported an unused current-fixture index, which is left in place because this repair does not justify removal. [Policy notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [unused-index notice](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index). The fixed search path follows [official guidance](https://supabase.com/docs/guides/database/functions).

## Cost, value and remaining proof

This addresses a demonstrated waste cause and may avoid storage-related interruptions while retaining the free plan. It adds no cash commitment or recurring owner task; existing assistant/runner costs remain unpriced. The narrow old-function rollback is locally rehearsed and its current live definition is saved. Independent off-device recovery, physical compaction and any blocked maintenance window remain separate pending work. Allocation need not fall after logical expiry.

Both independent source reviews passed with zero findings. The narrow storage delivery is published and verified below. The broader healthy-application gate remains open because the current Match Centre still sometimes returns degraded membership. No gate was bypassed or forced refresh used. Full sport, Football, physical-phone and invited-return-use approval remain open.

Detailed receipts are saved under `/Users/jackhartican/Documents/AI/Codex/storage-efficiency-review-2026-10-12`: pre-implementation baseline and advisor files, candidate query plan, project retention/compact/check logs, and earlier bounded rehearsals.

## Live delivery and ordinary effect

Reviewed source `8276a9253305b14cead2c3a2f3cfae75a3679cbd` was published to GitHub main before the exact SQL was applied through the normal Supabase migration tool. The actual server-generated version is `20261012113815`; the CLI-created file was reconciled to that verified version with identical SQL bytes, not an invented timestamp or manual history edit. Its two test path references were updated and both affected suites passed again using Node 24.19.0. Function digest is `7c001ceae18809a75401ba0c308a8603`; invoker/empty search path and denied public/allowed service access remain. The migration executed no immediate history cleanup.

At 11:46 UTC, an ordinary existing-owner US Open check had removed two expired copies (1,623,264 stored payload bytes). Source revision/hash, all 959 current fixture rows and their stored fact/date digest, plus latest saved revision/hash were unchanged. Its accepted-check time advanced to 11:40 UTC and failure count was zero. No publication, provider request, replay or scheduler was manually forced. There were still 781 expired non-keepers /77,593,132 payload bytes at that sample. Physical allocation was 558,419,091 bytes, so **no physical saving is claimed**. Other genuine source activity and the migration history itself affect aggregates.

The immutable app deployment remains READY `dpl_HuvHbaTXbVfJSpuod9iYY4oD42GE`, the same three production aliases and shell 516. Its earlier exact FBD source/served-artifact binding is reused; no new app deployment or cached-shell change accompanied this database/test/documentation module. GitHub publication, database application, ordinary cleanup and retained app deployment are separate claims.

## Existing Match Centre reliability gap discovered during verification

The pre-application public smoke passed with five listed and five selected fixtures. After application, the unchanged smoke failed twice because membership was explicitly degraded; one separate diagnostic read returned the full five-fixture list in 3.332 seconds. Neither later response nor a warm success erases those failures. The Vercel logs show the same fixture-bundle 3,000 ms timeout at 11:20 UTC, before this migration, and again at 11:39 UTC. This proves the failure existed earlier; it does not rule out every effect on frequency or prove its exact cause.

One read-only, once-materialised call of the actual Match Centre bundle using 12 published preservation IDs returned a complete 1,313-row /3,404,038-byte payload within a 2.5-second SQL limit, taking 1,954.953 ms in the transaction. This is dated warm evidence, not a cold or concurrent benchmark. The query/response has little margin left for transport and decoding inside the existing three-second budget. Large read work/payload is a supported hypothesis; database/connection timing is still unresolved. The storage publisher changes no read function or app bytes, and its history relation is absent from the Match Centre reader.

Recommended next module: reduce unnecessary Match Centre read work and payload while preserving complete expected membership, corrected known IDs, scores, source dates and current deadlines. Reproduce with the existing red-capable public smoke plus controlled full-handler regression. Do not enlarge the timeout, label a partial list healthy or repeatedly run until green. Then resume Football polish. This is a concrete launch gap in the CTO queue, not a new subscription or owner decision.

Extra receipts: migration-application.json, migration-history-after.json, post-application-verification.json, ordinary-owner-observation.json, ordinary-cleanup-comparison.json, app-deployment-after.json, both independent reviews, final-version test logs, both failed public smoke logs, public-degraded-diagnostic.json, membership-runtime-logs.json and membership-sql-diagnostic.json. A Python-only version fetch failed local certificate validation; the normal Node fetch independently confirmed shell 516 without relaxing TLS. No instrumentation or temporary debug source was added.
