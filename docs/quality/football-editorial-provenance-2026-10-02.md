# Football editorial provenance repair — 2 October 2026

Status: local canonical/regression checks and Chromium/WebKit 345→346 upgrades pass; GitHub publication and production verification pending. This is a freshness-integrity repair, not new coverage or full Football certification.

## Problem and resulting behaviour

A disposable reproduction advanced the editorial assembly clock without making any network request. The retained EPL season-guide source changed from its existing observation to the new assembly date. Facts and projection/review metadata also acquired generation dates. A future-date clamp silently made invalid dates appear current. In addition, EPL match citations used the top-level editorial table URL instead of the retained canonical fixture URL.

The assembler now requires a dated retained observation. Static guide sources keep their existing historical dates; table and match sources use their actual source-owner observations. Unchanged facts and copy keep their dates. Changed copy is grounded in its referenced dated facts. Missing, invalid and future source evidence fails before writing instead of being stamped with the current time. Historical retained dates are not newly independently certified evidence; the repair stops advancing them without a fetch.

The final rolling identity pass also compared a copy-research date with a table-observation date. After a real table check, unchanged richer EPL copy was replaced by a generic ladder template. It now recognises the actual dated EPL-depth table observation separately; a later source check cannot force fabricated research dates to retain non-generic copy. The actual rolling builder is exercised in the regression. Static Cricket corrections likewise retain their prior observation rather than adopting assembly time.

A second defect appeared in canonical integration: applying the historical official-result snapshot overwrote the current Feed publication clock with the old result-check date. Both full and quick routes now retain the Feed assembly/publication date while preserving the actual result observation on each result. Retention tests can therefore use the current build date without making historical results look newly checked.

## Verification and bounded scope

`validate-editorial-provenance.js` executes the actual assembler and historical-result CLI against disposable persisted files. It verifies unchanged reruns, actual table/match dates and match URLs, preserved EPL identities/facts/viewing, changed dated facts, same-resource aliases, missing/invalid/future observations, incomplete citations and separate result/publication clocks. Synthetic later clocks derive from the retained current evidence, avoiding a fixed test-date expiry. No network or customer account is used by this regression. It also exercises the actual rolling reconciliation after a newer table observation and verifies that Cricket repair reruns do not advance source checks.

The regression is part of the existing canonical owner and ordinary production workflow. No scheduler, subscription, database migration, browser credential or source poll is added. Source checks needed for release freshness use the existing canonical pipeline. Expiry of a routine card does not delete its canonical season record or establish a final result.

The initial late-resume attempt failed the expired AFLW-card coverage gate. The earlier resume exposed the historical publication-clock defect. Subsequent result gates correctly stopped on an overdue NBL result and an old canonical snapshot. One existing scoped NBL invocation fetched the official 84–82 final; the normal canonical source route then refreshed its existing baseline. The new source check also exposed the richer-copy downgrade, which was reproduced and repaired. The final canonical resume passes every remaining required gate, including both result feeds and the existing technical pilot-readiness check. This technical gate is narrower than full Football/cohort certification. Failed logs and the initial generated patch are retained. These failures are not recorded as passes, and no release gate is weakened.

## Value, cost and remaining limits

Value: users and operators can distinguish newly assembled cards from newly observed facts, reducing false confidence in old commentary. Fixture identities and personal activity remain separate from these metadata changes. Additional service cost: A$0. No new recurring owner task. Owner decisions: none for this repair. Keep the existing single physical-device/recovery session; do not add another checklist or coverage breadth.

Acceptance: persisted reruns cannot advance observations without evidence; the canonical and ordinary release checks pass; the exact main snapshot reaches READY production with matching release metadata, aliases and served artefacts; affected real Football rendering preserves Results-off privacy, source context, navigation and viewing links. Those release results will be appended once verified. Unattended source-operation evidence, physical devices, full editorial truth/commercial permission and all three Football certifications remain open. None of 16 families is fully certified.

Evidence under `/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27`: `football-editorial-date-reproduction-20261002.json`, `football-editorial-provenance-regression-20261002.log`, `football-editorial-provenance-canonical*20261002.log`, the failed generated patch and `football-editorial-provenance-nbl-gate-recovery-20261002.log`. A final scoped preservation comparison and immutable release evidence accompany the delivery report.


Local source-to-projection comparison at 2026-10-01T17:45:56Z verifies all 668 pilot identities and declared fixture/result/viewing facts unchanged in both Football Schedule artefacts (380 EPL, 144 UCL, 144 Europa). The separate ODbL provider dataset is unchanged. Routine source checks additionally recover the actual official Carlton–Hawthorn 36–24 and Tasmania–Melbourne 84–82 finals. No elapsed-clock result was inferred. Cached runtime source bytes changed, so shell 346 and dual-engine upgrades are required and both rehearsals pass retained preferences, resource failure, offline/resume and previously cached profile-module checks. Browser/device and actual secret-recovery limits remain separate.
