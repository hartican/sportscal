# Champions League programme calendars and navigation — 3 October 2026

Champions League’s existing Schedule now opens its own competition, and the five knockout programme cards show reviewed stage dates in chronological order. Users can plan ahead without those broad calendar windows pretending to be confirmed Australian match kickoffs. All 156 UCL IDs survive; the other 151 UCL records and every other published sporting dataset are unchanged relative to the combined Dakar baseline. Full certification remains **0/16 carried families and 0/3 Football pilots**, against the required minimum 13/16 families.

## Verified defects and bounded repair

The canonical records already carried UEFA’s individual stage descriptions, but each scheduling window incorrectly spanned the entire February–June knockout period. The Inspector projection dropped the useful date description, leaving the actual cards undated. A regression against the real builder failed before repair. Actual browser navigation then exposed a separate missing selector alias: choosing Champions League opened the parent Football Code. Both forward and direct-link aliases now resolve its own existing Code; a missing child Code fails visibly instead of showing its parent’s different calendar.

The five records keep their unconfirmed participants, null UTC kickoffs and unknown Sydney match dates. Separately dated timing provenance carries the calendar review. Original fixture source, editorial and result clocks remain intact. Schedule ordering uses each planning window without synthesising a match date. An explicitly confirmed exact UTC start takes over the Sydney date display through the shared normalizer only when neither supported TBC flag contradicts confirmation. The final explicit `startTimeTbc` regression reproduces a missing planning label against the first published repair and passes after its guard is tightened. The controlled midnight-crossing test is an artificial regression input, not a future final kickoff announcement.

| Existing programme | Reviewed organiser dates in 2027 | Published planning window |
| --- | --- | --- |
| Knockout play-offs | 16/17 and 23/24 February | 16–24 February |
| Round of 16 | 9/10 and 16/17 March | 9–17 March |
| Quarter-finals | 6/7 and 13/14 April | 6–14 April |
| Semi-finals | 27/28 April and 4/5 May | 27 April–5 May |
| Final | Saturday 5 June | 5 June |

The displayed labels explicitly identify Madrid calendar dates. They do not establish the eventual Sydney date or kickoff. Dates are subject to organiser changes. [UEFA’s 2026/27 calendar overview](https://www.uefa.com/uefachampionsleague/news/02a6-20d57cfcd03e-407c22a7f465-1000--2026-27-champions-league-teams-dates-draws-format-final/) supports these windows; the final is at Madrid’s Estadio Metropolitano. This evidence neither supplies individual knockout fixtures nor certifies redistribution permission.

## Architecture and operating impact

The existing `scripts/update-cards.js --code-projections --codes=champions-league` path remains the projection owner. It consumes saved canonical records and now checks actual UCL persistence. The regression is also in the normal serialized production workflow. No provider fetch, scheduler, polling path, migration, new subscription or owner routine is added. The generated runtime, versioned deferred Schedule module and service-worker cache epoch are released together; the calendar release uses shell 395 and its explicit-TBC guard closeout advances to shell 396.

Dakar was independently published while this module was being checked. Its first normal release stopped on an outdated exact Motorsport-child assertion; the author corrected the contract and new-follow defaults in `d9d5b7a1`, then successfully released shell 394. Both those changes are preserved as this module’s baseline. They are not attributed to this UCL repair, and no duplicate Dakar deployment was dispatched.

## Verification and practical limits

| Check | Evidence and result |
| --- | --- |
| Canonical persistence | Scoped canonical invocation succeeds with no additional generated changes or source refresh |
| Sporting preservation | Same 156 IDs, only five planning records differ; other 151 UCL records and all other tracked sporting data are identical to `d9d5b7a1` |
| Release contracts | Combined calendar snapshot: all 134 normal local contract commands pass in 139.5 seconds. The final guard passes its affected local checks and all 134 normal cloud contracts; Follow decision contract also passes |
| Actual browser navigation | 32 Chromium/WebKit cases cover four widths, both themes and compact/expanded cards; 160 stage-card checks, no fixture injection |
| Honesty and personal state | No Live/Starts Soon/Just Finished or Add-to-Feed pin appears for calendar-only records; browsing preserves follows, Results and settings |
| Startup/cache | Three critical scripts and four styles match exact install URLs; 127 assets, 2.99 MB initial precache, unchanged budget |
| Kept-open upgrades | Both engines pass actual historical 392→395 and 394→395 paths. The final 395→396 rehearsals pass both engines and additionally check explicit TBC preservation online and offline. Saved follows/preferences/draft, optional/required asset failure, offline and resume are tested |
| Scope of device evidence | Isolated browser profiles and public data; not physical iPhone Home Screen, authenticated owner workflow, reminder delivery or independent recovery |

Retained failures matter. One combined WebKit 392→395 run exceeded the existing migration reload limit; the unchanged isolated repeat and both latest-live upgrade rehearsals pass without relaxing any assertion. Its intermittent cause is unresolved, so this does not prove reload behaviour flawless. An earlier Chromium run timed out during initial baseline navigation. Initial browser harness errors and the original real selector-routing failure are preserved separately. The local contract wrapper initially placed its audit output under a literal environment-variable directory; the output was moved into the evidence folder and the audit rerun at the correct explicit path. No failed check is relabelled as a pass.

## Recommended course, value and cost

| Recommendation | Business value and evidence | Effort, dependencies and cash | Owner impact and acceptance |
| --- | --- | --- | --- |
| Ship this bounded repair | Removes a verified navigation dead end and exposes already published planning dates; supports useful repeat visits | One focused engineering module; existing canonical/Code/Follow infrastructure; A$0 new purchases, marginal compute cost unmeasured | No new routine decisions; accept only exact published SHA, READY/alias/hash proof and actual live 32-case rendering |
| Close the Football viewing/window acceptance gaps next | Accurate Australian destinations and understandable degraded states determine whether these cards help someone watch a match | Bounded official-source-to-screen review using the three existing pilots; no new competition or paid provider unless evidence justifies it | Escalate only material scope/spend/rights decisions; measured six-gate evidence must agree, with individual gaps retained |
| Defer inferred knockout matchups and complete final-order inputs | Calendar windows cannot supply teams, live results or missing decisive ranking values | Wait for published fixtures and validated complete coefficient/discipline inputs and permitted access | No manual rankings; final ties stay Pending and no whole-sport certification is claimed |

Token, runtime and rework savings attributable to this repair are unmeasured. It removes a manual calendar correction/navigation failure without adding administration. Apple Passwords/export work remains parked under the instruction to carry on with other tasks. The 90-day repeat-use programme, physical-device checks, independent recovery and commercial acceptance remain open.

## Publication and evidence

Calendar/navigation source was first published and verified live as `5990a001b93b93997cc7be401506450102e60000`, shell 395, with [normal release 37078733704](https://github.com/hartican/sportscal/actions/runs/37078733704). Final explicit-TBC source is published on main as `f165006c620c06a58db36f607d7cb911dee44081`, shell 396. Its [normal release 37079486840](https://github.com/hartican/sportscal/actions/runs/37079486840) succeeds, including all release contracts and the credentialed shared-fixture read. The live production target is READY `dpl_ZDHRPj92gb86VZY3E1NaQYh9cZs9`, immutable `sportscal-3f86ekd3o-harticans-projects.vercel.app`. Independent project/target/deployment `releaseGitSha`, all three direct alias bindings and nine served hashes match the published snapshot. Runtime uses `?v=396`; the unchanged deferred Schedule module correctly retains `?v=395`. All 32 final live Chromium/WebKit width/theme/state observations pass real Schedule navigation and all five cards. API reads are deliberately failed closed in the browser profile; no account/provider mutation is performed.

[Structured verification and limits](https://github.com/hartican/sportscal/blob/main/docs/quality/ucl-stage-calendar-integrity-2026-10-03.md) are recorded with the current delivery queue. Exact proof files: [independent release](/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/ucl-stage-calendar-final-release-20261003/independent-current-proof.json), [actual live card cases](/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/ucl-stage-calendar-final-production-20261003/browser-report.json), [sporting preservation](/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/ucl-stage-calendar-final-preservation-20261003.json) and [verification summary](/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/ucl-stage-calendar-verification-20261003.json).

Evidence is saved under `/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27`: original red regression and routing failure logs, baseline and combined preservation JSON, canonical log, 134-contract result JSON, 32-case browser observations, retained failed upgrade logs and the passing current upgrade logs. Publication and live verification are complete within the scope above. The actual final-release package inventory is 158,608,502 bytes across 1,248 files against its existing 94,300,000-byte accepted baseline. Its largest group is `assets/marquee` (24,800,768 bytes); three separate Code/Schedule/canonical groups each exceed 14 MB. This is a measured release-package exception, separate from the passing initial-shell budget. No budget was raised or package behaviour changed. Reuse this inventory for a later bounded optimisation; user latency, marginal cash cost and safe removals remain unverified.
