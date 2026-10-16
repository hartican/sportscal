# Highlights allowance and repeated lookup repair

User request, 16 October 2026 Sydney: identify what consumed all ninety searches and fix Watch highlights, particularly Australia–New Zealand Rugby League World Cup. IMG_5749.PNG shows the unavailable page; the earlier installed-worker navigation defect is a separate shipped repair.

## Evidence and limits

Read-only production ledger: Pacific day 2026-10-15 has 90 search reservations, 87 ordinary reservations and 45 scheduled search reservations. Therefore 45 are from scheduled discovery and 45 are outside that source allocation, including viewer/verification lookups. Previous-day counters were 60/87/50. These are durable reservations, including failed/aborted calls and conservative legacy recovery, not an exact provider billing receipt. There was no per-search history, so the remaining 45 cannot honestly be assigned to individual users, cards or diagnostic runs. The existing audit performed bounded production checks; do not describe every non-scheduled reservation as an end-user tap.

The existing source has a thirty-minute cadence, two searches per pass, a fifty-search daily subset and six-hour fixture/channel retry. Its recent report was partial with 93 eligible, 47 linked and 46 pending fixtures. These latest report slots are not a complete daily audit. Keep its budgets and owner unchanged.

A deterministic red regression reproduced three sequential unresolved taps issuing three searches. Inspection also found process-local-only coordination and an hour-old current selection being omitted from the metadata candidates, allowing a needless fresh search. All new implementation verification uses injected provider responses and local PostgreSQL; it spends no production quota.

## Required behaviour

- Keep the single atomic Pacific-day 90-search/500-ordinary ledger, scheduled fifty subset, source cadence, two-per-pass cap, three-second database and twenty-second route deadlines. Never reset or refund failed dispatch reservations.
- Reuse an unsuccessful lookup for thirty minutes across workers, fixtures fenced by current query/context hash. Reserve before dispatch and persist the retry guard before dispatch, so a killed worker cannot immediately spend again. Quota-denial retries become eligible no later than the next Pacific reset.
- Allow only one active thirty-second same-fixture lookup lease. A waiting worker may read the committed result with bounded server-side waits; no browser polling or scheduler is added. Stale tokens cannot reserve, revoke or finish a newer lookup. Reuse fresh successful selections without provider requests.
- Revalidate an hour-old eligible selected video by ID rather than searching again. Reuse metadata already checked during the same request. An explicit current suitability rejection revokes the exact known video; an outage alone preserves eligible last-good media.
- Before paid general search, inspect at most fifty uploads from each of at most four reviewed official publisher playlists, using ordinary allowance. Every candidate still passes the existing actual upload, context, language, duration and Australian availability checks. A suitable official clip can therefore resolve when search allowance is exhausted. This does not guarantee that a publisher has uploaded this match.
- Keep one automatic video redirect, existing official/dedicated/reel/general preference and approved Watch highlights wording. Do not replace a missing clip with another match, an old edition or a full replay. No sporting fact, Follow rule, customer state, source clock or admission change.
- Store lookup outcome, retry/lease and per-fixture daily reservation counters only in the existing service-only public-media cache. No account identifiers, query text, provider payloads or keys. Do not expose the cache to anonymous/authenticated roles or create a second quota owner.

## Application and rollback

Apply additive migration `20261015235542_coalesce_highlight_lookups.sql` before deploying the resolver. The production migration service assigned that version to the unchanged reviewed SQL, originally named `20261015232237_coalesce_highlight_lookups.sql`; the recovery README records the mapping. Existing positive selections and the quota function remain unchanged; old cache readers safely ignore null-video negative rows. Four empty-search-path security-invoker RPCs retain service-role-only execution and three-second limits. No frontend shell change is needed.

After reverting the application, the matching file in `supabase/rollbacks/` removes only null-video lookup rows and additive coordination fields/functions. It restores the original non-null video constraint and retains valid selected videos, global usage and all sporting/source data. Local migration/rollback verifies the original quota function definition hash and spent counters are unchanged.

Acceptance: canonical `validate-fixture-highlights.js`, including production resolver plus local SQL negative reuse, independent-instance coalescing, saved-ID reuse, crash/context/token fencing, full-search-budget official uploads, grants and rollback; existing Follow/backend/release guards. Local PGlite tests queue SQL statements and do not constitute multi-connection production lock timing proof. The sole shared release owner applies/reviews the production migration, runs the normal exact-SHA release and performs one bounded actual AUS–NZ media check. A valid real video redirect and physical Australian playback remain separate evidence; never mark playback passed from mocked data.

Evidence directory: `/Users/jackhartican/Documents/AI/Codex/highlights-budget-20261016`.

## Verified production delivery

App `b9d0493b075321f8d06019114d5e990e7523404f`, unchanged shell 550, passed [normal release 38826686021](https://github.com/hartican/sportscal/actions/runs/38826686021). READY `dpl_FWGjqfNJjMKxXiw6A7dMKz3KWM6x` matches the exact published SHA and release metadata. All three existing hostnames bind to it; the protected hostname still requires sign-in. Six served files agree, four server sources match the sealed immutable inventory, and both new modules appear in the API function dependency trace. The publisher now automatically verifies/aligns all three bindings after its READY/SHA check, with paired review and failure/no-op tests. Normal public Match Centre acceptance passed two displayed/two selected fixtures; this does not certify cold speed.

The guarded additive migration succeeded before deployment. Before/after reads prove the original quota function MD5 `b24f8460e6bf2f2ece4608d1e0ba1bd8`, all 45 positive selections and their semantic hash, and both captured daily ledgers unchanged. All four RPCs are invoker/empty-search-path/three-second/service-only; cache RLS and denied browser access remain. Production history assigned version `20261015235542`; the paired source migration/rollback names now match. Recovery mapping is in the Supabase README. The security advisor's no-policy information for this service-only cache is intentional denial, not permission to add browser policies.

One actual reported AUS–NZ lookup at `2026-10-16T00:11:54Z` returned HTTP 503 in 2,733 ms. Its durable row records zero searches, one ordinary reservation, `quota_denied` and retry eligibility at `00:41:54Z`; the observed global ledger moved from 90/89/45 to 90/90/45. A playable target remains unresolved. This neither proves a clip is absent nor certifies playback. No second lookup, quota increase or reset was used. The real reservation/retry state and original failure are retained in `root-actual-*.json`.

All 146 required client files are byte-identical to the paired installed/offline upgrade snapshot, so that evidence is reused explicitly; no shell bump was needed. Controlled native taps and SQL/resolver tests remain separate from real Australian playback, physical-phone proof and independent cloud lock timing. No sporting facts, source clocks, saved choices, recurring job, subscription or owner routine changed. The existing large deployment-size warning and optional debug colour dependency trace warning remain recorded; the package/dependency gate passed.

## Review closure

The first paired review found three defects: a waiting worker could return its original video after another worker withdrew it; a withdrawal-request timeout could leave the rejected video stored when failure finalisation succeeded; fixture attribution captured its own Pacific date before the authoritative reservation. Deterministic local SQL regressions reproduce the first race and cover all three. Successful shared reads now replace or clear retained state; known rejected IDs travel into atomic failure finalisation; attribution uses the granted ledger day. Original review findings are retained in the external evidence folder, followed by the final review dispositions.
