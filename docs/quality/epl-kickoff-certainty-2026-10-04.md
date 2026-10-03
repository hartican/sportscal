# EPL kickoff certainty — 4 October 2026

Status: local implementation and release checks pass; GitHub publication, normal production deployment and hosted verification are pending. This is a timing/reminder integrity repair, not EPL or Football MVP certification.

## Problem and outcome

Verified: the primary adapter treated equal `kickoff` and `provisionalKickoff` timestamps as confirmation. All 380 rows in the retained 3 October primary snapshot carry equal timestamps and completeness 3. A December Matchweek 13 fixture consequently advertised an exact, confirmed start and passed the existing source-time reminder policy even though its broadcast-selection window had not been announced.

The [league's announcement timetable](https://www.premierleague.com/en/news/4675211/dates-when-202627-premier-league-live-tv-fixtures-will-be-announced) lists December/January Matchweeks 13–20 for an estimated week commencing 19 October and says dates may change. Equal raw fields are therefore insufficient evidence. The [league's explanation of fixture movement](https://www.premierleague.com/en/news/4324634/why-matches-move-after-fixtures-are-released) supports keeping later scheduling uncertainty explicit. No undocumented meaning is assigned to another completeness/status code.

At this dated snapshot there are 50 completed and 330 upcoming EPL fixtures: 70 reviewed announced starts remain exact; 260 other upcoming starts show Approx. and are ineligible for automatic reminders from their provisional clocks. An announced start is still subject to later amendment and normal reminder freshness/consent rules. This does not promise immutable kickoffs.

## Dated independent comparison

Seventy fixture starts across Matchweeks 6–12 reconcile 70/70 with the retained primary API snapshot at 2026-10-03T12:09:24.882Z. Official notices were reviewed at 2026-10-03T20:55:46.267Z. Ten matches per window, exact club pairs and explicit London-to-UTC conversion cover both sides of the 25 October UK clock change.

| Official evidence | Reviewed scope | Treatment |
|---|---|---|
| [17 August October/start-November notice](https://www.premierleague.com/en/news/4688862) | Matchweeks 6–9 | Retain only uniquely reconciled final listing after later amendments |
| [1 September further amendments](https://www.premierleague.com/en/news/4705445/further-fixture-amendments-announced-in-september-and-october-2026) | Liverpool–Brighton, Villa–Fulham | Explicit later amendment resolves the earlier duplicated Liverpool–Brighton listing |
| [21 September November notice](https://www.premierleague.com/en/news/4725574/fixture-amendments-for-premier-league-matches-in-november) | Matchweeks 10–12 | All 30 matches agree, including 14:05 starts |

`data/canonical/epl-kickoff-certainty.v1.json` stores source IDs, ordered clubs, matchweek, UTC start, official URL and review/publication dates. It contains facts rather than article copy. Complete declared windows, uniqueness, official URLs and real non-future dates are validated. This is dated agreement evidence; no new provider observation, commercial permission or exhaustive live-status mapping is claimed.

## Implementation and acceptance

- The existing primary card adapter and shared server snapshot overlay use `scripts/lib/epl-kickoff-certainty.js`. A change to identity, clubs, week or UTC clock cannot borrow an older confirmation. Existing completed results and stopped/live states remain under their established paths.
- The reminder catalogue already passes through the shared overlay. An old stored source with `confirmed/exact` fields cannot restore false future certainty. Explicit Remind OFF and opt-ins remain authoritative; no reminder is sent or replayed by this module.
- The canonical owner's scoped retained-data mode rebuilds existing Feed/Follow/Inspector projections; 0 provider or AI calls. Full/quick/live source refresh uses the same qualification. Later announced windows enter through the same owner's normal Football acceptance work.
- Actual sporting/viewing facts and genuine source observations are preserved. Separate timing provenance dates this review. Custom editorial survives; only the old blanket confirmed-kickoff sentence changes.
- A reproduced Schedule fallback omitted Approx. despite correctly estimated source data. Its existing inline renderer now labels approximate/not-before/unknown clocks. Shell 416→417 is coherently versioned; unchanged generated runtime and deferred profile bytes are retained.

## Verification and failures retained

137/137 normal release safety commands pass locally on the final shell 417 candidate in 135,298 ms; Node 25 local proof remains distinct from the normal Node 24 cloud release. An earlier source/data-only candidate passed the same 137 checks in 136,387 ms and is archived separately.

Actual file comparison preserves every one of 1,503 incoming/published IDs and all kickoff/date/time, score/status, participants, viewing and source-check facts. Only EPL scheduling interpretation, its targeted sentence and timing provenance change: 380 incoming records and 330 published records; 1,173 published records are byte-equivalent by event. All 92 published Football table rows, the primary canonical facts, OpenLigaDB dataset, delayed results, generated runtime and deferred profiles are unchanged.

Public paging moves 853→837 records, 43→42 pages because publication crosses the Sydney date boundary from 3→4 October. All 16 removed page records dated 19 September fall outside the existing 14-day retention boundary and remain in the full canonical dataset. There are no added page records or admission/retention policy changes. This is normal projection movement, not data loss.

144 local renderer cases pass: 72 actual published confirmed/provisional cases and 72 controlled changed-start/TBC cases; Chromium/WebKit, 320/390/1280 widths, two themes, Feed/Schedule/fallback, reminder eligibility and preserved preferences. APIs are mocked unavailable and workers blocked. Full Football profile suites pass 12 actual journeys per engine plus their existing progressive/source-context rehearsals. Both 416→417 upgrade simulations preserve preferences, offline/reopen/resume, required-shell failure fallback and existing profile/standings/status caches. None proves a physical installed phone, push receipt or authenticated playback.

The first fallback browser run failed on missing Approx.; the log is preserved and the final repaired run passes. The first comparison's Brighton alias mismatch is preserved separately; the corrected known primary alias reconciles70/70. A guessed absent performance-check filename failed; the actual existing feed-performance gate passed, with 8 critical requests unchanged and gzip growth 0.71% under the unchanged 1.25% cap. The original final-gate helper's shell 416 label was corrected to 417 in metadata; check outputs were not rewritten. Browser case labels likewise explicitly separate published and controlled observations.

Evidence root: `/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/epl-kickoff-certainty-20261004/`. `comparison.json`, `baseline-certainty.json`, `preservation-final.json`, `browser-local.json`, failure logs, both profile and upgrade logs; sibling final/source-only137-gate inventories. Publication/control/served/hosted evidence will be added after normal release.

## Business value, cost and next gate

Business value: reduce misleading future-start certainty and mistimed reminders; maintain dependable Football planning with understandable degraded states. Verified correctness is high confidence within this declared season/window. Evidence does not establish a reliable undocumented live/non-playing raw-status mapping.

New service cash cost A$0. No additional provider call, browser poll, scheduler, database or owner routine. Actual development/check timing is retained in logs; no per-task token, dollar saving or long-term cost estimate is invented. Dependency: existing primary fixture identity, dated official notices and canonical publication/cache controls. Acceptance: exact identity/week/UTC match qualifies; mismatch remains approximate; original facts, OFF and activity survive; required gates and exact-SHA deployment pass before live status is claimed.

Act now because a real false-confirmation/reminder path was reproduced. Continue EPL acceptance with source-live/status semantics and actual viewing/rights/physical gates; review the next announced window once released through this existing queue. Do not certify the league on this timing repair. Target stays ≥13/16 families; 0/16 and0/3 Football pilots certified. Passwords/iCloud work remains parked; no new subscription, league or commercial launch.
