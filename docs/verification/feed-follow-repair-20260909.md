# Feed and Follow repair — 9 September 2026

## Scope and provenance

Implemented the user-approved Restore Feed reliability plan and the added fixture results, standings and home-tag requirement. Started from freshly fetched `origin/main` at `b82ccef2fb8e315cc82287a066d719a37c798b16` on isolated branch `codex/feed-follow-reliability-20260908`. The outdated primary checkout and unrelated files were preserved.

Authoritative product rules are in [../follow-decisions.md](../follow-decisions.md); AGENTS.md requires future agents to consult and update that record. Shell version is 248. Preference policy and personalised caches are versioned together.

## Local acceptance

The complete canonical `node scripts/update-cards.js -p --local-only` pipeline passed, using its supported resume points during repairs. The final run resumed at `scripts/refresh-f1-results.js` and completed every remaining card, ladder, standings, editorial, schema and Follow audit. No separate refresh path was used.

The explicitly approved anonymised snapshot covered three saved profiles. No account names, email addresses, raw user identifiers or selected-follow lists are included in this record. The current direct/collection-follow union contains twelve retained tennis fixtures; all twelve have fixture-specific researched editorial. Four upcoming singles quarter-finals also have researched narratives and canonical QF badges. Other resolver matches are included in the research queue; this is not a claim that every tournament child has completed research.

Passed regression suites include:

- `validate-follow-decisions.js`, `validate-follow-policy-parity.js`, server Feed and followed-fixture hydration: empty preferences, migration provenance, women's competition scope, explicit collections, confirmed participation, mutes, tennis round boundaries and summary rejection.
- `validate-feed-repair-reconciliation.js`: 18 retained AFL/NRL finals across source, published Feed, server eligibility and Inspector hydration; deduplicated Grand Final; four upcoming researched tennis QFs; 22-row Monza results, replacement-driver identity and full driver/constructor standings. Published Spanish GP times are reconciled against the official schedule.
- Fixture timing and Feed boundary checks: seven local calendar days, twelve months, DST, multi-day and unknown scheduling. Historical source records remain available outside active Feed.
- `validate-promoted-replay.js`: completed published/personal 5/5, private personal promotion, Monza editorial recommendation, real-only high-priority research demand and no admission bypass.
- `validate-user-follows.js`, `validate-live-rating-alerts.js` with PGLite: authenticated directed ownership, no self/private/moderated follows, current distinct live raters, changed ratings, opt-outs, unfollows, 60-second grouping, one delivery per installation, retry limits, ambiguous outcomes, deep links, database RLS, trigger and atomic claims.
- `validate-notifications.js`: existing notification permission, cancellation, account fan-out and dispatch claim behaviour.
- `validate-feed-repair-browser.js`: 320, 390, 768 and 1280px, oversized contained logos, shared stages, action layout, no overflow, canonical participant profile navigation, quick Follow persistence, home race tag, full results with spoiler control, standings, Back position and repeated Feed/Events/Follow navigation.
- `validate-follow-recovery-browser.js`: failed directory and failed optional ratings requests, independent error/retry recovery, actual Watch/Remind/Chat controls with 44px targets at 320px, scrolling with at most 60 mounted cards and retained unsent chat draft.
- `validate-installed-pwa-upgrade-browser.js`: historical cache-first v236 shell automatically reaches v248; saved preferences survive; optional asset failure is tolerated, required asset failure retains the working shell, offline fallback and resumed upgrade work.
- Runtime bundle consistency and `git diff --check`.

## Performance evidence

Each viewport has three cold-network-cache and three warm-network-cache samples with synthetic saved preferences. These are local Chromium measurements with the audit server's production API reads, not physical-device or authenticated private-account benchmarks. The source fingerprint was checked after the final refresh.

| Width | Cold Feed median | Warm Feed median |
|---|---:|---:|
| 320px | 1018ms | 758ms |
| 390px | 1026ms | 728ms |
| 768px | 1043ms | 792ms |
| 1280px | 1037ms | 802ms |

`validate-feed-performance.js` passes the existing budgets. Critical requests remain 5; critical gzip size is 0.67% above the baseline. Maximum recorded layout shift is 0.0396 and maximum startup long task is 353ms. Long tasks still exist; this is not a claim that all main-thread work is below 50ms. Directory/profile chunks load on demand and Feed mounts a bounded window of 20-record pages.

Diagnosis found repeated timezone formatter creation, repeated preference/index reconstruction, repeated empty-rating paints and movement during partial startup hydration. Caching, bounded initial rendering, empty-batch cooldown and holding Now until user interaction address those paths.

## Database and delivery evidence

Additive migration `20260908120216_followed_user_epic_alerts.sql` was applied before application enablement. Production dispatcher health was read at 2026-09-08 14:50 UTC: the scheduled dispatcher completed with no error. That proves an existing scheduler invocation, not its precise frequency or physical push delivery.

No test followed a real person, posted a rating or sent a user notification. Physical push receipt, OS permission behaviour and real multi-device account propagation remain separate device acceptance checks. The server tests use synthetic identities and persisted test rows in an isolated local database.

## Release evidence

Local acceptance is complete. GitHub commit, Vercel READY deployment, releaseGitSha, production alias and live behaviour must be recorded separately after deployment; none is implied by the local results above.
