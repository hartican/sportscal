# Reminder failure reporting — 18 October 2026

The narrow repair makes reminder failures visible and retains accurate partial delivery totals. It does not claim to remove the production fixture-read delay.

## Observed problem

The existing read-only investigator separated an account-reconciliation snapshot timeout from a later Impact failure. No saved production response or query plan establishes the cause of either slow read. Controlled execution of the actual dispatcher reproduced two reporting defects: an Impact begin failure could return HTTP 200 with no last error, and an Impact finish failure could erase the reported count of an already completed guarded send.

## Scoped change

The existing dispatcher and Impact helper add fixed, sanitised phase timings around existing operations. The helper retains partial totals when a later operation fails, reports degraded outcomes, avoids double-counting a failed claim and preserves pre-claim budget deferral. Provider acceptance without a persisted guarded-send receipt remains uncertain; it is not counted as confirmed delivery or released for blind retry.

The three-second request cap, 27-second owner budget, two workers, eligibility/consent, account/erasure protection and claim/send fences stay unchanged. There is no new request, retry, source, scheduler, database schema or production write path. The shell and sporting data are unchanged.

## Local evidence and review boundary

Audit adopted the source owner's unchanged four-file patch, SHA256 `4827265cc7d7459e9450b8df32be7361afebd7813688906001f75109d33ecc35`, onto clean main `505d3053`. The source checkout was preserved. The owner's later frozen commit `d7fe3630238a40116df3ead04b75ceb2af404626` matches all four pinned review/integration hashes exactly. Audit separately binds all six focused checks to its integrated source hashes before publication.

Six focused checks pass on Node 24.21.0 with outbound networking blocked: Impact dispatch, incident recovery, the combined notifications/SQL suite, automatic reminders, schedule reconciliation and delayed dispatch capacity. The existing capacity case completes ten mocked reminders in about 24.1 seconds with at most two workers; this is not cloud or physical-device evidence. Earlier baseline failures and controlled before/after receipts remain retained.

The controlled actual-handler comparison changes the Impact begin case from HTTP 200 to 503 with an honest error; the final-receipt case retains one completed guarded send rather than reporting zero. The compared cases make the same number of requests. Existing SQL locking, uncertain outcomes, overlapping workers, stale reads, account isolation and duplicate-send protection remain covered.

Initial Standards review is clear. Spec review found one missing mixed actual-handler case: ordinary reminder success followed by an Impact failure. Audit completed that validator-only extension after taking back its ownership; source runtime files remain unchanged. All three failure phases now run with both an empty ordinary queue and one successful ordinary reminder. Assertions cover persisted ordinary receipt, separate API totals, combined health counts/status, exactly one contact per controlled send, privacy and uncertain outcomes. The affected recovery/SQL gate passes with networking blocked. Both final Spec and Standards reviews are clear, including the exact test-only delta. Initial review and failed baseline evidence remain preserved.

Independent Spec/Standards review, normal cloud gates, exact published SHA/READY/aliases/served-byte verification and public acceptance are required before delivery. At this source checkpoint publication is pending. No manual reminder send or live account/database probe is part of acceptance.

Evidence: `/Users/jackhartican/Documents/AI/Codex/nothingsport-operations-20261018/reminder-review/`. The later real-source Football timeout is a separate closed verification attempt; it does not establish reminder causality. Wider global Feed loading, genuine scheduled refresh success, physical-phone delivery and current original-profile playback remain open.


## Accepted production delivery

Published/deployed `0c287cedb6ef028c2944fd56ddea82b4ab4a1496`, app/cache 564. [Normal workflow 39120544113](https://github.com/hartican/sportscal/actions/runs/39120544113) passed all 225 safety commands, public membership/selected acceptance and seven security routes. READY `dpl_DETRjw2KZk1mxRKv4DFamoDsrt9W`, production alias, three aliases and ten served hashes match the exact SHA. Fresh served data retains 12 A-League clubs/156 fixtures and the original Tennis calendar.

Earlier `f65baf60` supplied the 16 spaced fresh reads and eight hosted A-League cases; relevant runtime/data/browser inputs are unchanged. These are retained dated evidence, not new executions or phone/delivery proof. No manual reminder send, account write or new production database probe was used for this release. The exact fixture-read cause, wider global Feed, current original-profile/playback and physical-phone evidence remain open.

Full Markdown/HTML and machine receipts: `/Users/jackhartican/Documents/AI/Codex/nothingsport-reminder-delivery-20261018/`. Source review retains the initial P2 gap and both final clear closures. The next stale-score/global diagnosis is separate and cannot retroactively establish this module's latency or notification reliability.
