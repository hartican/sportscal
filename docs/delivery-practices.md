# Delivery practices for the invited-cohort MVP

The implementation backlog is `docs/cto-delivery-plan.md`. Sports-demand capture stays in the authoritative ignored local register; recording demand does not create an implementation commitment. Follow and backend decisions remain in their existing decision records. Do not create parallel priority lists.

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

Offline regressions use an explicit fixture/snapshot reference time. Production freshness/completeness checks use the current clock. A successful fetch proves observation time, not provider accuracy or complete worldwide coverage.

## Weekly exception review

Use a single concise readout: completed user outcomes; failing quality gates; source/scheduler exceptions; repeat-use measurement with sample size; release runtime/rework; measured token usage where available; and the next recommended action. Default to the current priority sequence when no material exception appears. No new standing meeting, tracker or owner questionnaire is required.

A 27 September measured release took 97 seconds: dependency installation 14, required gates 22, deployment 34 and public verification four seconds. This single sample is a baseline, not a trend. Football projection rebuild from unchanged inputs produced no Git differences. Recheck comparable samples before optimising the toolchain. Goal token counters are cumulative usage, not a bill or reliable per-feature allocation; do not infer cash cost without applicable billing evidence.

Model/tool choice should follow the work: use deterministic scripts for inventories and arithmetic, targeted retrieval for code context, and deeper reasoning for ambiguous architecture or risk. Do not delegate merely to increase activity. Prefer bounded output and avoid repeatedly printing generated/minified assets, whole schemas or unchanged job status.

The daily canonical workflow is the refresh owner; weekday quick and Sunday full modes are routes inside it. Keep failed-source reports in its retained artifact, preserving old source timestamps. Do not create another cron to compensate for a broken route.

Canonical refresh retries: `--resume-from script.js` now rejects duplicate step names before any work. Use the explicit one-based `--resume-occurrence N` after inspecting the step list. This prevents an intended late validation retry from silently selecting an earlier asset-only check and repeating source refreshes. Snapshot setup remains attached to the selected suffix.

### Bounded NBL source refresh

Use `SKIP_RELEASE=1 node scripts/update-cards.js -p --local-only --quick --source=nbl` for an NBL-only source correction. This is an option on the canonical command, not another scheduler. It reuses the existing loader and patch/projection functions, updates the incoming and published surfaces from their own current facts, and keeps publication/coverage/schema gates. It avoids unrelated tournament, WRC, Football and ladder network work and avoids regenerating unrelated editorial. Missing/invalid source options fail before writes. Source or gate failure restores data/feed artifacts; deployment is still a separate exact-SHA gated action. The observed no-op run made no publication changes. General quick mode remains the daily multi-sport path.
