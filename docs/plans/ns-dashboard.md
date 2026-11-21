# Private NS administration dashboard

Status: Phase 1 proposal, 2 November 2026. Owner: nsDASHBOARD.
The current product-owner brief governs scope; this document makes the first implementation reviewable.
This is a private administration product, separate from the customer app and the consumer Curator.

## Phase contract

| Field | Contract |
| --- | --- |
| App / repository | Nothing Sport / hartican/sportscal |
| Current phase | 1: source audit, definitions, architecture, layout and backlog |
| Included | Public-safe design and versioned metric dictionary; private audit and source receipts retained outside Git |
| Deferred | Hosted UI, connectors, historical backfill, persistence, identity configuration, benchmarking execution and schedules |
| Acceptance | Sources and gaps evidenced; metric boundaries explicit; six-journey protocol; reviewable implementation slice and access gates |
| Release boundary | Draft documentation PR only; nsCOORD owns queue, nsRELEASE readiness, nsPUBLISH publication |

The dated audit is a private handoff, not live application configuration. It contains operational observations and must not be copied into this public repository. No dashboard status authorises merge, deployment, security changes or a paid service.

## Decisions the dashboard supports

The Overview should let the owner identify what became usable, the next blocking gate, its accountable owner and whether its delay is growing within ten seconds. Engineering Detail explains events, definitions and limitations. Product Benchmarks evaluates user outcomes independently of delivery activity. There is no productivity grade or activity ranking of people or agents.

Reuse the existing release queue; do not turn dashboard classifications into another priority system. One deliverable can contain several PRs. A closed PR is not a delivered user outcome. Test-only, superseded, historical and dependent groundwork remain visible in Engineering Detail and separate from active delivery work.

## Proposed architecture

Extend the existing server-side administration boundary and UI patterns, with a distinct dashboard route and read-only data endpoint. Keep all dashboard data out of static HTML, generated public JSON, customer bundles, service-worker caches, source maps, public CI artifacts and logs.

The existing app-admin role is necessary but does not by itself establish Jack-only authorisation. Before enabling the surface, independently establish Jack's existing authenticated identity and enforce a server-owned single-owner match in addition to verified authentication. Do not identify him from a mutable user claim or an unverified email supplied by a client. Fail closed if owner binding is absent. A future developer role is a separate, explicitly granted read-only permission; implement no grant in this phase.

Both the document response and every API route must enforce access before returning administration content. Use a private sign-in entry/redirect with no embedded operational data. The protected response uses private/no-store browser and CDN headers, no shared-cache variants and a restrictive content security policy. Public static fallback paths must not reach a copy of the page or its data. Customer service-worker fallback must never cache or substitute an administration response.

Prefer a small private, versioned snapshot over a new observability service. Collector: bounded read-only source adapters -> validated normalised events -> deterministic projections -> atomically replaced last-good snapshot. Request path: authenticate/authorise -> read already prepared projection -> render. No GitHub crawling, SQL aggregation or provider refresh on ordinary page loads.

The first implementation can run its collector locally with existing authorised tools and owner-only local files. This proves calculations without new hosting, schema or credentials. A hosted snapshot store is a decision gate: inspect whether existing private storage can isolate an operations-only object, with server-only access and no customer rows. Do not assume capacity or create a bucket/table now. If existing storage cannot fit the isolation and budget, present the smallest alternative before provisioning it. Keep the adapter independent of Supabase so the initial local collector remains useful.

Missing hosted read credentials, an owner binding or a storage/security change must not be worked around with broad service tokens, public artifacts or copied browser sessions. A separate service is justified only if the current deployment cannot deny anonymous page access and isolate data affordably.

## Collection and data quality contract

- Use supported GitHub APIs for PRs, lifecycle events, commits, check runs, jobs, artifacts and deployments. Respect Link/cursor pagination, rate limits and conditional requests. Source metadata listing does not prove a workflow is present or runnable on current main.
- Use deployment records and alias assignment separately from release verification. Preserve missing release SHA metadata as a gap. An app-version response alone cannot establish the served commit or user-journey acceptance.
- Reuse release-owner proof files with their original SHA, tree, dependencies, toolchain, generated assets, scope and expiry. Do not run owners' tests again to populate the dashboard.
- Import only supported queue/stage/readiness records and a small explicit deliverable classification. Never bulk-ingest private chats or infer work/waiting from message silence. Retain a source pointer and observation time for a manually extracted status; it is not a live task heartbeat.
- Start routine collection manually. Proposed bounds: initial reconciliation <=300 API requests, <=5 minutes, <=25 MB input; incremental pass <=25 requests and <=60 seconds; one writer, no page-load collection. Stop at a bound with explicit partial coverage. These are design budgets to validate, not measured costs or approved schedules.
- Write checkpoint/cursor and last-good projection only after validation succeeds. A failed fetch preserves prior data, last successful refresh and an error. Never replace missing data with zero or a green status.
- Proposed initial local retention: 90 days of normalised events and derived daily observations; raw payloads minimised and removed after 14 days once provenance is sufficient. Pin the small inputs needed for published comparisons until superseded. Historical backfill may include older creation/lifecycle events needed to establish the window's starting state. Retention is not a production deletion instruction.
- Record adapter wall time, requests, bytes, maintenance time and errors. Revisit the product if maintaining it costs more than the decisions it improves.

Every panel includes source IDs, observation coverage, last successful refresh, status (loading / empty / fresh / stale / partial / error / not measured), sample count and metric version. Show UTC timestamps underneath Australia/Sydney display times. Proposed stale thresholds: operational snapshots 24 hours, candidate evidence at its owner-defined expiry or any input change, benchmark observations 30 days; display collection age rather than implying real-time execution. Validate these thresholds during review.

## Linked entities

Every event envelope has schema/metric version, stable source system and source ID, occurrence and ingestion timestamps in UTC, service/repository, entity type/ID, relevant linked IDs, state/type, source URL or private evidence pointer, provenance, confidence and supersedes/correction reference. Identity is source-system + source-ID; retries retain their own attempt IDs.

| Entity | Minimum additional facts |
| --- | --- |
| Deliverable | Stable ID, type (feature/fix/maintenance), brief complexity context, member PRs, accountable owner, priority from queue, dependencies, acceptance evidence |
| PR lifecycle event | PR ID/number, creation/close/reopen/merge/draft transition and event ordering |
| Commit | SHA, recorded commit time, parent mapping, explicit original-to-rewritten mapping if available |
| Check / run / job | Head SHA, run/attempt/job IDs, conclusion, supported timing/step boundaries, evidence scope and toolchain |
| Deployment | Provider ID, attempt, service, environment, target SHA, start/success/activation, application/data-only/mixed classification, rollback relationship |
| Live verification | Exact deployment, alias, served SHA/version/assets, timestamp, journey/scope, result, verifier and expiry |
| Incident | Production impairment time, affected deployment, attribution confidence, restoration verification, observation coverage |
| Ownership / stage transition | Deliverable, owner, stage, entry/exit time, ready/revoked event, next action and source |
| Executor observation | Local/cloud/unknown, task/run mapping, bounded interval, supported CPU/memory/minutes observations |
| Usage record | Provider/model, input/output/cache tokens, currency, billed/effective/estimated cost basis, pricing date, attribution coverage |
| Benchmark observation | Product/cohort/version, protocol, fixture/sample, environment, trial, result, exact evidence and limitations |

## One-screen Overview

Desktop reading order; use the same order in one column on mobile.

```text
NS administration     Overview | Engineering Detail | Product Benchmarks
Source coverage / last successful refresh / errors

Production now                       Next release
Verified live version + commit       Candidate + blocking gate
Last verification + scope            Owner + next action + stage age

Delivery trend [7 / 28 days]          Decisions needed (maximum 3)
Intake / PR closures / delivered      Specific exception + owner + evidence
Backlog + sample and coverage

Release queue
Deliverable | priority | owner | stage / age | dependency | next action
  related PRs + independent merged / deployed / verified labels

Efficiency and coverage               Quality and important journeys
Measured wait / rework / resources     Regressions + supported latest proof
Missing attribution clearly labelled  Untested and stale proof explicit

Secondary: support / scheduled jobs / infrastructure / source health
```

Use text with colour, visible keyboard focus, semantic headings and tables, readable source links, zoom/reflow and a narrow mobile layout. Queue expansion reveals member PRs without double-counting. Initial data loading never shows a success state; an interruption preserves the prior result and identifies its age. Engineering Detail links each figure to the metric dictionary, source events and classification decision. Offer service, work type and time filters first; owner/executor filters only when coverage supports them.

## Product benchmark protocol

Reuse the existing competitor owner's source register and positioning review. Its consumer Curator work is not an administration dashboard. Current status, dated artifacts and any newer independent research are reconciled in the private audit. Old strategic scores are not current benchmark results.

Proposed first cohort: the exact public mobile-web products SportFeed (sportfeed.app), Sofascore (sofascore.com) and Flashscore Australia (flashscore.com.au), subject to a public-UI preflight confirming the relevant fixture and journey. Public documentation checks can establish product identity and advertised routes only. Record unavailable public versions as unknown plus URL, observation time and captured page/build identity where supported. Native apps, authenticated sync and paid services are separate cohorts requiring their own scope.

| Journey | Evidence required |
| --- | --- |
| Find an upcoming fixture | Correct participants, competition, local time, timezone and cancellation status against dated authoritative source |
| Follow and reopen | Selected team survives reload/reopen; account/device sync is a separate authorised trial |
| Find Australian viewing | Correct local provider/destination and stated entitlement; a click is not successful playback |
| Find a result | Status/score accuracy and age against a timestamped authoritative source |
| Reach highlights | Relevant destination or clearly labelled search fallback; unavailable stays unavailable |
| Recover from interruption | Choices persist, stale data identified, no misleading save/success confirmation |

Freeze a small fixture manifest across promised NS sports/competitions; include an upcoming, completed, live-when-observable and cancelled/unknown-time case where available. Record omissions. Use the same device, browser/version, viewport, Australian network/region, auth state, cache state and observation window. At least three trials for each applicable product/journey, with first-use and repeat-use separated. Record completion, elapsed time, steps, errors, factual correctness, persistence and accessibility barriers; report median, range and n. Availability and execution success are separate fields. Untested/inaccessible/unsupported is N/A with a reason. Report improved/regressed/unchanged/insufficient evidence per journey, never an overall competitor rank.

Field Core Web Vitals are separate from lab diagnostics and task timings. Use p75 by mobile/desktop: LCP <=2.5 seconds, INP <=200 ms, CLS <=0.1. Small lab samples do not establish field performance. WCAG 2.2 evaluation includes keyboard, zoom and screen-reader work; an automated scan does not prove conformance.

Affected journeys per release, weekly NS review, monthly competitor checks and quarterly protocol review remain proposed rhythms. No recurring job or new schedule is created by this specification.

## First implementation slice and backlog

| Order | Slice | Completion evidence |
| --- | --- | --- |
| 1 | Local collector + deterministic PR lifecycle reconstruction | Bounded paginated export, provenance, idempotent replay, historical reconciliation, errors preserve last good data |
| 2 | Explicit deliverable grouping + release truth projection | Existing queue mapped without reprioritising; distinct merge/deploy/live states; candidate invalidation demonstrated |
| 3 | Private Overview + Engineering Detail | Server denial on pages/APIs/assets, owner binding proved, no public-data path; mobile/keyboard/zoom/interruptions checked |
| 4 | Hosted private snapshot, if approved architecture needs it | Exact storage permissions/costs documented, independent access and query-budget checks, release handoff |
| 5 | Reliable enrichment | Supported incidents, resource attribution and bounded benchmarks; unsupported metrics remain not measured |

Slices 1–4 form Phase 2's minimum useful product. The first draft implementation should include 1–2 and access-boundary tests before a private hosted preview is considered. No autonomous actions, credentials, security grant, access expansion, schema deployment or new recurring cost is authorised here.

Phase 2 regression cases: older open PRs, drafts and draft transitions, reopen cycles, merge/close at cutoffs, same-time events and pagination; Sydney DST transitions and noon seeds; skipped/failed deployments, rollback and stale live proof; denominator/zero-output/partial usage and retries; grouped deliverables; exact combined candidate invalidation; anonymous and non-owner denial across response/cache/export paths; loading/empty/error/stale/interrupted states; desktop/mobile keyboard, zoom and screen-reader checks; bounded collection and source-to-chart traceability.

## Handoff and ownership

Hand the reviewed phase through nsCOORD and nsRELEASE, linking exact head, tests and remaining limits. Only nsPUBLISH publishes. Keep the chat in NS Planning Tasks until the initial dashboard is reviewed and delivered through that process, then move the same long-lived owner into NS DevOps Team. Maintenance covers adapters, definitions, source quality and dashboard defects, without becoming another release orchestrator.

## Standards

Definitions and thresholds rechecked 2 November 2026:
[DORA metrics](https://dora.dev/guides/dora-metrics/), [metric history](https://dora.dev/insights/dora-metrics-history/),
[SPACE](https://www.microsoft.com/en-us/research/publication/the-space-of-developer-productivity-theres-more-to-it-than-you-think/),
[DevEx](https://getdx.com/research/devex-what-actually-drives-productivity/),
[Google SRE monitoring](https://sre.google/sre-book/monitoring-distributed-systems/),
[Core Web Vitals](https://support.google.com/webmasters/answer/9205520?hl=en-EN),
[WCAG 2.2](https://www.w3.org/TR/WCAG22/), [accessibility evaluation](https://www.w3.org/WAI/test-evaluate/),
[GitHub lifecycle events](https://docs.github.com/en/rest/issues/events).
See [metric dictionary v1](../metrics/ns-dashboard-v1.md).
