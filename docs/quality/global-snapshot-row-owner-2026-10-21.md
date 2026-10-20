# One aggregation owner for the global row reader — 21 October 2026

## Required behaviour

Fix the actual global snapshot timeout within the same two-resource, three-second budget. Preserve every fact, ID, observation, date/status/alias/NULL/empty/overflow rule, exact JSON value, endpoint, one-row RPC shape, parameter/type/default, function attributes and service-only permissions. Near, selected, participant and reminder readers, helper functions, source facts, accounts, scheduler, memory limits and application code remain unchanged. The two existing global JSON function bodies may change to remove their redundant boundary; this supersedes the earlier scalar-only implementation restriction without changing any public contract.

## Decisive retained evidence

The third scope migration was applied once and exact contracts verified. Its actual stored wrapper finished once in 2686.241 ms, but fresh public qualification stopped on the second participant/global read: fixture-bundle supabase_timeout 504, 3003.192 ms against 3000 ms at 16:59:44.979Z; health succeeded in 78.470 ms. No third round, retry, new publication or release followed.

The exact query body had 3273 temporary written blocks in a read-only generic plan, while the stored scalar-plus-row wrapper wrote 6235. A later current-body timing profile took 897.355 ms, demonstrating large timing variation and making a small one-shot timing improvement insufficient evidence. A narrow two-stage date-expression experiment passed equality but changed a separate body measurement only from 2302.621 to 2214.1 ms; it was rejected, never applied.

Our installed PGlite 0.5.8 uses PostgreSQL 18.3, while the retained production configuration records PostgreSQL 17.6.1.166 (not freshly re-queried). PostgreSQL 17's SQL executor builds a result tuplestore for scalar functions too; PostgreSQL 18 removed that unnecessary scalar store. See the [17 executor source](https://github.com/postgres/postgres/blob/REL_17_STABLE/src/backend/executor/functions.c) and [18 executor source](https://github.com/postgres/postgres/blob/REL_18_STABLE/src/backend/executor/functions.c). Version mismatch limits earlier local performance inference; it does not invalidate the whole-value comparisons.

## Consolidation and actual local proof

The existing PostgREST SETOF-json row reader now owns the exact unchanged 7b1f7a5d... aggregation body. The existing scalar signature becomes a compatibility delegate to that row reader. This removes one scalar function boundary on the actual RPC path, preserves one query owner and introduces no new function, endpoint or app request.

An offline cached PGlite 0.3.14 runtime reports PostgreSQL 17.5. With 5001 constructed actual-schema fixtures, each carrying the same extra 2048-byte factual value, both versions of the actual RPC emitted exactly equal ordered JSONB. At the same local 2184 kB work_mem, PostgreSQL 17 temporary writes fell from 6075 to 4569 blocks, eliminating 1506 blocks (about 12 MB) of one extra whole-result copy. One measured pair was 219.161 versus 186.411 ms; this is mechanical local evidence, not a cloud latency/capacity/billing forecast. PostgreSQL 18 wrote 4569 blocks for both variants, matching its different executor behaviour. The complete candidate equality harness passes on PostgreSQL 17 with the corruption negative correctly targeting the new query owner.

## Permanent prevention and release requirements

The actual reader harness installs all four guarded migrations. New guards reject changed scalar/row/helper definitions or rights, preserve both signatures/attributes and all other definitions/ACLs, reject replay and retain every original whole-output comparison. Receipt corruption still must fail. A PostgreSQL 17-only wide-row check compares real prior/current RPC temporary writes and restores the old caller chain as a negative control; it gates removed work, never noisy timings. The normal workflow retains every PostgreSQL 18 check and adds this same reader harness on a pinned, dev-only PostgreSQL 17 alias. There is no application runtime dependency or extra scheduler.

Required next: both permanent major-version tests, exact Spec/Standards review, one guarded migration, exact six contracts, actual stored RPC completion and three separate fresh public rounds. Only then publish one scoped snapshot and run the normal full exact-SHA deployment, global freshness, security, served-asset and hosted A-League 12/156 checks. No successful earlier sample, READY deployment or original-profile proof overrides a failed gate. No physical-device, load, long-term sporting freshness or full MVP certification claim follows from this local proof.


Preparation status: the new row-owner migration is local and has not been applied. Production still has the third migration scalar 7b1f7a5d... and deployed app 580/6dfa with failed acceptance. No fresh cloud call or unchanged public retry was used for this local ownership proof.

Both permanent major-version regressions passed, including all four migration guards, exact six contracts and PostgreSQL 17 wide-row negative control. The normal workflow retains the PostgreSQL 18 run and adds the pinned PostgreSQL 17 alias; that alias must explicitly report major 17, preventing silent skip after a future dependency change.\n