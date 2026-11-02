# NS dashboard metric dictionary v1

Definition version: 1.0.0, proposed 2 November 2026. Scope: Nothing Sport application service in hartican/sportscal.
This is a definition contract, not a measured baseline. Implementation and populated results are deferred.
Use the [dashboard plan](../plans/ns-dashboard.md) for collection, access and acceptance requirements.

## Rules shared by every metric

Purpose, formula, sample, scope and missing-data behaviour below combine with these common rules; every displayed result retains this definition version.

- Event times are UTC; display and calendar boundaries use IANA Australia/Sydney, including daylight saving. Never use a fixed UTC offset. Rolling windows are the last seven or 28 complete Sydney dates, [start local midnight, end local midnight); show the exact UTC bounds and put today's partial period separately.
- Historical noon snapshots use their explicitly supplied Sydney noon cutoffs and include events occurring at or before the cutoff. A flow reconciliation between two inclusive snapshots uses (first cutoff, last cutoff]. Seven daily snapshots span six intervals; never relabel that interval seven complete days.
- Counts use unique source IDs within one service. Corrections supersede records visibly; retain original provenance. Run attempts and job IDs preserve retries. Never add workflow elapsed time to constituent job-minutes.
- Report counts and denominators, attribution coverage, freshness, excluded populations and source links. A measured empty set may be zero; missing/incomplete observation is not zero. Undefined ratios return null with a reason.
- Durations use median and range with n; add p75/p95 only with sufficient samples and state n. Do not average percentages from unequal denominators. Aggregate rates from summed numerators and denominators for the same scope.
- Filter by service/work type/window; owner and executor only where evidenced. Avoid cross-model token or cost equivalence, artificial complexity points, individual activity ranks and synthetic grades.
- Application deployment means a successful production rollout/activation of application code for this service. Keep attempts and data-only publication separate. A mixed code/data rollout counts once as an application deployment; failed/cancelled/skipped attempts do not. A rollback activation gets its own rollout identity and previous-target link, even if it reuses an old artifact; deduplicate retries that never activated.
- Commit mapping uses ancestry plus explicit original-to-squash/rebase/cherry-pick mapping from provider/release evidence. Use the original recorded committer timestamp for the mapped change. Do not reset lead time to merge time or infer equivalence from titles alone. Unmapped changes have unknown lead time and reduce coverage.
- Incident observation has an explicit covered service/time interval and completeness assertion. No incident records without complete observation cannot establish zero failures. A CI failure before production is not a production incident.
- Mixed releases containing any explicitly incident-driven unplanned repair count once in deployment rework numerator; preserve the other component classifications. Ordinary planned bug fixes are not automatically incident rework. Unknown classification is not a planned deployment.
- Verified deliverables require the owner's acceptance evidence for the exact deployed composition and relevant user behaviour. API/asset proof alone cannot establish physical-device or authenticated user acceptance. Revalidation of one outcome does not create a second delivery.

## Five DORA measures

These reflect the current [five-metric model](https://dora.dev/guides/dora-metrics/); PR flow and NS-specific efficiency are separate.

| ID / metric and purpose | Formula / numerator | Denominator, population and aggregation | Missing data / exclusions |
| --- | --- | --- | --- |
| D1 Deployment frequency — production cadence | Count unique successful production application rollout activations in window | Report count per 7/28 complete dates for the service; show separate attempts/successes | Unknown activation/coverage => partial/not measured; merges, CI and data-only refreshes excluded |
| D2 Change lead time — time to production | For each mapped change first successfully deployed in window: deployment success time minus original code commit time | Median/range/n of mapped changes; coverage mapped / eligible changes; UTC elapsed seconds | Missing mapping/time => unknown, never substitute PR creation or merge time; subsequent rollback/redeploy does not create a new first-deploy sample |
| D3 Failed deployment recovery time — restore impaired production | Verified restoration time minus deployment-caused production impairment onset | Median/range/n of attributed deployment incidents restored in window; open incidents shown separately with current age | No complete incident observation => not measured; pre-release failures excluded; unknown attribution separated |
| D4 Change fail rate — deployment stability | Unique eligible production application deployments causing impairment requiring intervention | All eligible production application deployments in window; numerator/denominator and percent | Zero eligible => undefined; incomplete incident observation or attribution => partial/not measured, not 0%; delayed incident attribution visibly recomputes affected cohort |
| D5 Deployment rework rate — unplanned repair burden | Unique eligible deployments classified incident-driven unplanned repair/rework | All eligible production application deployments in window; counts/percent plus classified / eligible coverage | Zero eligible => undefined; any unclassified deployment makes full-cohort rate partial; planned fixes/data-only refreshes excluded by policy |

Deployment attempts have source start/terminal status and an independent activation record. A green provider build without production traffic/alias evidence cannot create an activation. Count rollback and hotfix interventions in D4's incident attribution without counting the same causing deployment twice.

## Flow, waiting and evidence

| ID / purpose | Formula / event boundaries | Population and aggregation | Missing data / exclusions |
| --- | --- | --- | --- |
| F1 PR intake — incoming work | PR created events in window | Unique PRs; drafts included and identified; show work classifications separately | Reopen is F2, not a new PR; incomplete pages => partial |
| F2 PR lifecycle flow — distinguish work and housekeeping | Reopen events; merge events; unmerged close events, separately | Event counts per window, with unique PR counts alongside; preserve repeated close/reopen cycles | No single closed_at reconstruction; merged closes not also unmerged closes |
| F3 Open-PR backlog — outstanding repository work | Replay creation and all lifecycle events through cutoff; open state count | Include older still-open PRs and drafts; draft state reconstructed from transitions; report active/test/superseded/groundwork classifications separately | Incomplete enumeration/event pages => provisional count; creation + reopen - merge - unmerged close reconciles state deltas |
| F4 PR lead time — review flow | Merge time minus creation time for PRs merged in window | Median/range/n; include draft time; separately show unmerged closure and open age | Not DORA; missing boundary => unknown; never mix open age into completed duration |
| F5 Current-stage age — actionable delay | As-of time minus latest supported stage-entry transition | Per active deliverable and current stage, not sum of member PR ages | Missing transition => unknown, not inferred from chat silence or file modification |
| F6 Ready-to-release delay — release waiting | First production activation after accepted readiness minus readiness time | Completed interval per deliverable; current waiting shown separately; explicit readiness revocation ends interval as revoked, not delivered | Unsupported readiness => unknown; retain revoked intervals, avoid treating expired evidence as continuously ready |
| F7 Deliverable throughput — usable outcomes | Unique deliverables first meeting exact live acceptance in window | Count grouped outcomes; type/brief complexity context, n and coverage | Merges/PR closures not proxies; unknown grouping stays unclassified, no invented delivery |
| F8 Delivery backlog/intake — admitted work | Queue deliverables admitted minus accepted delivered/explicit withdrawn; retain stage | Read existing owner's stable IDs and priorities; outcome throughput separate from housekeeping | No authoritative intake/transition data => not measured; do not generate a second queue |
| F9 CI queue / setup / execution — feedback friction | Supported runnable/queued -> job start; setup step interval; test/build execution intervals, separately | Per attempt/job, median/range/n; summed measured job-minutes for resources; dependency wait separate | Workflow created -> start may include orchestration and is labelled elapsed waiting; no exact queue time without supported boundary; missing setup/steps => unknown |
| F10 CI retries — investigate repeat execution | Attempts repeated with same head/dependency/toolchain/test-input fingerprint | Count attempts and minutes, scope/justification; repeated inputs flagged for review | Repetition is not automatic waste; flakes require pass/fail evidence under equivalent conditions |
| F11 Feedback time / handoffs / manual steps — DevEx friction | Supported submission -> first actionable feedback; explicit owner transitions; observed manual actions | Per comparable work type, median/range/n and optional owner report | No inference of human cognitive load/satisfaction from telemetry; optional confidence/intervention survey kept separate |
| F12 Evidence validity — prevent false readiness | Compare tested SHA/tree, dependencies, toolchain, scope, generated assets and expiry with candidate | Per proof valid/invalid/unknown plus exact invalidating event | Branch passes do not establish combined candidate passes; retain release-owner final composition/version/cache checks |
| F13 Production truth — know usable state | Merged SHA, provider deployment/activation and verified-live evidence stored independently | Per service/alias with version, observed commit, exact scope and timestamp | Missing SHA, stale proof or alias drift displayed explicitly; no hard-coded current version or blocker |

Historical reconstruction begins from all relevant PRs, including older open work, and follows every event page. Deduplicate source events before sorting by occurrence time and stable source ordering. Contradictory same-time transitions without authoritative ordering are ambiguous, not guessed. Preserve export hashes, page/cursor manifests, API query bounds and calculation version. A replay must reproduce the observation and identify any seed mismatch.

## NS-specific resource and AI measures

| ID / purpose | Formula / numerator | Denominator and aggregation | Missing data / interpretation |
| --- | --- | --- | --- |
| N1 Cloud execution share | Cloud executor-minutes | All measured local + cloud executor-minutes; show unknown minutes and observation coverage separately | Executor means where commands run, not model reasoning; overlap deduped per executor interval; no complete local source => only measured share |
| N2 Portable work offloaded | Completed eligible work units executed wholly in cloud | All completed eligible units under versioned eligibility rules; hybrid category separate | Preserve fixed eligibility across comparison; unknown executor => incomplete coverage |
| N3 Laptop dependency | Measured required-awake duration and local heavy-work intervals; supported memory pressure / swap delta | Display each observation independently per work type/window; memory peaks are not additive | No supported observation => not measured; more cloud is not a positive result without time/cost/reliability evidence |
| N4 AI tokens per delivered outcome | Attributable input/output/cached tokens by provider/model and outcome cohort | Unique accepted delivered outcomes linked to that usage; show in-progress/unattributed separately | No outcomes => undefined; partial usage => partial, not total; cached categories must follow provider semantics to avoid duplication |
| N5 AI cost per delivered outcome | Actual attributable billed usage by currency; estimate as separate series with model/pricing date/assumptions | Same accepted outcome cohort as N4; include all observed lifetime usage for those outcomes and disclose missing history | Subscription consumption is not invented cash; raw tokens across models not equivalent; unknown mapping => not measured |
| N6 Resource use per delivered outcome | Attributable CI/executor-minutes, preparation/rework durations and retries | Unique accepted outcome cohort; show in-progress separately, measured coverage and comparable work type | No accepted outcomes => undefined; avoid double-counting parent runs and child jobs |
| N7 Infrastructure costs — spending context | Provider billed and effective cost kept separate, source currency and returned billing period retained | Service/project tagged records only when complete; team totals explicitly team-scoped | Boundary mismatch, truncated allocation or absent tags prevents per-outcome attribution; budget alerts are not hard caps |
| N8 Dashboard overhead — proportionate administration | Dashboard's own collector/resources and supported maintenance time | Per week and per refresh, alongside decision/action log | No fabricated maintenance minutes; an unmeasured intervention burden stays unmeasured |

Token/cost outcome cohorts are grouped by acceptance date and include only attributable lifetime consumption for those outcomes. Period consumption is a separate view, never silently divided by a different delivery cohort. Record work-routing/infrastructure changes as dated annotations; before/after association is not causation.

## Product outcomes and benchmarks

| ID / purpose | Formula / population | Aggregation / evidence | Missing data / interpretation |
| --- | --- | --- | --- |
| P1 Journey completion/correctness/persistence — useful decisions | Applicable controlled trials completing each stated criterion / applicable attempted trials | Per product/journey/cohort, numerator/denominator; correctness and persistence separate from availability | Unsupported/inaccessible/untested => N/A with reason; no synthetic competitor rank |
| P2 Journey time/steps/errors — friction | Elapsed time and observed steps/errors for each bounded trial | First/repeat use separate; median/range/n with failures/timeouts reported independently | Never drop failed trials silently or generalise a small lab sample to field users |
| P3 Fixture accuracy/freshness — trust | Correct sampled facts / checked facts plus source-observation -> displayed-update age | Frozen sport/competition/status sample, authoritative comparison timestamps, cancellations and unknown-time cases | Sample is not complete catalogue assurance; unverified source => unknown |
| P4 Field performance — Core Web Vitals | Field LCP/INP/CLS at p75 by device cohort and source window | Good: <=2.5 s / <=200 ms / <=0.1; show field sample availability and provider window | No field data => not measured; lab/Lighthouse/task timings separate |
| P5 Accessibility barriers — usable interaction | Observed barriers with protocol, severity and evidence | Keyboard, zoom and screen reader plus automated findings; dated WCAG 2.2 scope | Automated pass does not prove conformance; untested checks explicit |
| P6 Planning/useful return — product value | Existing qualified fixture-check/watch-decision events on two distinct Sydney dates in 28 days, with verified cohort eligibility | Reuse existing product-event contract and permitted aggregates; show sample/owner/test contamination limits | Not D7 retention, not proof of watching, not app opens; no new customer collection authorised |

Metric revisions are versioned. Either recompute and label historical comparisons under the new version or retain distinct series; never silently rewrite a published comparison.
