# Storage efficiency and free-tier headroom — 12 October 2026

The database is working, but it has a confirmed housekeeping gap. Its organisation is on the free plan and the allocated Postgres database is about 558 MB. Old copies of stable AFL/NRL records account for most of the **782 expired historical copies** identified by a read-only check. These copies carry about 79 MB of compressed payload; they are separate from current matches and user activity.

**Recommended path:** repair the existing publisher's seven-day cleanup so it also runs after a successful unchanged check. Preserve current facts, original observation dates and a latest saved copy for every source. Then measure allocated space again. If the old allocation remains, prepare one bounded physical reclamation window with verified recovery and explicit maintenance approval. Keep the free plan and the same refresh owner; a new subscription or rewrite is not the first action.

This is a read-only production assessment, concrete cleanup scope and locally rehearsed draft. No records were deleted, function replaced, maintenance run, refresh forced, scheduler changed or app deployed. The draft is not published or applied; production migration/recovery checks and physical reclamation remain work.

## Verified evidence

At 07:28 UTC (6:28 pm Sydney), Supabase reported ACTIVE_HEALTHY and the session/default write restriction was off. The organisation's current plan is free. Postgres allocation was **558,394,515 bytes** (558.39 decimal MB /532.53 MiB); the snapshot relation occupied 492,322,816 bytes. Supabase currently advertises a 500 MB free database allowance and describes a read-only restriction above the free quota. This sample establishes allocated size, plan and present settings; it does not prove a write failure, exact dashboard billing calculation, remaining WAL/disk headroom or when enforcement will occur. [Pricing](https://supabase.com/pricing), [database-size rules](https://supabase.com/docs/guides/platform/database-size).

The stored payload estimate was 147,009,606 bytes across 2,194 historical copies. A later 07:32 UTC candidate query found 2,195 copies and 147,031,867 payload bytes; the existing owner continued independently between samples. Allocation and payload are different measurements. Automatic vacuum is running: the snapshot table and its large-value storage were last automatically vacuumed on 10 October. This alone does not prove unused allocation will be returned. Supabase documents that full vacuum can lock a table and that maintenance may affect performance. [Database-size and vacuum guidance](https://supabase.com/docs/guides/platform/database-size).

The actual deployed publisher returns immediately after updating lease/check metadata when the content hash is unchanged. Its seven-day historical cleanup appears later, only on the changed-data path. Stable source checks therefore keep succeeding while expired historical copies remain. AFL's source check advanced to 12 October 07:16 UTC and NRL's to 07:24 UTC, with revisions 7180/7177; their latest historical copies remain dated 30 September. This is a verified control-flow defect, not evidence that current sporting results are wrong or that every retained record is final. The new card/Feed seven-day display rule is a separate policy.

Production is READY at 8a8a39a66409882bddc2278babc59f8bebdebd25 /shell 515. Git ancestry proves the original snapshot-deduplication fix 25059fa879c963c8dea3d0c5ff29aa77e581ece2 is included. Later deployments and new source coverage must still be accounted for before attributing aggregate savings.

## Comparison with the original baseline

| Measure | 27 September baseline | Earlier follow-up (29 September UTC) | Current sample | Interpretation |
| --- | --- | --- | --- | --- |
| Database allocation | 536,366,227 bytes | 538,512,531 bytes | 558,394,515 bytes | +22.03 MB from original; other relations/releases contribute |
| Snapshot relation allocation | 492,494,848 bytes | 492,494,848 bytes | 492,322,816 bytes | Essentially flat; allocated space did not follow payload down |
| Retained copies | 2,804 | 2,184 | 2,194 | Different retained windows/source coverage; no write-rate attribution |
| Retained compressed payload | Not captured in original summary | 217,683,201 bytes | 147,009,606 bytes | About 32.47% lower than earlier follow-up, with retention/coverage confounders |
| Copies added in the latest 48 hours | 1,010 | 369 | 841 | 16.73% below original; new source coverage and genuine changes matter |
| Compressed payload added in 48 hours | 91,877,920 bytes | 39,467,752 bytes | 37,276,497 bytes | 59.43% below original; observation, not a causal saving estimate |

EPL currently retains 19 copies from the latest 48 hours, with revision 8810,380 fixtures, zero failures and a successful check at 12 October 07:12:13 UTC. The latest historical copy is 11 October 17:22 UTC, so later checks have not created revisions. The latest two stored copies differ in one fixture's status/participants/result context and eligibility, plus observation timestamps. That supports a material content transition; it does not certify every one of the 19 transitions or independent source truth.

## Concrete cleanup scope

The SELECT-only dry run excludes both the source's current revision and its highest stored revision, even where either is old. It selects only copies older than seven days. It never queries or modifies account, Follow, chat, rating or reminder records. The 782 candidates carry 79,140,857 compressed bytes, leaving an estimated 67,891,010 bytes of retained payload at that sample. **This is not 79 MB of verified recoverable disk or a completed saving.** Physical size includes indexes, large-value pages, free space and overhead.

| Source | Expired non-keeper copies | Compressed payload |
| --- | --- | --- |
| live-nrl | 246 | 42.86 MB |
| live-afl | 367 | 33.23 MB |
| live-us-open | 2 | 1.62 MB |
| live-presidents-cup | 161 | 1.28 MB |
| live-aflw | 1 | 0.12 MB |
| live-fantasy-fpl | 1 | 0.02 MB |
| live-bjk-cup | 2 | 0.01 MB |
| rugby-ra-949624 | 1 | 0.00 MB |
| rugby-ra-949461 | 1 | 0.00 MB |

The final migration must use a transaction-consistent cutoff and protect current/latest copies at execution time, rather than deleting a stale saved ID list. Test unchanged success, changed success, expired leases, invalid input, source failure, missing history, age boundaries and repeated runs. Use the same publisher and its indexed source/age lookup; add no refresh owner, per-user read or provider call. Preserve last-good/current hashes, fixtures, user activity and original fact/check clocks. Verify actual persistence and metadata-only successful checks. Physical maintenance requires measured disk/WAL headroom and recovery/rollback proof; automatic vacuum must not be presented as proof of physical compaction.

## Source health remains separate

| Source | Failures since last accepted check | Last accepted check (UTC) |
| --- | --- | --- |
| live-supercars-bathurst | 50 | 2026-10-11 06:32:05.743617+00 |
| live-golf-current | 39 | 2026-10-11 11:50:01.34939+00 |
| live-tennis-wta | 11 | 2026-10-12 02:52:02.450222+00 |
| live-us-open | 4 | 2026-10-12 06:00:11.73493+00 |
| live-premier-league | 0 | 2026-10-12 07:12:13.474442+00 |

These are point-in-time source counters, not new calls or proof of a parser defect. Last-good data remains. Golf, Bathurst, WTA and US Open failures need their own bounded cause/visible-staleness checks; ACTIVE_HEALTHY does not establish that every sports provider is healthy. Do not retry or run a manual refresh to manufacture a green health report.

## Value, cost and owner impact

| Recommendation | Business value and evidence | Effort, dependency, cash and owner time | Acceptance / why act or defer |
| --- | --- | --- | --- |
| Repair cleanup through the existing publisher | Stops expired copies accumulating whenever matches stop changing; deployed control flow and 782 candidates prove the gap | Estimated 0.5–1 focused engineering day for a tested migration/rehearsal; existing SQL owner and read-only scope. No new service commitment, existing assistant/runner costs unpriced; no recurring owner task | Successful unchanged checks prune only expired non-keepers; current facts/user activity and metadata stay correct. Implement as one separate passing module after the reserved card release |
| Reclaim physical allocation if necessary | Restores useful free-tier room; allocation is currently above the published allowance | Duration/temporary space unknown until a rehearsal. Requires verified recovery, actual disk/WAL headroom and one maintenance decision if a blocking rewrite is needed | Measured allocation/quota falls, original protected hashes/permissions remain, live reads and next genuine owner check recover. Defer production compaction while those prerequisites are unverified |
| Keep the free plan for this repair | Follows the owner's spending decision and addresses a concrete waste cause | No purchase. This assessment does not price current usage or guarantee future capacity | Spend only if measured remaining demand cannot be served safely after reclamation; no automatic upgrade |
| Keep one queue and exception report | Prevents another maintenance dashboard or owner routine | Add this verified finding to the existing CTO queue; reuse the same normal owner/readout | Observe actual size and source failures during existing review. Add no new scheduler/monitor or repeated owner questions |

High confidence: plan/status/allocated bytes, deployed cleanup control flow, dry-run candidate scope and current source counters. Inferred: some allocation may be reusable/reclaimable and retention repair should prevent this recurrence. Unverified: actual physical recovery, dashboard enforcement, production write paths under load, source failure causes and a cleanup deployment. Whole-sport and monetisable-MVP approval remain open.

Evidence: evidence.json, comparison.json, production-binding.json and dry-run-expired-snapshots.sql in this output folder. Existing baseline and earlier comparison are retained unchanged. One evidence-export parser initially matched explanatory text rather than the data envelope; the corrected exporter saved the actual tool results without repeating queries or changing production.

## Reviewable local repair draft

`publisher-retention-draft.sql` is a narrow change to the captured deployed function. Both accepted unchanged and changed branches now reach the same existing seven-day cleanup. The cleanup captures one cutoff and protects both the returned/current revision and the highest saved revision. Lease validation, invalid-input handling, source/current-fixture writes, meaningful hashes, timing intervals and the function signature remain. This adds a source-scoped maintenance statement to unchanged success; its real runtime must fit the existing owner/request budgets. It adds no provider call, browser request, new refresh owner or timer.

The actual deployed SQL fails the local regression: expired revision 1 remains beside keeper 2 after unchanged success. The bounded draft passes 15 cases using the already installed PGlite 0.5.8 in memory: unchanged success, old keepers, different current/latest revisions, changed success with a zero score, invalid/expired leases, malformed/empty input, missing history, either side of the seven-day boundary, other sources/user activity, reruns, quiet interval timing, a 64-copy work limit and a 4 MiB stored-payload limit per accepted check. [PGlite API](https://pglite.dev/docs/api).

The local rehearsal engine reports PostgreSQL 18.3. A separate PostgreSQL 17.6 rehearsal through the current Supabase connection passed the same 15 cases using only synthetic temporary objects inside a rolled-back transaction. Its final check proved the temporary objects were gone and the live publisher definition was unchanged. No live match/user relation, source refresh, scheduler or deployment changed. A fresh permission preflight found anonymous/authenticated execution denied, service-role execution allowed and forced row-level security on the three source tables. These receipts do not establish concurrent-publisher performance, full recovery or released persistence.

The existing local Supabase CLI created the normal guarded migration file. It is saved separately and not published or applied. An additional local rehearsal applies that actual migration in a synthetic database and passes 17 cases: the 15 behaviour/work-limit cases, preserved caller privileges and refusal/rollback when the publisher no longer matches the reviewed baseline. No new dependency/runtime was installed. The exported old definition is a rollback reference, not a substitute for recovery. Recheck the actual function digest before applying the migration and integrate these meaningful cases into the existing release path after the reserved card module.

Receipts: deployed-publisher.sql, publisher-retention-draft.sql/.diff, publisher-binding.json, rehearse-retention.cjs, retention-baseline-red.log, retention-draft-green.log and retention-draft-cases.json. Existing production remains unchanged and the reserved card release remains first.

The work limit is at most 64 expired copies and 4 MiB of stored payload per accepted source check, oldest first, under the existing source-row lock. Current/latest copies remain protected. The largest currently identified expired payload is 811,632 bytes; a future copy above the byte budget needs a specific maintenance assessment. This bounds row/payload work, not full hardware latency or physical allocation. No immediate pruning is executed by the migration itself.

Updated receipts: retention-draft-bounded.log, pg17-bounded-proof.json, pg17-rollback-rehearsal.sql, migration-source.json, migration-draft.sql, migration-rehearsal-17-green.log and migration-draft-cases.json. Earlier unbounded receipts remain clearly dated and separate.
