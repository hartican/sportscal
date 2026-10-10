# EPL live-source repair — 11 October 2026 Sydney

The existing Premier League source can report a genuine live match, but the adapter previously accepted only upcoming and completed records. One live record therefore caused the complete response to be rejected and older information to remain. This repair admits the evidenced live code through the existing canonical and live owners. It does not certify Football, add a provider or change the refresh schedule.

## Evidence and limits

One bounded read of page zero of the [existing primary endpoint](https://footballapi.pulselive.com/football/fixtures?comps=1&comp=1&compSeasons=841&page=0&pageSize=100&altIds=true) completed at **2026-10-10T13:23:13.778Z**: HTTP200,100 records, page0/4,380 declared total;50 completed C,49 upcoming U and one L. Fixture128973, Arsenal–Leeds, had raw status L, playing phase "2", source clock90+3 and integer goals2–1. Its kickoff remained2026-10-10T11:30Z, matchweek6, club identities1/9. These are historical captured facts, not a claim that the match remains live or its score remains2–1.

The [league's English labels](https://translations.premier-league-prod.pulselive.com/premierleague/en.js) returned HTTP200 at13:26:17.258Z, Last-Modified8October, and explicitly label L as Live Match, C as Full Time and U as Upcoming. This naturally observed record closes the actual L gap left by the [4October assessment](epl-status-source-assessment-2026-10-04.md). It is a partial-page review, not a fresh full-season truth reconciliation or independent agreement with the official on-screen score. The old numeric match-page URL returned404; the official season page returned200. Those limits remain recorded.

Phase2 is naturally observed. Phase1 admission is an inference from the same provider's numbered playing periods and completed goal-clock records, supported by controlled regression cases; a naturally observed first-half live packet remains unverified. Halftime, interruption, abandonment and other non-playing codes have not been assigned meanings. Missing, numeric or unknown phase values are rejected. No modern application's period labels are transplanted into this older field.

Source receipt collection and initial assessment ran13:21:31–13:31:04UTC, within ten minutes. Implementation, integration checks and release are separate work. The raw page and dictionary, response dates, hashes, previous failures and controlled test evidence are saved under `/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/epl-source-review-20261011`. Only the one necessary fixture and receipt metadata enter the regression fixture; the provider's full page and application code do not enter the app.

## Behaviour and acceptance

- Keep existing C/U admission. Accept L only with a recognised numbered playing period and two non-negative integer scores, through the same complete four-page validation.
- Preserve fixture IDs, participants, rounds, kickoffs and viewing information. Add genuine status/score observation dates and official provenance; a live score creates no final result, recap or replay promise.
- Unknown phases, incomplete scores and malformed responses retain the last-good snapshot and dated exceptions. The free delayed backup remains final-only. A validated primary completion advances the same fixture; older live responses cannot reopen it.
- Keep the existing source page deadlines, request count, owner, source budgets, stale-state handling and Results choices. Unchanged live checks retain the same fact hash rather than creating clock-only revisions.
- Controlled tests exercise the real source reader, live adapter and persistent file writer: complete380-record responses, zero live scores, invalid scores/periods, unchanged reruns, last-good preservation, primary completion and final continuity. This controlled380-record test is separate from the partial real observation.
- Twenty-four local cases per browser engine replay the captured source row at its original date and31minutes later through compact Feed, expanded Feed and Schedule,320/390widths and day/night themes. The current compact layout retains visible schedule and accessible status; expanded/Schedule cards show the visible status. ResultsOFF hides the captured score. These are anonymous browser rehearsals, not actual live-play, authenticated acceptance or physical-phone proof.

No cached browser asset changes are needed for this source-only module. Existing shell/cache bytes remain unchanged; the normal release gates and exact production proof remain required. The separate score workstream's shell477 and scheduler repair are preserved rather than duplicated. Implementation and local checks alone are not a production delivery receipt.

## Recommended next work

| Recommendation | Business value and evidence | Effort, dependency and cash | Owner impact and acceptance |
| --- | --- | --- | --- |
| Publish this scoped source repair | Official in-play results can reach the existing app instead of one L row rejecting the whole collection | Small source/test change; existing primary and complete-response validation. A$0 new cash commitment | No new routine. Require passing source/persistence/browser controls and normal exact published/live release proof |
| Observe remaining real playing/non-playing states through the current owner | Avoid mislabelling breaks or unavailable scores | Reuse naturally occurring primary receipts; no extra polling or new source | No added decision. Keep missing/unknown states visibly degraded until separately verified |
| Finish the existing Football pilots | Trustworthy matches and viewing information support repeat use and later sponsorship | Current acceptance queue; actual phone, playback and commercial permissions remain dependencies | Full count remains0/3Football pilots and0/17families,target≥14/17. A green release and this single match do not certify a sport |

Existing assistant and hosting costs remain unpriced. The next ordinary scheduled publication and actual source recovery need their own dated evidence. No database migration, customer write, reminder replay, purchase, new competition or new owner is introduced by this module.
