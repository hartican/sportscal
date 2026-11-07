# Scheduled refresh recovery — 5 October 2026

## Outcome and release boundary

The ordinary canonical refresh failed because the already carried NRL Grand Final and WRC Sardegna rally had no completed result. Their existing official sources now supply validated finals through the same full/daily owner. App **c05edced / shell 438** is independently live after [normal release 37236456410](https://github.com/hartican/sportscal/actions/runs/37236456410): 147 local/cloud gates, READY/project/exact SHA, all three aliases, twenty served hashes and 204 hosted component cases pass. Immutable deployment: `sportscal-pjcn97lpu-harticans-projects.vercel.app` (`dpl_6bBspYsSf3HwgfXMVMdmRx7euied`). No claim of unattended recovery is made before the next ordinary run.

Users can reveal the named 19–18 NRL final and the FIA winning crew/time for Sardegna. Results OFF, per-event reveal and strict mode remain authoritative. Fractional rally times and winning crew identities survive the shared copy/score formatters. WRC tables retain original points/ranks/date and visibly say they have not been rechecked after Round 13. Existing fixture actions, schedule dates and viewing destinations are preserved.

## Verified cause and dated inputs

[Ordinary run 37226546768](https://github.com/hartican/sportscal/actions/runs/37226546768) ran from aa88e611 and failed at 2026-10-04T19:01:39Z. Its completeness report named only evt_84 and event-wrc-2026-round-13. A real two-record CLI replay reproduces the failure; no gate or due deadline is relaxed.

| Input | Dated evidence | Accepted facts and limits |
| --- | --- | --- |
| Existing ChampionData NRL collection | HTTP 200, 4 October 20:15 UTC; 204 matches, rounds 1–27 | This collection omits finals. It cannot establish an unknown final score. |
| [Official NRL match centre](https://www.nrl.com/draw/nrl-premiership/2026/grand-final/game-1/) | First local capture 20:15:20.588Z; genuinely persisted observation 20:40:59.577Z | Match 20261113110; Post/FullTime; ordered Roosters/Knights; original 08:30Z kickoff; 19–18. Provider update 13:50:31Z. Schedule source/date remain separate. |
| [Existing FIA Sardegna classification](https://www.fia.com/events/world-rally-championship/season-2026/rally-ditalia/classifications) | First capture 20:15:24.039Z; persisted observation 20:41:03.188Z | Own canonical URL, printed 1–4 October dates, FINAL OFFICIAL CLASSIFICATION and explicit first place. Oliver Solberg / Elliott Edmondson, Toyota GR Yaris Rally1, 3:24:57.0. Rally winner does not infer season champion. |

Later genuine checks at 20:51:39.422Z and 20:51:43.056Z agree and do not advance unchanged fact dates. These checks also verify projection recovery through the corrected canonical route. The source trial, canonical persistence, local tests, publication, deployment and ordinary operation are separate evidence layers.

## Implementation and operating cost

- `scripts/lib/known-final-results.js` validates exact retained IDs/participants/kickoff, complete responses, explicit final phase, integer scores including zero, FIA winning position/date/registered crew and genuine observations. Unknown, ambiguous, incomplete, stale or conflicting inputs fail closed. Corrections require newer evidence. Projection cannot overwrite an equal/newer conflicting card.
- Full refresh adds the one known NRL resource; WRC keeps its existing official classification owner, now admitting explicit same-day finals and retaining unchanged result dates. Quick refresh checks at most two resources, sequentially, with fifteen-second deadlines and no retries, within the existing current/recent fourteen-day correction window. Outside that window it makes zero known-final source calls. No new competition, provider, scheduler, browser poll, credential, purchase or database change.
- The scoped quick route updates each existing surface independently and reuses retained Feed publication. It does not regenerate unrelated editorial or normalize incoming IDs. Mandatory completeness still runs; whole-run rollback retains last-good data and records the blocked candidate outside the data transaction.
- Existing exception artifacts/readout expose actual source checks, failures, unchanged facts and blocked publication. Missing/out-of-window evidence is unknown, not healthy. No extra owner routine or monitoring service.
- Shared result/copy formatters preserve WRC crew identity and decimal precision. Duplicate comparison reuses word sets. The generated network bundle omits its nonfunctional generator comment, retaining the build script as owner. Shell438 changes only the runtime cache ownership; unchanged deferred assets keep their versions. Eight startup requests and the fixed 1.25% compressed-byte gate remain.

## Verification and preservation

Actual source-to-ledger persistence, unchanged byte replay, zero scores, identity/phase/date/partial/outage rejection, genuine corrections, stale/equal contradictory observations, exact unrelated card retention and actual owner rollback/diagnostic cases pass. The existing real canonical command passes completeness for the originally due set using later observed results; it does not backdate source checks. WRC full-context projection admits its explicitly observed same-day final and preserves its separate observation.

Local Chromium/WebKit checks pass 204 actual mounted Feed/Schedule/standings cases across 320/390/1280 widths, day/night and global/local/strict Results settings. Both actual 437→438 kept-open/offline/resume browser upgrade rehearsals pass. These are supporting browser simulations, not physical Home Screen, account, playback or push proof. All 147 final local gates pass in 141871 ms with an unchanged tracked-input fingerprint; the same normal cloud gate block completes successfully. READY belongs to project `prj_NAMl47QVLbPUfsMmap59JIpchOPD`; releaseGitSha and main agree at verification. All twenty served hashes match the transformed immutable inventory. Of 1432 public artifacts, 63 changed, 1369 are byte-identical and none are removed. The built-public boundary retains all six function sources and excludes the same three private inputs. All 204 hosted browser cases also pass; no production outage is induced. Startup remains eight requests and 430904 compressed bytes against the unchanged 425600-byte baseline and 1.25% cap.

All 1,503 incoming and 1,504 published fixture IDs survive. Exactly two cards change; all unrelated card fields, Football finals and original observations remain exact. All existing NRL/WRC Code/Schedule IDs, participants, sporting times, viewing destinations and unrelated fixtures survive; other NRL results and all three WRC tables' points/ranks/original dates remain. Root Feed publication timestamps and derived manifests/pages change for publication; these are not fact-freshness claims.

## Business decision, cost and remaining work

Advance this repair now: an omitted final should not block useful updates across every sport. Evidence is the ordinary job failure and current official finals. Effort is one bounded ingestion/projection/formatting module, depending on the existing owners, known retained identities, normal gates and exact deployment proof. Added cash cost is $0; public resource calls increase by at most two per daily quick run in the existing correction window (full adds one NRL request). Owner-time impact is no recurring decision or task. Acceptance requires exact preservation, source-backed Results privacy, honest stale tables, passing normal gates and independently verified production; unattended success requires the next ordinary owner run.

The first candidate was rejected locally after it changed unrelated editorial and normalized three incoming Cricket IDs. Owned generated files were restored; validated source ledgers were kept. The corrected retained projector preserves those identities/copy. Two new browser failures exposed genuine WRC formatter defects and were repaired. A private harness initially looked for a deferred panel URL in the worker rather than the HTML, and initially assumed NRL scores used a dash; those observer assumptions were corrected against the actual shipped URLs and named-score renderer. The first normal gate run also exposed an owner-cleanup test combining its historical October 2 clock with the now-completed October 4 final. The test catalogue is frozen at that as-of, retaining the exact expiry count and protected-history/future-schedule assertions; no production cleanup or expiry behaviour changes. All initial diagnostics are retained.

Formal cross-sport acceptance remains **0/16 families and 0/3 Football pilots**, target at least **13/16**. Source agreement and these repairs are not commercial permissions, full-family certification, actual viewing playback, physical-device acceptance or repeat-use evidence. Continue the existing Football pilots and bounded carried-sport acceptance; observe the ordinary owner. Recovery input retries remain parked; invitations, outreach, purchases and subscriptions remain unauthorised. Do not launch monetisation from this scoped result repair.

Evidence folder: `/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/canonical-schedule-recovery-20261005`.

## Closeout boundary

The app snapshot above was published and deployed before this documentation-only closeout. The following queue/checkpoint/evidence edits contain no app-input change and do not need another deployment. Full/quick wiring and scoped source integration are verified; successful ordinary unattended publication remains pending its next naturally scheduled run. No new scheduler or manual canonical run was dispatched to manufacture that proof.
