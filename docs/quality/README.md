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
