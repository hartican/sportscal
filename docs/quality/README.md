# Competition quality contract

The frozen 27 September inventory groups 30 Codes into 21 non-overlapping sport families. Sixteen families carry fixtures, including skiing's four published cards despite its empty Inspector projection. Five empty catalogue-only families remain visible but are not represented as working coverage. Motorsport and its child series, Football and UCL, and basketball and its subcompetitions are counted once per family. Current 80% target: **13 of 16 carried families**, without removing weak families to improve the score.

Run `node scripts/audit-coverage-quality.js /path/to/coverage-quality.json`. This reads local published artifacts only; it neither refreshes sources nor writes runtime data. Every production workflow saves the resulting report with release evidence. `node scripts/validate-coverage-quality.js` verifies denominator and anti-false-pass rules. New Codes or newly populated inactive families require an explicit inventory review.

The output lists every projected competition, retains unclassified records, and adds missing pilot competitions. Exact IDs deduplicate overlapping Code views; this is not cross-provider alias reconciliation. Counts, source-link presence and structured participant presence are diagnostic signals only. They do not prove source truth, working destinations or sport-appropriate completeness. Individual/multi-entry sports need their own identity acceptance.

A certification must cover the declared window, every required gate, dated live evidence and a released SHA. Required gates are fixture truth, timing/results, Australian viewing, context/editorial, presentation/behaviour, and operations/rights. Store specific evidence references for each. Unknown or absent evidence means unverified; a release or green test alone is insufficient. Inspect supporting evidence before adding any certification.

NRL and AFL remain reference candidates, not assumed perfect. Current pilot requirement is EPL, UCL and Europa League; all three must pass before new invitations. No family or pilot competition is currently fully certified. The original 90-day audit and `docs/cto-delivery-plan.md` retain the wider scope, including recovery, operational costs, owner-time reduction and useful-return measurement.

## Reference cases still to prove

- NRL/AFL: exact final scores, provisional finals starts, no race/stage vocabulary, source-backed Australian viewing and spoiler behavior.
- EPL: all 380 matches independently reconciled; matchweeks/table; promoted-club identity; postponed kickoff retaining actions; UK/Sydney DST; compact and expanded mobile presentation; provider outage.
- Socceroos: fixture-specific free versus paid viewing survives Feed/Follow merges.
- UCL/Europa: actual published contests versus unresolved brackets, stable cross-league club identities, permitted sustainable source, explicit degraded state.
- Every qualifying family: 320/390/768/1280 widths, day/night, accessible controls, back navigation, exclusions, stale-source handling and evidence of live release.

## Reference repair: 27 September NRL Grand Final

Accor Stadium's official programme confirms Roosters–Knights on 4 October at 19:30 Sydney (08:30 UTC, after the DST transition). Nine's finals announcement confirms exclusive live coverage on Nine/9Now. The reviewed finals input now resolves the existing `evt_84` identity rather than creating a second final. Canonical phase sync preserves reviewed participants and follows the alias when applying current editorial. Regression: `validate-nrl-grand-final.js --published`; browser: `validate-grand-final-browser.js`. This named-case repair is not NRL family certification.

Sources: https://www.accorstadium.com.au/events/n2026_nrl_nrlw_grand_finals and https://www.nineforbrands.com.au/media-release/nine-kicks-off-blockbuster-2026-nrl-footy-finals-series/ .

## NRLW reference follow-up: 28 September Sydney

The same official Accor programme confirms Roosters–Broncos at 16:00 Sydney on 4 October (05:00 UTC; 15:00 Queensland). The canonical input now resolves the existing final, and dated research replaces stale unresolved-bracket copy. Confirmed requested-sport cards explicitly clear a previously published TBC flag. NRLW joins the shared matchup renderer, retaining sourced IDs for profile links; its directory still lacks verified club artwork, so visible monograms remain. This is an explicit remaining polish gap, not full certification. `validate-requested-sports.js` covers both published feeds and Schedule; `validate-grand-final-browser.js` covers both finals at four widths.

## Retained Champions League qualifiers — 28 September 2026

Seven August second-leg qualifiers had no canonical status/result fields and consequently projected as upcoming. Their inherited parent synopsis also disclosed other matches' outcomes with Results off. UEFA's published qualifying-results article was checked again on 28 September Sydney; all seven now retain their existing IDs with completed status, match scores, explicit extra-time context where applicable, aggregate scores and dated result provenance. Match-specific protected copy replaces the inherited recap. No kickoff time was inferred or changed; this repair does not certify the season or prove commercial reuse permission.

Source: https://www.uefa.com/uefachampionsleague/news/02a6-20e5a8be4e63-ae971c582f8c-1000--champions-league-qualifying-results-how-it-worked/ . Regression: `validate-ucl-qualifier-results.js` covers canonical, Inspector and lightweight Schedule projections; `validate-european-football-browser.js` checks Results off/on for all seven retained fixtures. Canonical projection rebuild adds no recurring network request or subscription.

## NBL viewing remediation — 28 September 2026

Review found 165 official regular-season fixtures but no projected fixture viewing options, although the schedule labels 40 records with 9Now (39 `9Now`, one `9Go 9Now`). The earlier season announcement mentions 39 Nine games. Retain the more specific current fixture labels with their check time; do not manufacture a fixed season count or grant free coverage from day-of-week inference. The loader now captures these existing response fields, the shared card projection carries them, and quick refresh detects viewing-only changes without timestamp-only churn. Disney+ now has a real provider destination; Kayo/Foxtel remain alternatives where ESPN is listed.

Sources: https://schedule.nbl.com.au/nbl and https://www.nbl.com.au/news/how-to-watch-the-hungry-jacks-nbl27-season . This is a viewing repair, not NBL family certification; missing standings and broader presentation/result/rights review remain open. No added source fetch, cron, AI call or subscription is required by the change. Deployment evidence is recorded separately.
