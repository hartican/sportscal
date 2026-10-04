# EPL primary status evidence — 4 October 2026

**Recommendation:** keep the present reviewed C/U adapter and honest awaiting-update presentation. First-party status labels narrow the L/live question, but the collected evidence does not establish that field's current endpoint behaviour, score/clock semantics or non-playing codes. No runtime mapping, provider switch, polling or scheduler change is warranted by this pass.

## Verified observations

One bounded successful read of page zero of the [existing primary fixture endpoint](https://footballapi.pulselive.com/football/fixtures?comps=1&comp=1&compSeasons=841&page=0&pageSize=100&altIds=true) completed at **06:11:58 UTC**: HTTP 200, 100 records, page metadata 0/4 and 380 total. Its observed statuses are 50 C and 50 U. This is a partial page, not another complete 380-fixture verification. The [3 October full-season check](epl-live-source-checkpoint-2026-10-03.md) remains separately dated.

The [official match page](https://www.premierleague.com/en/matches/premier-league/2026-27) returned HTTP 200 with the browser user agent at 06:18:13 UTC. Its exact script references include the [official English translation resource](https://translations.premier-league-prod.pulselive.com/premierleague/en.js). That resource returned HTTP 200 at **06:19:21 UTC**, with Last-Modified 30 September. It explicitly maps `mc.status.L` to “Live Match”, `mc.status.U` to “Upcoming” and `mc.status.C` to “Full Time”. This is a verified first-party match-centre dictionary. It is stronger evidence than assigning meanings from memory.

The [official v1.54.14 application bundle](https://www.premierleague.com/resources/v1.54.14/scripts/bundle-es.min.js) instead contains modern period labels including PreMatch, HalfTime, FullTime, Postponed, Abandoned and Cancelled. Captured inspection found no literal link to the current `footballapi` fixture path, `fixture.status` or an `mc.status` consumption path. Absence in this bounded string inspection does not prove no relationship exists elsewhere.

## Inference and limits

It is plausible that the dictionary's L is the same provider status code as the existing C/U fixture field. The captured code/page does not prove that relationship, and no current same-primary L fixture was observed. Modern period labels cannot be transplanted into that older field. Actual live score freshness, halftime treatment, interruptions, postponements and cancellation codes remain unverified. Keep unknown statuses rejected and last-good data/degraded presentation intact until the source contract is established through the existing acceptance work.

The Python reader initially failed local certificate validation; verification was not disabled. A native official-page read returned an old cached HTTP 503 before the later browser-user-agent response. Source receipts, bodies and hashes retain both outcomes. A page-zero observation cannot certify complete source health or commercial permission.

The parent stopped the research agent before a finished note was supplied and completed this note from captured evidence. Source receipts span **06:11:27–06:19:21 UTC**, under eight minutes, but the overall agent investigation exceeded the requested 15-minute wall-clock pass before it was interrupted at 06:32 UTC. Do not describe the whole investigation as meeting that cap. No further source reads were made to finish this note.

## Acceptance, value and cost

This review replaces an unsupported-code assumption with specific official dictionary evidence and an explicit remaining contract gap. It prevents a speculative live-score promise or an unnecessary new source. There is no application/data/API/schema change, new service spend, commercial clearance, extra scheduler or owner routine. Actual model/engineering cash cost is unmeasured.

Use the ordinary existing source cadence and current Football acceptance queue for future real observations; no extra live probe or reminder is added. [Current EPL acceptance](epl-current-window-acceptance-2026-10-04.md) separately verifies the actual published cards and planning API. Full certification remains 0/3 Football pilots and 0/16 carried families, target at least 13/16.

Private captured evidence: `/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/epl-acceptance-20261004/`: `status-source-initial-observations.json`, `status-source-public-observations.json`, `official-code-observations.json`, `official-code-inspection.json`, `official-translations-observation.json`, and their saved public bodies. Raw provider scripts/pages are not added to the application or repository.
