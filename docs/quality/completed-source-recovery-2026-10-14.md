# Golf and Bathurst update repair — 14 October 2026

The two completed events were generating repeat update failures. Golf was selecting old tee-time groups as though each were a tournament leaderboard. Bathurst was still requesting its timetable after a complete official result was already published. The scoped repair keeps the confirmed results and stops those unnecessary requests. No new subscription or owner routine is needed.

## Scope and acceptance

The repair follows the CTO operational-trust priority and the existing backend limits. Keep the existing live owners, deadlines, leases, two workers, forty-five-second pass and backoff. Change only the two sport adapters and their required regression. No extra source, scheduler, migration, user write, notification replay or browser polling.

- Only a Golf tournament parent can select a tournament leaderboard or drive its playing cadence. Existing tee-time appearances remain unchanged; neither elapsed time nor a completed parent invents their individual outcomes. An active parent retains its ordinary single four-second request.
- Bathurst stops timetable/tower collection only for the complete reviewed official classification, with a receipt already observed by this pass. Ignore raw tower score fields for this qualification. Provisional, malformed, mismatched, future and unconfirmed states retain the ordinary collection/failure path.
- Both completed cases return their original retained collection. Keep all original IDs, aliases, core facts, scores, observation dates, completion markers and source revisions. The normal successful fenced publisher clears failures; no manual database repair or counter reset.
- Add the regression to existing canonical QA and normal release gates. Publish/deploy the exact scoped passing snapshot and verify public behaviour. Check the next ordinary owner's source health separately, without forcing a refresh.

## Evidence and current status

Read-only capture on 13 October UTC found Golf failureCount95 and Bathurst107, with last successful observations on11October. Both parents were already completed. Golf retained four `golf_appearance` children with no tournament season/field metadata; the Bathurst publication contains the validated twenty-six-entry official classification. The actual two-source replay makes one rejected provider call in each case before repair, and zero after it.

The regression uses the captured source/current/score graph, including an older retained race alias. It exercises the actual fenced claim and compact SQL publisher, rather than replacing persistence with a mock. Two successful quiet passes must preserve original score bytes/dates/completion, score row identities, all lookup aliases/core facts, payloads and revisions. Active Golf and six unconfirmed/invalid Bathurst cases retain their ordinary calls; a valid result receipt cannot suppress a pass before its observation. All source responses in these checks are captured or labelled controlled cases; no provider or production write occurs.

Earlier local harness attempts had incomplete snapshot seeding (required hash, current-record foreign key and the legacy alias graph). Those failures are retained separately; they are not production defects or successful tests. Completing the actual captured graph is part of the persistence proof, not a reduced acceptance rule.

Exact app `be0c35e25290af12bc98c0fa9b5999ed49e5ac42` is live on unchanged shell 527. [Normal release 38410348994](https://github.com/hartican/sportscal/actions/runs/38410348994) passed all 195 safety commands and public release checks; READY `dpl_31DAdXCR7dq8xxYgWrL4fGWCnuiE`, production target, three assigned names and sealed served files agree. The existing automatic owner recovered Golf at13 October 14:20 UTC and Bathurst at14:30 UTC, both with zero failures. The14:31 read-only comparison preserves all 16 current/result records, including the older race alias, original sporting dates/completion, source payloads/hashes and sporting revisions exactly. Normal check dates and next-due times advance; sporting facts do not. No cache/shell bytes or presentation are changed. This repair does not certify Golf, Supercars, physical phones, commercial permission or the full MVP.

Detailed evidence: `/Users/jackhartican/Documents/AI/Codex/completed-source-recovery-2026-10-13`, including original public captures, the red/green replay and complete persistence regression. Cash: no new service commitment; model/runner costs remain unpriced. Owner impact: fewer false failures and no added recurring task.


## Review and sampling limits

Independent Spec review found 0 findings for the exact candidate, including actual persistence and canonical/release wiring. Standards found 0 actionable issues in the inspected source/document/production-gate hunks. Its output truncated the test body/canonical addition; the separate follow-up failed because the selected review service was at capacity. No complete eight-file Standards certificate is claimed. The parent inspected the remaining code and the unchanged required 195-command release passed; no gate or assertion was waived. Captured JSON was sampled rather than exhaustively revalidated. Zero provider reads are proved in local captured and actual-catalogue replays; successful natural production checks are verified separately, without claiming an independent production request count. Public selected reads retain all three parent/legacy lookup identities. Existing browser/cache proof is reused because those exact bytes are unchanged; physical-device and whole-sport approval remain open.
