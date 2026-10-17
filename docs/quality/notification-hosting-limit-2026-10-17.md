# Restore the intended notification hosting limit

17 October 2026 Sydney. Small configuration repair, accepted in production.

## Accepted production proof

Exact main snapshot `fb7d695cb40d4cdc124c5137bb1a49fc487c2117` passed [normal run 38970209671](https://github.com/hartican/sportscal/actions/runs/38970209671), including every required safety, private-input and public release gate. Fresh READY deployment `dpl_4s7oxqMWxPrgUse2DyEqpQdBYrYi`, release metadata and three aliases agree; five core served hashes match. Fresh deployment configuration explicitly retains both notification properties and matches every other published function setting. App/cache remains 560 with identical UI/data/handler bytes; previous app560 browser and upgrade/offline evidence is retained within its exact boundary. The required complete production workflow ran once; targeted local checks avoided a duplicate full local replay and unchanged browser rehearsal. No gate changed.

The normal list request took 4.75 seconds, with five displayed and five selected fixtures; its selected read took 387 ms. This ordinary observation is not a controlled comparison, cold-server or timed-phone proof. The existing normal release supplied its bounded reads; no warming or retry was added.

Evidence: `release-summary.json`, `public-match-timings.json`, normal `pipeline/` artifacts and private `production-run.log` in the output folder below. A timed 30-second termination, actual push receipt, effective old fallback and any cost or latency saving were not measured. Whole-sport certification and the retained World Cup profile failure remain open.

## Finding and scope

Verified: `vercel.json` declared `api/notifications.js` twice. Ordinary JSON parsing retained the later fixture-file inclusion and discarded the earlier `maxDuration:30`. The accepted app560 deployment's configuration also lacks that explicit limit. The handler exports no alternative duration. This does not establish the effective fallback duration, a customer failure, a billing saving or the cause of slow buttons.

Merge the two declarations so the existing notification route keeps both its required `data/code-inspector/*.json` inclusion and its intended 30-second hosting limit. Every other parsed deployment setting remains identical, including the separate dispatcher's duration. No handler, database, reminder policy, source, scheduler, polling, browser or dependency change.

[Vercel's duration documentation](https://vercel.com/docs/functions/configuring-functions/duration), checked 17 October, describes this setting as an execution ceiling. It is not a faster-response guarantee. Keep application/provider deadlines and the sole existing dispatcher unchanged.

## Verification and release boundary

The existing notification validator now parses the actual deployment configuration and requires both properties. It failed before the repair (`undefined !== 30`) and passes afterward, including its existing mocked registration, cancellation, permissions and dispatch scenarios. No real notification is sent. A parsed configuration comparison confirms the restored duration is the only effective hosting change.

All six final app560 UI inputs match the accepted frozen release exactly. Reuse its upgrade/offline and affected browser evidence within that byte-identical boundary. Do not repeat phone checks or change the cache version for this hosting-only repair. The normal serialized production workflow ran all required gates on the published snapshot and accepted the new deployment/configuration, as recorded above.

Local evidence: `/Users/jackhartican/Documents/AI/Codex/notification-function-budget-20261017/` (`regression-before.log`, `regression-after.log`, `local-change-proof.json`, `deployment-config-before.json`).

Business value: restore an intended resource guard and stop a later edit silently losing required settings. Effort: a few lines plus existing checks; no purchase or recurring owner task. Confidence is high for the parsed-setting defect. Benefits to actual notification delivery, latency and expenditure are unmeasured. Acceptance: scoped main snapshot, normal passing release, READY/alias/release proof, and the new deployment explicitly retaining both settings. No whole-sport or physical-device certification follows.
