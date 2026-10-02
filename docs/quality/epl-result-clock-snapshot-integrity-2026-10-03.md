# EPL result observation and snapshot integrity — 3 October 2026

## Verified defect and scoped repair

The ordinary production `live-premier-league` refresh at 2026-10-02T17:58Z advanced revision 7362 to 7363. Each snapshot contains 380 fixtures and 1,203,158 bytes of JSON. An aggregate comparison of every fixture key found changes only in `lastReviewedAt`, `sourceCheckedAt` and `canonicalSourceCheckedAt` (380 each), plus `scoreCheckedAt` and `resultSourceCheckedAt` (50 each). No sporting, result, identity, schedule or viewing fact changed. The hash omitted the first four clocks but still counted `resultSourceCheckedAt`.

Exclude that verification clock from the existing fact hash. Preserve the field in source payloads, original score-fact observations, genuine verification receipts and detection of real corrections, outcomes, result publication, identity, schedule, viewing and source URL changes. The existing owner, provider requests, retention, database schema, client shell and deadlines are retained. This is a reproduced maintenance defect under audit F01, not a new feature or coverage certification.

The checked-in regression uses the actual captured production final from both snapshots and its actual compact 3–0 score. It failed before the repair. Actual JavaScript store and PGlite publisher/readers prove stable full snapshot and compact tuple, a later genuine verification receipt, retained original observations and persistence of a newer corrected final. A previous hash algorithm creates one transitional revision, then identical reruns stabilise. Cloud and live proof must be recorded separately after publication; production savings are not yet verified.

## Value, acceptance and limits

- Business value: prevent repeated whole-season history growth while keeping trustworthy result corrections and freshness. Approximately 57.75 MB/day of raw snapshot JSON would be avoidable if 48 daily checks were otherwise identical. This is a conditional payload estimate, not allocated-disk, billed-storage or measured savings; compression, retention, genuine changes and other deployments affect actual growth.
- Effort: one small server module plus captured-data and real persistence regressions. No incremental service spend, subscription or owner routine.
- Dependencies: existing compact observation schema, normal release gates and exact published snapshot deployment.
- Acceptance: unchanged production checks after the one-time hash transition leave revision/payload history stable while genuine score verification advances. Real fact changes still persist; fixture IDs and last-good data remain intact.
- Local evidence: `/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/result-clock-integration-20261003.json`. Production discovery: `football-natural-observation-snapshot-diff-20261003.json` in the same folder.
- Certification: 0/3 Football pilots and 0/16 families certified. This repair supports the operations gate; commercial permission, competition acceptance and physical-device evidence remain separate requirements.

## Publication status

EPL timestamp-only snapshot repair shipped, 3 October: [acceptance](https://github.com/hartican/sportscal/blob/main/docs/quality/epl-result-clock-snapshot-integrity-2026-10-03.md), app `8fa3e907127b8848373ffad0dd98d1478f01edb7`, shell 386, [normal workflow 37046120485](https://github.com/hartican/sportscal/actions/runs/37046120485), READY `dpl_2pDN8dRuk9NtiGPqumD2bpWsCcJj`. Production target/three aliases/release metadata/22 served hashes agree at 2026-10-02T18:24:19.167Z. The ordinary 17:58 UTC refresh exposed 380 unchanged fixtures creating another 1.203 MB snapshot because 50 result verification clocks still changed the fact hash. Actual captured-final and SQL integration now prove stable snapshot/compact rows, advancing genuine verification, preserved original facts and accepted corrections. Both actual 384→386 cached upgrades pass, including concurrent main changes. One old-hash transition is expected; sustained ordinary production no-churn remains pending. No new spend, scheduler, migration or owner routine. This is an operations repair, with 0/3 Football pilots and 0/16 families certified; physical-device, independent recovery, permissions and cohort proof remain open.

Ordinary post-transition observation remains pending. Retain the original pre-fix comparison and conditional payload estimate; no allocation-saving claim.

## First ordinary transition observation

At 2026-10-02T18:30:26Z the existing owner completed a normal EPL check: revision 7364, 380 verification receipts, zero failures and no active lease. Compared with revision 7363, all 380 IDs and every sporting/result/schedule/viewing fact are unchanged; only the five previously identified check fields differ. Payload remains 1,203,158 JSON bytes. This is consistent with the expected one-time hash transition, not proof of sustained no-churn. Next due is 2026-10-02T19:00:26Z; a later ordinary unchanged observation must keep the revision stable. No refresh, scheduler, retention change or deletion was triggered. Read-only comparison: `/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/result-clock-natural-transition-20261003.json`.
