# More dependable Wuhan updates — 9 October 2026

Wuhan’s upcoming tennis updates were being rejected because the source uses the tournament’s sponsored name. The fix accepts that verified name while keeping the checks that prevent wrong events and made-up matches.

This makes the existing update process ready to accept real Wuhan matches when their opponents are published. Today’s source contains 63 unassigned draw slots; none becomes a match card, live score or reminder. The existing Beijing source window still works. No new subscription, service or owner routine is added.

Release status: implemented locally and awaiting the normal production checks. This is not yet a production delivery receipt.

## Evidence and limits

Two existing public WTA resources were read once, with fifteen-second deadlines and no retries. The 9 October Beijing response parses as 93 known-player fixtures. The seven-days-ahead response identifies publisher edition 381-2026 as Dongfeng Voyah Wuhan Open, with 63 scheduled TBD contests. Before the fix, the actual parser and the new regression both reject that response with edition mismatch. Changing only the expected name in a diagnostic copy removes that error.

The [official WTA event page](https://www.wtatennis.com/tournaments/1075/x/2026) corroborates Wuhan’s name, city, WTA 1000 level and 12–18 October edition. The source correction uses the two exact names, original publisher ID, WTA tour, approved catalogue edition and women’s-singles draw. No automatic fuzzy matching or general sponsor-name stripping is introduced. New or conflicting names will still require evidence through the existing exception review.

The regression uses a reduced genuine edition/TBD receipt. That tests the actual name and unknown-opponent boundary; it is not a complete tournament dataset. The complete source responses are retained separately in this local output folder and replayed through the real parser: Beijing remains accepted, Wuhan reports all 63 unknown slots, and no Wuhan fixture is created. Their original response dates are preserved.

Three affected local checks pass: the existing tennis source/persistence suite, backend-budget suite and canonical exception-readout suite. The source suite also checks the actual four-resource owner, both accepted names, wrong names, wrong draw, another edition, partial responses, participant order, provisional times, unchanged final dates and outage retention. Full and quick continue through the existing canonical owner. No real refresh was run outside that owner; the independent observations and replay are read-only and write no production data.

The fix changes only the server-side name mapping and its existing tests/receipt. Browser shell, saved Feed data, source results, viewing destinations, participant/activity IDs and notification choices remain byte-identical to this module’s starting snapshot. No cached-shell upgrade is required by this change. The full required production gate remains mandatory; local passing tests do not prove deployment or a future ordinary source run.

## Recommended action

| Action | Business value and evidence | Effort and dependencies | Cash and owner time | Acceptance and reason |
| --- | --- | --- | --- | --- |
| Release the exact-name correction | Prevent a false source failure from blocking the approved upcoming Wuhan edition; genuine response reproduces the error | Small mapping/test change; existing canonical owner and normal release pipeline | A$0 new commitment; no new owner routine | Both real responses parse, TBD slots create no fixtures, protections pass, exact published release is READY and served; act now because the edition is approaching |
| Check the next ordinary update | Show new published opponents/results can flow without manual intervention | Existing scheduled owner and retained source report; no new scheduler or retry | No new subscription or standing decision | A real ordinary run reports the Wuhan source accurately and preserves usable prior facts on failure; a replay is insufficient |
| Keep broader coverage proof open | Avoid confusing a name fix with complete tennis or monetisable MVP readiness | Existing Football-first quality programme; official timing, viewing, rights and actual-device/cohort proof | Existing owner questions only; no new outreach | Whole-sport and competition gates remain explicit; this repair supplies no certification credit |

The related live-information service repair is separate. A read-only public observation during this work returned fresh:true equivalent flags: fixtures stale:false and Everything membershipStale:false with 17 fixtures. Its five-second fixture response includes network and body-transfer time and is not a database benchmark. That observation does not prove its final app release, ordinary operation, every source’s accuracy or freshness after caching. The separate repair’s exact release is checked before this module is published.

No purchase, credential, provider, competition, browser poll, API, migration, customer write, reminder replay or outreach was added by this module. Assistant investigation cost is not represented by the sports refresh’s AI-call counter. Full programme proof remains 0/16 families and 0/3 Football pilots, with the agreed destination of at least 13/16 families.

Evidence files: source-observations.json, retained WTA responses, source-replay.json, regression-red.log, regression-green-final.log, backend-gate-final.log, source-readout-gate-final.log, reviewed-inputs.json, public-service-observation.json and subsequent release/closeout receipts.
