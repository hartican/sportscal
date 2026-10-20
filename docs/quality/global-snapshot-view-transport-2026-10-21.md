# Global fixture transport — 21 October 2026

Status: prepared; not yet applied or published. Root remains the sole SQL executor and publisher. Global reliability is still failed, not accepted.

## Problem and measured mechanism

The latest 9b0eb2dc9b6e954874be8419b8e9dbd0 database reader passed whole-value and permission checks, but fresh public qualification failed on its ninth request after two complete rounds. Read 992cb2ae-6718-49af-bebf-1c9289f9307c failed before headers at 3003 ms against3000 ms. A successful isolated Function Scan is insufficient: the captured PostgREST query uses a target-list set-returning function and an outer JSON aggregate. Reproducing that complete frame hit the existing three-second SQL limit.

The proposed view exposes the same live query directly to PostgREST, avoiding the set-returning function's whole-result spool. It is a computed view, not a materialised view, stored response, new refresh owner or cache. A local PostgreSQL17 exact-frame comparison with5001 rows and2048 retained factual bytes per row kept whole parsed values identical and removed1477 temporary read/write blocks. Local RPC/view timings were161/133 ms and139/130 ms; these are not production speed or CPU forecasts. A separate bounded read-only cloud inline-view-frame sample completed in2436.467 ms with0 temporary reads and599 writes. The stored function sample had1484 reads/2085 writes. Separate samples establish work/call-shape differences, not causal timing attribution or reliable live acceptance.

Evidence: /Users/jackhartican/Documents/AI/Codex/nothingsport-snapshot-repair-20261021/inline-view-local-diagnostic.json and inline-view-framed-readonly-diagnostic.json. An earlier function-language prototype showed no useful advantage and was rejected. No language, planner, memory or deadline change is adopted.

## One live query owner and unchanged facts

`public.nothingsports_current_global_fixture_bundle` owns the existing global SQL with the nullable fixture argument fixed toNULL. The existing row RPC keeps its signature, grants and attributes; unselected calls delegate to this view. Explicit selections delegate to the unchanged original JSONB reader. The scalar compatibility signature remains exact. The Node global reader GETs one own `bundle` property from exactly one view row, then runs the same complete-envelope and fixture validation. Health and fixture resources still start in parallel. Missing, corrupt, empty, multi-row or incomplete view responses fail closed through the existing last-good/diagnostic path, without a legacy read or retry.

Admission still uses the original moving Sydney calendar window and conservative unknown-date handling. Original observations, read-time score/receipt overlays, exact numeric values, aliases, ordering,5001 overflow signal, selected full detail and all canonical writers remain unchanged. There is no membership snapshot or renewed check date. Existing complete descriptor shape and missing/unsupported/incomplete/pending raw fallbacks remain.

The reminder adapter recognises this transport and routes it to its existing required-ID-scoped RPC, explicitly retaining POST and the original retry/budget. It wraps the same scoped result for the view-shaped consumer. It cannot escape into the global view.

## Security and application

The migration guards the exact9b row preimage, A91 scalar, original JSONB reader, stored generated expression, private helper/trigger/schema/table contracts and existing service-only grants. It creates an invoker view, resets service-role privileges toSELECT and revokesPUBLIC/anon/authenticated. A postcondition refuses unexpected ambient grants, column ACLs, a changed owner or different invoker option. No public or authenticated database access is granted.

Apply only through the existing migration owner, with a one-second lock and three-second statement limit. No persistent data rewrite is needed. Do not repeat unchanged DDL after a failed or uncertain outcome. Existing app builds remain compatible through the delegated row RPC. A rollback must first restore the9b row body and prior app transport, then drop this view withoutCASCADE; preserve unrelated work and every canonical fact.

## Required acceptance

Permanent checks must cover the actual view, original/row/scalar/selected whole-value agreement (including exact numerics and5001), canonical updates and original clocks, malformed descriptor fallbacks, ambient-grant refusal, denied anon/authenticated and service-only invoker semantics, guard/replay refusal, actual Node GET/envelope failures/last-good, reminder scope and unchanged deadlines. PostgreSQL17 must exercise the full PostgREST view frame and require a restored RPC-spooling counterexample to fail. PostgreSQL18 retains the complete suite. Local timing thresholds are not release gates.

After exact contract preflight and one guarded application, exercise the real new HTTP transport repeatedly. Publish only a passing scoped snapshot through GitHubmain and the existing serialized dispatcher. Full safety, shared-input/erasure, exact release metadata, Match Centre, seven security routes and global freshness gates remain mandatory. Verify repeated fresh public membership/participants/selected reads, served artifacts and hosted A-League12-club/156-fixture Follow/search/Schedule checks. Retain original-profile World Cup evidence separately. No physical-iPhone or whole-sport certification claim follows from these checks.

## Primary technical references

- [PostgreSQL17 CREATE VIEW and security_invoker](https://www.postgresql.org/docs/17/sql-createview.html)
- [PostgREST tables and views](https://docs.postgrest.org/en/stable/references/api/tables_views.html)
- [PostgREST function response formats](https://postgrest.org/en/v12/references/api/functions.html)
