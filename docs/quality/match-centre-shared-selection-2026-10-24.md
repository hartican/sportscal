# Share the Match Centre selection scan — staged candidate

The existing near reader scans the canonical fixture list separately for admission and context lookup. This candidate materializes their small, unfiltered selection inputs once per statement. Admission still uses the original seed predicate; lookup retains the whole input list, including distant preserved identities, missing dates and transitive context. It stores no sporting projection or persistent cache.

The intended database transition is exact D9 `d9b49086166c24b3a10b4dc1f7279b7c` to `2b77bfdd5e17d2ceb0737ea53221a4d9`. The guarded migration and inverse retain the service-only stable SQL invoker, empty search path and original function contract. The generated compact-base expression and table RLS are guarded. Index readiness, temporal admission, recursive closure, candidate limit/sentinel, receipt expansion, final projection, ordering and envelope are unchanged. No writer, source request, scheduler, application request, retry, timeout, shell or customer setting changes.

## Local evidence

The actual stored original and candidate functions returned byte-identical ordered PostgreSQL JSONB text in all six synthetic comparisons. Four samples per variant used balanced old/candidate ordering. Timings include the stored scalar response text and local JSON parsing; they exclude HTTP, platform start, source-health requests and network download. There is no timing-based CI pass threshold.

| Engine | Canonical inputs | Original median ms | Candidate median ms |
|---|---:|---:|---:|
| PG18 PGlite 0.5.8 | 12 | 5.94 | 5.62 |
| PG18 PGlite 0.5.8 | 3,000 | 68.47 | 65.58 |
| PG18 PGlite 0.5.8 | 6,400 | 220.88 | 215.38 |
| PG17 PGlite 0.3.14 | 12 | 6.44 | 6.42 |
| PG17 PGlite 0.3.14 | 3,000 | 64.40 | 60.99 |
| PG17 PGlite 0.3.14 | 6,400 | 210.17 | 203.65 |

This is a modest local gain (the smallest PG17 difference is effectively noise), not reproduction or resolution of the managed 3.69-second instrumented sample. Separate bound inline plans show two admission/lookup base-table scans becoming one. Those plans are not nested plans of the stored function. Restoring the exact original body fails the deterministic shared-work check.

`validate-match-centre-shared-selection.js` passes 37 checks on each engine. It pins D9 and the candidate fingerprints; compares complete ordered JSONB against an independent D9 function; covers aliases, preserved far/missing-date fixtures, status/start/completion clocks, explicit null overlays, zero scores, original receipts, first-completion branches, missing/pending context fallback, roles, migration refusal/replay, inverse/reapply and 5,001-row overflow. All other public/private function definitions and ACLs remain exact. Both commands are added beside, without replacing, the existing production checks.

The disposable factory uses actual physical current tables, FORCE RLS, the generated compact base and real context hooks/projector/parser. It does not replace D9 inputs with a simplified view or stub projection. Local checks bind the projector `44d1edfc00ada08fad8deb987472ad54`, time parser `13842433b7af056a35c01e8b234ae3c9`, and sync helper `3c20e52d95ebda90af1bb15369939738`. Its synthetic rows, source distribution, repeated clocks, physical storage/statistics and WASM engine differ from production. PG17 here reports 17.5, not native production parity.

## Fallback finding and limits

One additional local PG17 comparison kept the same 3,000 inputs and exactly identical 201-row/528,657-byte output across readiness states. Original/candidate elapsed ms were 69.77/64.49 when ready, 232.57/218.76 with pending metadata, and 232.23/217.03 after deleting one context inside the same disposable transaction. That delete naturally marks pending too; it does not isolate a missing-only state. These single pairs show constructed fallback amplification and preserved output, not actual production readiness or a stable speed estimate.

Canonical fixture/score hooks maintain context. Private change triggers mark pending; deferred commit enforcement validates source-index completeness and deletes pending or rejects the whole transaction. A separate reader does not ordinarily see another transaction's uncommitted pending state. A paused or failed scheduler alone therefore does not prove persisted bad metadata. Current live readiness remains unknown. No metadata was cleared or repaired in production.

## Callers and release boundary

Match Centre list loading uses `scope: match-centre` and this D9 RPC. Participant profiles use the separate participant bundle; ordinary global Feed reads use the computed global view; selected fixture reads use their independent current-fixture/score RPCs. This patch does not optimize those readers, source-health or catalogue/client composition.

DEPLOY alone owns any database trial, integration, publication and exact-main deployment. The normal workflow does not automatically apply SQL migrations. Before adoption, compare the full actual captured output and permissions, then measure actual complete cold/warm responses and repeat fresh Match Centre, participant, global and selected-fixture acceptance. Preserve existing browser, installed/offline, Results privacy and failure/last-good checks. A required failure blocks the affected release. No shared migration, main publication, deployment or hosted acceptance occurred in this worker task.

Evidence: `/Users/jackhartican/Documents/AI/Codex/match-centre-latency-20261024/near-stage-local-1/` contains source invariants, all benchmark cells, both final qualification logs and fallback-state evidence. Earlier 9909 baseline selection and the diagnostic scan-count assertion failure remain separately retained; neither is relabelled as a successful D9 baseline or acceptance.
