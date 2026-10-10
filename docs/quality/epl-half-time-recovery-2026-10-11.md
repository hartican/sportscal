# Premier League half-time recovery — 11 October 2026 Sydney

A real half-time match was being rejected by the Premier League reader. One unsupported row could therefore hold back the whole league update. This module recognises that verified break and carries it through saved data and the app. It also fixes a visible error: the Feed could style a half-time score as a final result. Football approval remains incomplete.

## Actual evidence

One read of the [existing primary page](https://footballapi.pulselive.com/football/fixtures?comps=1&comp=1&compSeasons=841&page=0&pageSize=100&altIds=true) completed at **2026-10-10T17:22:09.905Z**. It declared100 rows on page0/4 and380 total:55 C,44 U and one L/H. Manchester United–Tottenham, fixture128981/Opta2645253, had two explicit integer zero scores, clubs12/21, matchweek6 and the existing16:30UTC kickoff. Its source clock was45+1; that clock does not establish the pause's meaning or a second-half restart time.

At **17:25:13.671Z**, the [league's rendered season page](https://www.premierleague.com/en/matches/premier-league/2026-27) showed HT and0–0 for the same ordered clubs. Its match link carried the matching Opta2645253 identity. The retained13:26:17.258Z official English dictionary explicitly maps `label.halfTime.short` to HT. Those signals support H as half-time; no modern period code, elapsed-time guess or provisional Fantasy result is substituted. Source collection and visible confirmation took under four minutes; one API page read, no polling/retry. The guessed old numeric detail URL could not be read; the existing season navigation supplied the verified link.

The original direct card call reproduced the unreviewed-phase rejection. Complete controlled380-row tests then exposed saved-data rejection of `break`, and the real browser builders exposed half-time styled as a final. Both product defects are corrected through existing boundaries. A separate selected-API test initially used an August synthetic row outside its October retention window; its controlled kickoff was aligned with the captured live example, without broadening retention. The Match Centre observer was corrected to inspect the status element because visible clocks are appended to that label. The cache observer initially searched only HTML for a module whose URL lives in the worker manifest; it now reads the actual current manifest and retains exact cached-byte comparisons. Initial failures are retained as rework evidence.

Raw page, response/hash metadata, browser observations, checks and release receipts are saved under `/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/epl-match-pause-20261011`. Only the necessary public fixture and dated receipt enter the regression fixtures. This is one actual match-state review, separate from the earlier full-season comparison and any commercial-use permission.

## Resulting behaviour and acceptance

- The existing reader accepts L/H only with valid two-sided integer scores. It emits `break` and `Half-time` with existing IDs, source clock/provenance and named participants. Canonical pause admission requires the exact EPL competition, season, identity, primary H evidence, valid source date and official URL. A normal production read showed UTC-offset dates; the same actual instant must survive that storage representation rather than requiring byte-identical date strings. The same production read also showed that unchanged metadata keeps its original fact evidence while a later compact status check has its own date. The final admission rule binds H evidence to that original canonical source observation, permits a later valid check and preserves both clocks. Timezone-free, future, mismatched origin or reversed dates remain rejected. Unknown codes, invalid scores and incomplete collections still fail and retain last-good data.
- A half-time score is ongoing, not a final result. No final copy, replay entitlement, completion timestamp, estimated restart or reminder is created. Results OFF hides the scores. Ordinary interruption handling stays unchanged.
- Routine half-time keeps the existing two-minute active cadence. After four minutes without a trustworthy observation, cards say an update is needed rather than keeping a fresh half-time claim. Accepted primary resumption clears the old label; later completion retains identity; older play/pause cannot reopen a final.
- Existing four-page limits, deadlines, source/check separation, unchanged fact hashes, delayed final-only backup, schedulers, leases, database rules, user actions and exclusions remain. No source polling, customer writes, schema change or purchase is added.
- The generated shell and affected deferred modules are versioned together at481. Required release checks, old480→481 cache/offline rehearsals and hosted controlled rendering must pass before claiming delivery.

## Verification and limits

The source, actual file writer, live-source publication and selected-fixture API checks cover complete controlled collections, all IDs, repeated unchanged runs, zero scores, stale/future/invalid observations, unsupported pauses, resumption and final continuity. These tests perform no provider or database writes. Local Football browser checks pass144 cases per engine across actual captured first-half, second-half and half-time records, compact/expanded Feed and Schedule, two widths, two themes, Results ON/OFF and old-source warnings. Match Centre additionally checks the separate paused label and zero scores.

Both480→481 cached-upgrade/offline rehearsals passed with the exact current score modules, genuine zero scores/source dates, awaiting-update labels and Results OFF. The existing13 delayed-backup tests and unchanged cadence/lease/revision gates passed. Local code/contract evidence does not prove deployment, physical iPhone behaviour, signed-in use, every interruption, all viewing destinations or commercial permission. The separate overnight canonical publication remains unproved; no new run was observed after its configured03:00Sydney slot. Production release and cached-upgrade receipts will be recorded below only after they pass.

## Recommended next actions

| Action | Business value and evidence | Effort and dependencies | Cash and owner time | Acceptance and decision |
| --- | --- | --- | --- | --- |
| Ship this half-time repair | Keeps league updates flowing through normal breaks; removes the observed false final styling | Small shared source/display change; existing owners, scoped tests and normal release | A$0 new commitment; no owner routine | Require passing cache/browser/release checks and exact published production proof. Act now on demonstrated defects |
| Prove ordinary overnight publication | Tables and the wider published catalogue need their own dependable update | Bounded inspection of the enabled existing workflow; cause of missing dispatch unconfirmed | No new purchase/routine | A successful actual scheduled run with its generated artifacts and exact deployment; a manual release is separate evidence |
| Finish existing Football pilots | Trustworthy viewing and phone use support repeat visits and sponsorship | Existing acceptance queue; actual phone/playback and permissions remain dependencies | Existing costs unpriced; owner answers already pending | Keep0/3 Football pilots and0/17 families until whole requirements pass; target≥14/17. Do not widen scope or certify from this single state |

Existing assistant and hosting costs remain unpriced. Runtime, test rework and token accounting are recorded separately and do not support a cash-saving or whole-goal completion estimate.

## Production receipt

Pending the normal release and final hosted checks.
