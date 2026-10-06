# Delivery practices for the invited-cohort MVP

The implementation backlog is `docs/cto-delivery-plan.md`. Sports-demand capture stays in the authoritative ignored local register; recording demand does not create an implementation commitment. Follow and backend decisions remain in their existing decision records. Do not create parallel priority lists.

Owner communication — 5 October: explain work in lay terms by default. Lead with what changed, how it affects the user and what remains. Keep code, test logs, identifiers and detailed reasoning in the saved evidence unless the owner asks for technical detail. Give one recommended next action and keep progress updates brief.

## One brief per coherent change

Before editing, state the intended user outcome, current evidence, files likely to change, excluded scope, acceptance checks and stop conditions. Retrieve those files and the relevant decision record first. Broaden investigation only when a concrete failure or dependency requires it. Prefer local deterministic work over model-generated facts. Never use generated editorial to fill missing scores, fixtures or rights.

Use this short brief:

- Outcome and business reason:
- Evidence and current release:
- Scope and preserved behavior:
- Acceptance and relevant regression commands:
- Dependencies, cash cost and owner time:
- Stop/escalation condition:

Choose one recommended next action. Escalate material product trade-offs, new spending or irreversible choices; resolve routine reversible implementation choices within existing authority. Do not ask the owner to repeat settled Follow or infrastructure decisions.

## Checks and release proof

Source adapters need malformed/partial-response and last-good tests. Identity/Follow changes need consent and routing checks. Presentation needs relevant narrow-width and spoiler checks. Shell/worker changes need version consistency and an upgrade exercise; physical iOS remains a separate claim. Operational tools need bounded scope and failure/retry checks. Documentation alone does not require UI retesting.

Retain required production gates. Passing a narrow test does not waive a different failed gate. Run targeted local checks after edits, then the mandatory release pipeline; repeat checks only after relevant changes or unexplained failures. Group related source, UI, tooling and documentation changes into one reviewable release. Avoid separate production releases merely to record a status sentence.

Release evidence must identify the main SHA, successful workflow, READY deployment, public alias/artifact agreement and relevant live behavior. Record each proof once in a named artifact. Summaries should link or name that evidence instead of repeating entire logs. A plan, source commit, deployment and device proof are distinct states.

Release runner baseline — 4 October: production and deployment cleanup explicitly select the already verified Ubuntu 24.04 family; canonical refresh retains macOS 15 for PDFKit and all jobs retain Node 24. This prevents a moving `ubuntu-latest` label from introducing an unreviewed major OS upgrade. GitHub image/security patches, action tags and Node minor releases still move; this is not an immutable toolchain. Review major compatibility changes through the existing gates and weekly exceptions, without a new tracker or standing owner decision. [Evidence and limits](quality/release-runner-baseline-2026-10-04.md).

Offline regressions use an explicit fixture/snapshot reference time. Production freshness/completeness checks use the current clock. A successful fetch proves observation time, not provider accuracy or complete worldwide coverage.

## Weekly exception review

Use a single concise readout: completed user outcomes; failing quality gates; source/scheduler exceptions; repeat-use measurement with sample size; release runtime/rework; measured token usage where available; and the next recommended action. Default to the current priority sequence when no material exception appears. No new standing meeting, tracker or owner questionnaire is required.

A 27 September measured release took 97 seconds: dependency installation 14, required gates 22, deployment 34 and public verification four seconds. This single sample is a baseline, not a trend. Football projection rebuild from unchanged inputs produced no Git differences. Recheck comparable samples before optimising the toolchain. Goal token counters are cumulative usage, not a bill or reliable per-feature allocation; do not infer cash cost without applicable billing evidence.

Model/tool choice should follow the work: use deterministic scripts for inventories and arithmetic, targeted retrieval for code context, and deeper reasoning for ambiguous architecture or risk. Do not delegate merely to increase activity. Prefer bounded output and avoid repeatedly printing generated/minified assets, whole schemas or unchanged job status.

Known-source research checkpoint — 4 October: a delegated commercial check exceeded its ten-minute budget without returning usable evidence; restarting it for a file-only closeout also failed to produce the artifact promptly. The parent stopped it and retrieved Hobby/pricing/ACCC passages with two direct web calls, four official URLs and about five seconds of fetch time; one AANA retrieval failed and stays unverified. This is not total investigation time or an efficiency success. Use direct batched reads for small questions with known official URLs; apply research delegation when independent investigation justifies coordination. When delegating, record the start/deadline in the existing task brief, require a concrete checkpoint before the cap, and stop at the deadline rather than repeatedly restarting a stalled closeout. Retain returned evidence and explicit unknowns. No new owner routine, tracker or automation. [Limits and evidence](quality/sponsor-source-assessment-2026-10-04.md).

The daily canonical workflow is the refresh owner; weekday quick and Sunday full modes are routes inside it. Keep failed-source reports in its retained artifact, preserving old source timestamps. Do not create another cron to compensate for a broken route.

### Source exceptions in the same readout — 1 October 2026

`delivery-readout.js` now also reads the latest completed canonical workflow's retained reports. It lists source failures even when that workflow succeeds, and separates incomplete tournament hydration from deployment success. A newer running job is identified; absent, expired, malformed, offline or more-than-36-hour-old evidence cannot silently become a healthy source. Full runs may legitimately omit the quick report, which remains unknown rather than zero failures.

Collection adds one latest-ten run inventory, one artifact lookup and at most one download of the existing report artifact, capped at 5 MB. It adds no refresh, scheduler, service, customer read or production write. The Markdown displays at most ten source failures and eight tournament gaps; remaining detail stays in structured JSON. Query strings and common secret forms are redacted. Regression: `node scripts/validate-canonical-source-readout.js` and the existing delivery readout validator.

Live proof at 02:55 UTC: canonical run 36777788726 succeeded but its 30 September 21:12 UTC report contained one LPGA HTTP 404 and eight partial tournament windows. The readout exposes both. LPGA's separately verified 1 October fix does not retroactively alter that historical report; a later natural check is needed to establish unattended success. The same window contains 97 production workflow runs: 91 success, four failure and two cancelled. Ten latest successful jobs have median 155.5 seconds and p90 171 seconds. This rolling window differs from earlier samples; no causal saving or per-feature token/cash amount is inferred.

Canonical refresh retries: `--resume-from script.js` now rejects duplicate step names before any work. Use the explicit one-based `--resume-occurrence N` after inspecting the step list. This prevents an intended late validation retry from silently selecting an earlier asset-only check and repeating source refreshes. Snapshot setup remains attached to the selected suffix.

### Bounded NBL source refresh

Use `SKIP_RELEASE=1 node scripts/update-cards.js -p --local-only --quick --source=nbl` for an NBL-only source correction. This is an option on the canonical command, not another scheduler. It reuses the existing loader and patch/projection functions, updates the incoming and published surfaces from their own current facts, and keeps publication/coverage/schema gates. It avoids unrelated tournament, WRC, Football and ladder network work and avoids regenerating unrelated editorial. Missing/invalid source options fail before writes. Source or gate failure restores data/feed artifacts; deployment is still a separate exact-SHA gated action. The observed no-op run made no publication changes. General quick mode remains the daily multi-sport path.


## Measured readout — 30 September 2026

Run `node scripts/delivery-readout.js --output-dir /Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27` for the weekly exception review. It is read-only, uses the existing GitHub CLI authentication, and adds no scheduler or service. Defaults: a rolling seven-day window, at most 100 observed runs plus a truncation sentinel, ten latest successful deploy jobs and up to ten failed jobs, with four concurrent reads. Missing/truncated evidence is explicit. `--days`, `--limit` and `--sample` remain bounded. Output is concise Markdown and structured JSON; do not publish private account data alongside it.

At 02:29 UTC the complete window contained 83 runs: 77 success, four failure and two cancelled. All four failures occurred at the safety-contract step. Ten latest successful deploy jobs had median 113.5 seconds and p90 122 seconds. Median safety checks took 39 seconds, deploy/reuse 38, dependencies 15 and public verification 4.5. The older 97-second sample is a single different revision; these observations are not a controlled performance experiment. No same-SHA repeats or additional attempts were recorded in the window. Different SHAs may still contain rework; this report cannot infer it from workflow metadata.

The current evidence does not justify a CI rewrite or removing safeguards. Prioritise one coherent user outcome per release and reuse existing retained proof. Prefer a single scoped source refresh and targeted verification after the final relevant edit. Stop broadening an investigation once its explicit acceptance criterion has evidence; carry unrelated findings into the existing delivery ledger. Do not create a new production deployment for this report or its tests.

The active goal counter reported 4,035,404 cumulative tokens and 33,605 goal-accounted seconds when this readout began. These cover the entire active goal, not this weekly sample or one feature; they are not billable-token or owner-time measures. Record counter snapshots at coherent phase boundaries when available, then compare like-for-like scope. Without provider billing and explicit phase boundaries, cash cost, per-feature tokens and rework hours remain unknown. Do not convert GitHub runtime or these counters into invented savings. The single readout remains an exception-review aid, not another owner-maintained tracker.


Local browser acceptance — 5 October: run heavy browser rehearsals in sequence on this Mac. Keep existing deadlines and record any failed startup before rerunning; capture only public critical-asset timings and native errors, not credentials or API bodies. The observed concurrent startup stall remains unproved; isolated passing checks are evidence for their own run, not proof that startup flakiness is resolved. This replaces ambiguous parallel work, adds no owner tracker, and does not waive CI or browser gates.
