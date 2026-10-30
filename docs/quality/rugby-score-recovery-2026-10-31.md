# Rugby score recovery — 31 October 2026

## Scope and current acceptance boundary

Source PR119 enables an eight-source Rugby-only route through the existing canonical updater. Cricket remains explicitly deferred at its unproved raw-provider contract; unrelated Cricket, EPL and NBL facts remain preserved. ROOT/nsDEPLOY alone integrates and publishes. Sync PR111 stays parked and background automations remain paused.

Reviewed source: `1b9e50029d744a74b05566f23bb1253204a35dbb`, tree `f479339706931067cdcc58be1e4e8ee0d83fbee9`. The exact ancestry is `1b9 → ed970 → 3d3ec1 → 74883085`; 3d is the repair patch base, not 1b9's immediate parent. Both source reviews are clear. No database migration, new source, credential, scheduler, API or customer-state change is included.

## Actual candidate evidence

[Guarded qualification 41064809585](https://github.com/hartican/sportscal/actions/runs/41064809585) passed every original 64 default and 25 selected native control, with unchanged assertions, guard, supervisor, resource limits and write inventories. The single canonical local-only trial read 1,303 public rows in three complete pages (3,846,708 bytes; approximately 5,369 / 4,353 / 3,739 ms), including full bodies, both parses and a mandatory short final page. It used the existing shared observation store, not new direct World Rugby research or a new ingestion owner.

Artifact `12981168745` has verified SHA-256 `243bcaf9f50a329cdc0dc178beb53000f8c2388933ca83aab42e57383d677df6`. Independent export credential scans, process-group closure and temporary-file cleanup pass. Twelve generated data files changed; before/after hash inventories match exactly those twelve files. Feed and all cached shell/runtime bytes are unchanged, so shell 603 is retained.

The candidate preserves all 1,221 prior coverage IDs and adds 120 scoped provider fixtures, bringing the aggregate to 1,341. Non-Rugby facts and relative order are identical. All retained completed scores and their original fact clocks remain unchanged.

The 557 changed coverage records comprise 48 final-result changes, 118 schedule-only changes and 391 other metadata changes. The finals are 44 completions of retained schedules and four newly represented finals; this is not 557 new scores. Every final's identity, ordered participants, kickoff, completed status and numeric scores match captured public evidence. All 144 original score/status/source-clock checks pass. One final legitimately retains separate original fact clocks from primary and near observations of the same facts; a fresh poll is not substituted for the score's original observation.

The full quick/reconciliation path retains four exception reasons across three fixtures: incomplete original result/status observations for WR `0ddc414c-f126-4fa0-8065-55cb4ca34507`, unsupported identity/observations for the legacy Argentina–Australia Mendoza card, and unsupported identity for the legacy Australia–South Africa card. Their last-good facts remain; these are explicit deferrals, not newly verified results. Existing source dates remain visible. This is not full Rugby, sport or monetisable-MVP certification.

## Narrow repairs and retained failures

The first selected actual trial, [41058864818](https://github.com/hartican/sportscal/actions/runs/41058864818), correctly refused a 15-minute retained kickoff discrepancy, then a rollback write-scope error obscured that original reason. No generated changes were published. Its exact forbidden production path was not exported and remains unknown.

The reviewed calendar receipt permits only WR `731beb0c-e76a-4137-a739-cbeac9e1d862` to reconcile its retained 08:45 UTC appointment to the captured pre-match and completed 08:30 UTC appointment. Provider ID, ordered participants, score, status, timestamps, provenance and original receipt hashes are bound. Other discrepancies still refuse. This is a reviewed appointment correction, not a claim about actual played-start time or a general drift allowance.

Atomic rollback skips identical bytes, independently enumerates data and Feed, restores changed/missing baselines, removes new outputs, attempts remaining restorations and reports incomplete rollback while retaining the exact source exception. Original 82 caller, three actual-publisher and 13 diagnostic cases remain, with seven new actual rollback cases and 30 calendar controls. Integration source-coverage, reconciliation and publication checks pass on the exact combined source/data candidate.

[41062828921](https://github.com/hartican/sportscal/actions/runs/41062828921) failed before credential injection or any real request after 54 native controls passed. The old interruption fixture expected an unchanged baseline to be rewritten; an actual-module model reproduced that incompatibility with the skip-identical repair. The changed owned fixture now genuinely dirties its hash-checked rollback-only baseline before the original truncation/hang interception. Assertions, ordinary write permissions and native interruption/cleanup obligations were retained and subsequently passed. The hidden earlier Linux assertion was not recovered; this is a reproduced control defect and a passing changed qualification, not an invented traceback.

All earlier shared-shape refusals, source revisions and artifacts remain retained. TEST ONLY PR114 must never merge or deploy.

## Release handover

This document records a qualified candidate, not a completed production release. Required next gates are the unchanged normal 262 command occurrences and nine SQL commands, exact-main deployment, READY/SHA/alias and served-file binding, security headers, repeated fresh backend reads, A-League 12-club/156-fixture preservation and affected Rugby rendering/spoiler checks. Physical iPhone acceptance is separate; unchanged shell evidence must not be presented as a new device test.

Rollback uses the same single-publisher queue and preserves accepted facts, IDs and customer activity. No account reset, historical-follow restoration, source-clock refresh, scheduler replay or budget exception is authorised by this report. EPL corrections follow through the existing owner while ROOT owns this release.
