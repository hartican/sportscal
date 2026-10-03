# Viewing actions and replay evidence — 3 October 2026

The existing shared reader now keeps Watch actions aligned with explicit non-final match status, and preserves an unverified replay marker when provider metadata is read again. This fixes two reproduced defects on the Football acceptance path. It also removes incorrectly offered replay actions from 194 actual NFL records marked upcoming with 0–0 placeholders. Scores, fixture identities, source observation dates and viewing destinations remain intact. Certification remains **0/16 carried families and 0/3 Football pilots**, against the minimum 13/16 families.

## Verified defects and repair

A non-empty score previously overrode any explicit match state. A controlled live EPL record with 0–0 therefore acquired replay purpose. Separately, an actual completed EPL card correctly produced `replayVerified:false` on first read, then incorrectly produced true when those same dated general provider options were read again. The unchanged baseline source reproduces both failures; the new contract fails before the repair and passes afterwards.

The shared viewing resolver now respects explicit status; a partial or placeholder score cannot turn a live, upcoming or otherwise non-final record into a completed replay action. Legacy score-only records with no supplied status retain their existing result fallback. Re-reading normalized options cannot promote an explicit false, null or invalid replay marker. Existing dated replay/both evidence without the newer marker, and explicit true evidence with the existing source/date fields, remain usable. These positive inputs are controlled regression evidence, not actual playback verification.

The actual Inspector inventory contains 199 unique scored non-final records. Only 194 had replay-purpose provider actions; all 194 now have Watch purpose, and zero non-final provider actions retain replay purpose. The other five had no provider actions, so it would be incorrect to claim 199 viewing buttons were repaired. Action purpose alone does not establish a sporting-live state, specific provider entitlement or playback availability.

## Australian viewing evidence and limits

The three existing Australian Stan competition destinations load on 3 October: [Premier League](https://www.stan.com.au/watch/sport/football/premier-league), [Champions League](https://www.stan.com.au/watch/sport/football/uefa-champions-league) and [Europa League](https://www.stan.com.au/watch/sport/football/uefa-europa-league). No destination correction was necessary. Public replay categories and Premier League on-demand marketing do not prove any particular fixture’s authenticated full-match playback, availability date or direct permalink.

The separate 30 September viewing comparison covers 82 unique forthcoming listings: ten EPL MW6, 36 UCL MD2–3 and 36 Europa MD2–3. Its original date and programme-versus-kickoff method are retained; loading a destination today does not renew that fixture comparison. Existing provider contracts validate 668 EPL/UCL/Europa fixtures across both Football projections. Actual playback/replay and per-fixture links remain unverified.

## Architecture and operating impact

Canonical sporting facts, dated viewing evidence and the presentation action remain separate. The defect was in shared interpretation, so a small resolver repair is sufficient. No API, database or schema rewrite is warranted. The regression runs through the existing Australian-viewing gate already called by `scripts/update-cards.js` and the normal production workflow. No second source, scheduler, retry, browser credential, migration, subscription or owner routine is introduced.

The app runtime and cache epoch are released together. Independent Le Mans work reached main and production during this module; it is retained as the combined baseline, including its Follow and installed-browser assertions. Its sporting changes are not attributed to this repair. The final combined candidate uses shell 398, following that independently shipped shell 397.

## Verification and practical limits

| Check | Result and scope |
| --- | --- |
| Baseline reproduction | Actual completed EPL metadata changes unverified→verified on re-read; controlled live EPL score selects replay before the fix. New contract fails on baseline and passes on repaired reader |
| Sporting preservation | All 344 tracked sporting-data files and 5,736 unique Inspector IDs remain unchanged relative to independently published Le Mans `0d53875f`; actual source clocks, destinations and durable references survive |
| Shared/provider contracts | All 134 combined normal local commands pass in 150.345 seconds. New regression is in the existing viewing gate; all 668 Football fixtures retain destinations on both projections |
| Actual rendered controls | 170 combined local Chromium/WebKit observations pass across 320/390/1280 widths, both themes and Feed/Schedule. Actual forthcoming NFL and completed EPL/UCL/Europa cards are separate from labelled controlled live cases and real metadata round trips |
| Settings and link safety | Rendered actions keep href, new-tab security attributes, follows, provider preferences and Results; no horizontal overflow or browser page error |
| Installed/cache path | Both actual latest-live 397→398 kept-open upgrade rehearsals pass preferences/drafts, optional/required failures, offline/resume, prior module assertions and the new viewing-normalization checks |
| Startup | Three critical scripts and four styles have exact cached URLs; 127 assets, 2.99 MB initial precache, existing 3 MB budget unchanged |
| Publication and live rendering | Normal cloud release succeeds; independent READY/project/target/SHA, three direct alias bindings and ten served hashes agree. All 170 actual/controlled live-site browser observations pass within the declared scope |

The bounded ordinary-refresh follow-up still finds no later successful scheduled cycle. The latest dated parent [37064984687](https://github.com/hartican/sportscal/actions/runs/37064984687) stopped at its child's old Rugby raw/canonical-ID assertion, before deployment. Later published `5d3da132` corrects that assertion while retaining the provider key, canonical mapping and every reviewed alias; current normal local/cloud contracts pass. This is a recorded historical failure with a verified contract repair, not a newly observed failure of the current app. A later ordinary end-to-end success remains to be observed; no extra production refresh was dispatched. [Read-only follow-up evidence](/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/football-ordinary-refresh-follow-up-20261003.json).

The initial added PWA assertion reused an existing variable name and failed JavaScript parsing before the rehearsal ran. The binding was renamed; syntax and the unchanged assertions pass. This failed attempt remains in its own log and is not relabelled as a pass. Before main advanced, both engines passed the original 396→397 rehearsals. The final release uses the later combined checks. Browser tests use isolated public-data profiles, deliberately fail API calls closed and distinguish actual published fixtures from controlled live-status cases; they do not certify physical iPhone, authenticated owner edits, reminder delivery or provider playback.

## Recommended course, value and cost

| Recommendation | Value and evidence | Effort, dependencies and cash | Owner impact and acceptance |
| --- | --- | --- | --- |
| Ship this bounded repair | Removes reproduced wrong viewing actions and unsupported replay certainty; helps users choose an appropriate destination | One focused shared-reader module plus normal checks; existing provider contracts/runtime; A$0 new purchases, marginal compute unmeasured | No recurring decision or administration; accept only the passing published SHA, READY/alias/served proof, actual live controls and kept-open upgrades |
| Close the remaining Football source/window and playback gates | Viewing destinations alone cannot establish complete current fixture truth, trustworthy stale states or access to a specific replay | Retain the three pilot competitions; use dated primary comparisons and one physical/authenticated session when ready; broader 2–5 day acceptance estimate remains unmeasured | Escalate material rights/scope/spend decisions only; six gates must agree for each declared competition/window, with important gaps explicit |
| Defer new providers and inferred replay promises | General marketing is not match-level evidence; extra scraping or vendors would add maintenance without proven value | Wait for permitted access and actual entitlement/playback evidence; no source expansion or purchase authorised | No owner-maintained replay spreadsheet or recurring manual correction; unknown availability remains visible |

Token, cash and rework savings attributable to the repair remain unmeasured. The normal release suite has measured runtime; it is not a proxy for lower development cost or retention. Apple Passwords/export work remains parked. The 90-day repeat-use programme, independent recovery, physical-device proof and commercial acceptance remain open.

## Publication and evidence

Source is published on GitHub main as `54e34d66840b89746399584c6351a9b457a9ead5`, shell 398. [Normal release 37082212939](https://github.com/hartican/sportscal/actions/runs/37082212939) succeeds, including all 134 release contracts and the credentialed shared-fixture read. Production is READY `dpl_6CDDTS6p8KhhdPypC83Bf9RLjPV9`, immutable `sportscal-tio4rixoq-harticans-projects.vercel.app`. Independent project/production target/deployment metadata, three direct alias bindings and ten served artifact hashes match the exact published snapshot. Both engines pass all 170 final live-site rendering observations; controlled live partial-score cases are explicitly labelled and no authenticated playback is claimed.

The release package inventory measures 159,353,129 bytes across 1,255 files. Its existing accepted baseline is 94,300,000 bytes, separate from the passing 2.99 MB initial-shell budget. Le Mans expanded the independently published baseline before this repair; all 344 sporting-data files are unchanged relative to that baseline. No package budget was raised. This inventory is an existing weekly exception, not a new owner routine or a measured user-latency saving.

Exact saved evidence: [independent live proof](/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/viewing-action-release-20261003/independent-current-proof.json), [live browser observations](/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/viewing-action-production-20261003/browser-report.json), [original actual-action inventory](/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/viewing-action-actual-impact-20261003.json), [combined sporting preservation](/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/viewing-action-combined-preservation-20261003.json), [combined normal contracts](/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/viewing-action-combined-contracts-20261003/verification.json) and [verification summary](/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/viewing-action-verification-20261003.json). Both original and combined upgrade logs, the original red regression and the corrected PWA parse failure are retained in the same folder. The original action inventory uses the earlier pre-Le Mans baseline; the affected 194 NFL records and shared failure are unchanged by the independently published calendar work.

Recommended next work remains the six Football competition/window gates and source-backed degraded states. Whole-sport certification, a replacement-device recovery and the 90-day programme are not complete.
