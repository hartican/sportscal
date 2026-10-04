# Canonical final scores: reference-card repair — 4 October 2026

**Status: published to GitHub main and independently accepted in production.** Reference-card review reproduced a real presentation omission on 321 completed NRL/AFL records: a correct supplied nested final existed, but expanded Feed/Schedule showed “Finished” without its score. The shared reader now accepts `result.scorelineText` only for an explicitly completed event and completed result. Existing flat supplied scores retain precedence. Compact cards retain their current summary layout; expanding reveals the score with Results on. Results off remains private.

## Business outcome and recommendation

Ship this small shared repair before widening sport acceptance. It restores useful finals information without asking users to troubleshoot or adding an owner routine. Evidence: 149 NRL and 172 AFL unique affected records across actual rendering, a minimal unchanged-fixture reader reproduction and a red regression before the repair. It also repairs the same canonical shape in an actual AFLW sample. The other families and whole AFLW season are not certified by that sample.

Effort: one bounded diagnostic and release module. New cash cost: A$0; existing engineering/token and hosting costs are not measured. Owner time: no new task. Dependencies: canonical completed facts, existing Results consent and the current release/cache gates. Acceptance: actual expanded Feed/Schedule shows the supplied final; hidden results remain absent, flat scores win, stale nested finals cannot appear for non-final states, 0–0 remains valid, facts and original dates remain unchanged, both cached upgrades and production release pass. No rewrite, new provider, scheduler, subscription, source refresh, account write or policy change is needed.

## Evidence and scope

| Review | Verified result | Practical limit |
|---|---|---|
| Reproduction | 1,284 failed renderer cases involving 321 actual records before repair; the real shared reader returned null for their nested final | Presentation omission; no sporting result correction inferred |
| Primary comparison | Eight sequential HTTP 200 reads at 07:18:33.387–07:18:35.020 UTC: 204 NRL regular-season records and 11 AFL finals/wildcard records; 1,505 facts, zero final differences | Uses the existing adapters; not an independent parser. NRL finals and wider AFL regular-season truth are not freshly certified |
| Retained provider discrepancy | Existing NRL provider ID 129991007 correction remains 44–16 while raw Champion Data says 44–18 | This is agreement after a retained official correction, not direct raw-provider agreement or a new correction |
| Identity | All selected source IDs resolve uniquely; no participant/time duplicate groups | No migration, deduplication or altered activity IDs warranted |
| Actual component rendering | 431 current men's NRL/AFL records, 430 completed and one upcoming; 5,166 cases pass across two browser engines at 390px | Real components mounted in the app; synthetic preferences, blocked account APIs/workers. Compact layouts checked, score completeness asserted for expanded cards |
| Focused regression | Actual NRL, AFL and AFLW nested finals; flat precedence, non-final/malformed rejection, valid zero final, fixture mutation guard | Controlled state/error cases supplement actual fixtures |
| Local release | 145 existing required commands pass | Exact published cloud and production checks recorded separately below |
| Sporting preservation | All 351 tracked sporting files remain byte-identical | Source observation dates are not advanced by an audit or renderer fix |

The broader renderer initially reported 32 remaining failures because eight AFL results correctly retained “goals.behinds (total)” notation. The private verifier now compares their exact ordered supplied totals in result nodes; the renderer was not changed to flatten valid AFL detail. A separate new assertion initially demanded a visible final inside compact summaries, which the existing layout does not show. It was corrected by retaining compact privacy/layout checks and adding actual expanded Feed coverage. Original failed receipts remain. An earlier private primary-text comparison also needed to recognise a unique score pair before trailing team names. The affected WebKit test also exposed a startup-mount race: a late initial render replaced the temporary tested card between two test calls. Waiting for launch completion and capturing the mounted card in one evaluation fixes the harness without altering app startup. None of these verifier corrections changes sporting facts or creates a source agreement.

## Production acceptance

All 216 focused local cases pass (three actual NRL/AFL/AFLW records, three widths, two themes, compact/expanded Feed and Schedule, Results off/on, both engines). Both genuine 425→426 Chromium/WebKit upgrades pass, including the new final-score/privacy checks before and after offline restart. The 145-command application candidate remains unchanged; later edits refine only the affected browser verifier and this report.

App **9660541b / shell 426** is live after [normal release 37186680773](https://github.com/hartican/sportscal/actions/runs/37186680773). All 145 cloud commands and two protected read-only publication/preflight checks pass. Independent control-plane proof confirms the exact published release SHA, correct project, READY production deployment and three aliases; 22 served hashes agree with the immutable transformed release inventory. All 216 hosted actual-card cases pass in Chromium/WebKit. All 351 tracked sporting files remain exact. Both genuine 425→426 cached upgrades pass, including new final-score/privacy checks before and after offline restart. Later report-only publication is separate from the deployed app snapshot. The cached tests preserve native follow/mute/unfollow, Remind OFF, appearance, compact preference and actual final-score privacy through offline restart; they do not prove physical iPhone/Home Screen or push behaviour.

## Remaining programme gates and next outcome

NRL/AFL reference-window acceptance has advanced, but source coverage, all competition viewing/context, actual playback, commercial permissions, natural operation and physical-device evidence remain separate. Full six-gate certification stays **0/16 carried families and 0/3 Football pilots**, with the fixed **at least 13/16** target. The men's NRL Grand Final remains the sourced upcoming fixture at this observation, not an invented final. Current independent source/card evidence must not be turned into a whole-family pass.

Next bounded review: the existing NRLW/AFLW reference windows and their known undated finals, then the weakest carried windows. Reuse accepted EPL/UEFA comparisons; keep the remaining rights/playback/device and ordinary-schedule gates explicit. Passwords/iCloud remains parked. Five–six focused working days is an engineering planning allowance, not a whole-goal completion promise; meaningful repeat-use and wider acceptance require weeks and real elapsed observations.

Private evidence: `/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/reference-window-acceptance-20261004`. Raw provider responses and diagnostic harnesses stay outside Git and the public app. [Authoritative queue](../cto-delivery-plan.md), [six-gate contract](../../config/quality/coverage-contract.json).
