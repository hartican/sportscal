# Ice-hockey results and programme integrity — 4 October 2026

Status: locally implemented; normal release and production verification pending. This closes concrete CHL score, ranking and programme-precision defects, plus hockey score presentation and an NHL final-parser guard. Full six-gate certification remains 0/16 carried families and 0/3 Football pilots; target at least 13/16.

## User outcome and architectural boundary

The official CHL response already contains 48 paired finals; the old importer omitted them. The shared full/quick facts boundary now retains valid zero scores, explicit final status and supplied overtime/shootout qualifiers. Schedule cards display scores in their displayed participant order. The same projection repair corrects 99 retained NHL finals without changing any NHL source fact or claiming fresh whole-league truth. An actual NHL 0–6 final and controlled null/empty/invalid variants guard against manufacturing zero from absent input.

The existing team-statistics feed supplies club records without competition ranks. CHL views now show played/wins/losses/goals for/against, source and observation date, with unavailable position/qualification explicitly stated. No points or UEFA-style inference. Result-disagreeing records show stale status. Schedule standings remain under Results consent; profile-local reveals keep global Results OFF.

Twelve existing future knockout records contain two publisher TBA IDs, an unconfirmed 11:59 UTC timestamp and placeholder 0–0. Preserve programme IDs and that timestamp as source provenance, but publish calendar notes with unknown participants and kickoff. They have no fixture Add to Feed/reminder actions and count as calendar context, not twelve playable matches. The 72 actual CHL match records keep their identities, participant roles, rounds, clocks and old viewing evidence. The IIHF.TV general destination is unchanged; this repair does not prove Australian entitlement or playback.

The existing `update-cards.js` full and daily quick owners reuse one pure CHL parser/writer below orchestration. Complete known-club/six-round collection, identity, timestamp, explicit status and paired-score validation precedes persistence. Missing/duplicate/unknown records, partial/failed responses, future finals and stale contradictory changes retain last-good data. Unchanged checks preserve actual fact dates. The quick readout records current attempts and actionable failures. An unchanged source check also detects and repairs interrupted/stale Inspector or Schedule projections through the same steps, without another source request or a fact-date change; five controlled publication failures and actual persisted parity guard this boundary.

## Evidence

| Check | Result | Scope |
|---|---|---|
| Actual official schedule resource, 11:45:16.502 UTC | 84 identities, 72 match records, 12 programme dates; all 48 supplied finals retained | One reviewed 2026/27 collection; source explicitly marks finished |
| Actual official club-record resource, 11:45:16.793 UTC | 24 clubs; 120 GP/W/L/GF/GA totals agree with 48 finals | Separate resources from the same publisher, not independent publisher truth |
| Source to canonical | 780 compared match/calendar identity, role, timing, status, stage, score/provenance values agree | Dated official-response agreement |
| Initial canonical scoped owner, 11:45:16.795 UTC | Validated persistence through existing quick owner and scoped projection | No competing source path |
| Genuine unchanged owner, 11:55:33.294 UTC | Zero changes, original 11:45:16.795 UTC facts retained | Three source requests, no fact-clock churn |
| Regressions | Actual full/quick parser and persistence, 29 rejected controls; new final, zero, corrections, stale clocks, partial outages and unchanged bytes | Controlled failures supplement reduced real payloads |
| Preservation | All 1,493 raw fixture IDs, 1,409 NHL fixtures, teams, players and directory collection clock exact | No database/customer/action change |

Outputs and captured payloads: `/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/ice-hockey-quality-20261004`. `source-canonical-comparison.json`, `owner-source-receipts.jsonl`, `canonical-refresh.json`, `unchanged-rerun.json` and retained diagnostic failures separate source agreement from release proof.

## Cost, acceptance and limits

Business value: completed matches display usable, correctly associated results; users can compare sourced records and distinguish real matches from future programme dates. This reduces an accuracy/credibility risk for repeat use and sponsorship readiness. A$0 new subscriptions/services; quick adds three existing-endpoint requests per run with the existing fifteen-second deadlines/no retry. Full retains its existing twenty-second resources and roster requests. No new provider, scheduler, credential, database migration, browser poll, owner decision or recurring owner task.

Acceptance: affected published cards/table/profile and programme-note browser checks, every normal release gate, both genuine 429→430 browser cache rehearsals, exact published main SHA, READY/project/aliases, served artifacts and hosted rendering. Pending until those are observed. Token/runtime and rework accounting are aggregate observations, not attributed cash savings.

Remain explicit: NHL full-season fresh truth, actual live/non-playing provider contracts, broader Australian viewing/playback, commercial source/artwork reuse, ordinary unattended refresh, physical installed-device/push and cohort returns. This repair is not Ice Hockey or monetisable-MVP certification. Continue the existing Football/weak-window queue without adding a sport, provider, subscription or an owner-maintained tracker.
