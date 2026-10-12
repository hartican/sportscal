# Football schedule loading: verified gap and next repair — 13 October 2026

**Status: implemented locally; 37 checks and five paged actual-data comparisons pass. Guarded database application, exact app release and live browser proof remain pending.** This is the next engineering item in the single CTO delivery queue. It does not add competitions or certify Football.

## What users experience

A genuine anonymous Arsenal schedule request returned 44 matches after 4,446 ms. Its server timing shows the shared current-data read consuming 3,004 ms, then falling back to the published schedule. The HTTP response is successful, but contains neither a current snapshot revision nor an explicit failed-current-check field. The existing profile loader clears its notice on this successful response. This preserves usable saved data but does not explain why the latest matches could not be checked.

The production warning separately confirms a global fixture-bundle `supabase_timeout` after 3,004 ms on `/api/feed` at 12 October 13:37:32 UTC. One observed warning and one request do not establish a failure rate or cold-start performance. Match Centre's separately repaired current-window read remains unchanged.

## Evidence and architectural boundary

The actual global reader digest is `ef1658b2eb58a376f368ede88730ad43`. This is an intentional rollback, not an unapplied migration: the backend decision and migration history retain two earlier equivalent global-reader experiments that failed to meet the existing three-second REST deadline. Do not replay those experiments as a new fix.

The participant endpoint currently reads the worldwide current bundle before applying its requested calendar. A read-only mechanism trial restricted that same query to the two currently identified EPL/FPL sources: 710 complete rows, 1,532,447 text bytes and 729.395 ms inside a 2.5-second diagnostic limit. This is database timing, not a measured phone or deployed API improvement.

An actual current-main store/handler replay with captured current source facts keeps the same 44 Arsenal fixture identities, with no missing or added calendar entries, and uses the existing two reads. This verifies a useful mechanism for this current request. It is not full-world equivalence, future source coverage, authenticated navigation or production integration. A production fix must not hard-code those two source names or assume the raw key is `football`: the primary rows use `premier-league`, and Fantasy rows have no key.

Keep canonical facts separate from response selection. Resolve the request through the existing Follow rules, then fetch all source facts and context needed by that response. Membership, fixture identity, sport-specific interpretation and presentation remain in their existing owners.

## Recommended implementation

Add a service-only scoped bundle read to the existing snapshot store for participant calendars and Favourites. Bind its inputs and cache to the full requested response requirements, including other followed identities used by the response. Preserve complete source groups, ambiguous sources, declared alias chains and semantic overlay context. Include source-only arrivals and corrections to existing published/saved fixtures, even when a correction withdraws or moves an old calendar entry. A known-ID-only shortcut is insufficient.

Keep the full calendar horizon, original observations, complete fixture fields, selected detail path, 5,000/5,001 completeness boundary, two parallel reads and three-second transport deadlines. Unbounded or unknown request requirements use the existing full read; a failed read remains explicitly degraded rather than returning a quick partial success. Retain the existing provider, publisher, scheduler and last-good owners. No new polling, retry loop, table migration, provider request or subscription.

Expose an explicit fixture-snapshot freshness state in the API. The profile should show a short saved-schedule notice when its current read fails or returns retained stale data, preserve original fact dates and use the existing Refresh action. Successful recovery clears the notice. This adds no owner choice.

Ordinary personalised Feed optimisation remains part of the programme, but is not to be silently folded into a participant-only proof. Its wider response requirements must be derived and checked separately before adopting the same transport seam.

## Acceptance and release

Implementation adds a service-only participant bundle, complete source-group/alias/semantic context selection, exact request binding and bounded retained scope caches. Arsenal, Aston Villa, a current-team player, club Favourites and a profile with mixed favourites return identical complete paged bodies against the captured old-full reader. The capture retains all 769 raw rows of the three source groups selected by the current Football diagnostic and all 44 health records; other raw source data was not captured. The whole-world export failed its 2.5-second administrative statement gate, then its larger eight-second export failed transport. Those observations are retained; no production deadline was increased. The smaller complete Football capture succeeded. Existing global/Match Centre, server Feed, live-store and shell-cache checks also pass. Browser/update checks and independent reviews follow before application. This records passing local proof, not a release or broad certification.

- Compare the actual old-full and new-scoped handler results at a fixed clock across Football and representative other profiles, including mixed favourites, player/current-team inheritance, aliases, unannounced source-only fixtures and complete pagination.
- Exercise score-only/metadata overlays, alternate supported timestamps, missing/raw legacy sport keys, unknown requirements, reschedules beyond the old horizon, cancellations and explicit null withdrawals. Do not create dates or participants to make a test pass.
- Preserve IDs, original source/score/status clocks, zero scores, viewing context, Results OFF, saved choices and reminders OFF. Empty choices and capacity failures must not masquerade as healthy missing coverage.
- Verify real role permissions, guarded application, bounded inputs, wrong-scope/incomplete rejection, cache isolation and last-good/degraded recovery using the actual schema and caller.
- Run affected and normal release gates. Publish only the passing scope, apply the reviewed exact SQL, deploy the exact published app snapshot, and verify READY/aliases/metadata/served bytes and genuine healthy production profile navigation in both browser engines. A changed cached notice requires the existing cache/update rehearsals.
- Keep source comparisons, hosted timing, physical phone, signed-in use, normal scheduled publication, playback, rights and genuine return visits separate. No retry-until-green or bypass.

## Value, effort and constraints

Value: current team schedules should arrive with less unnecessary work, and a failed update becomes understandable. Evidence supports a scoped read seam rather than a rewrite or a longer timeout. Estimate: 1–2 focused engineering days, with uncertainty around complete mixed-response/context selection; this is not a promised calendar finish. Dependencies: existing Follow rules, current source/identity contracts and exact release controls. Added cash commitment: A$0; model/runner costs and savings remain unpriced. Recurring owner time: none added. Act now because the failure is verified; defer extra competitions, artwork collection and commercial launch until their existing evidence gates pass.

Evidence folder: `/Users/jackhartican/Documents/AI/Codex/football-profile-read-reliability-2026-10-13`. Full programme approvals remain 0/18 families and 0/3 Football pilots, targeting at least 15/18 families.
