# Follow overload and missing fixture repair — 9 September 2026

## Baseline and decisions

Follow-up to production commit `774e79ed141b343456762e3ba07bcf00d29f0acb`, on isolated branch `codex/follow-directory-recovery-20260909`. Fresh origin/main was verified before editing and again before release. The outdated primary checkout and unrelated files were preserved. This record covers shell 249; the earlier shell-248 acceptance remains historical.

[Follow decisions](../follow-decisions.md) records the user's stricter Cricket/Rugby/Tennis admission, separate women's consent, curated directories and explicit F1 confirmation. It remains mandatory reading through AGENTS.md. No real user follows, ratings or messages were created for testing.

## Reproduced causes and repairs

- Broad Cricket/Rugby follows admitted every senior international and domestic knockout fixture. They now require explicit participants or competition selection; broad Tennis follows do not bypass player/collection follows, including finals.
- Published India A Women and Australia A Women IDs were replaced by inferred senior national IDs. Published participation is authoritative; reserves and women's teams cannot inherit a men's team follow. Unknown Namibia imagery no longer borrows South Africa's crest.
- Cricket followed by Tennis could leave a downloaded Tennis directory stuck on Loading. A collection request owned the load, while its completion callback checked an obsolete Follow section. Completion now redraws the current view; failed requests expose retry and do not retry indefinitely or produce unhandled rejections.
- Opening Follow downloaded the complete Tennis Inspector (4,281,717 bytes) or Cricket Inspector (1,687,645 bytes) merely to test standings availability. The manifest now carries that flag. Lightweight followed schedules and directory/profile chunks load independently.
- Background live refresh fetched 7,538,741 bytes of unrelated fixtures in the production reproduction. The browser now requests at most 60 mounted fixture IDs and pauses this refresh on Follow. The API filters the response and includes the requested scope in its revision/ETag. Failed refreshes retain last-good data.
- Preference v21 and versioned personalised, live, directory and followed-schedule caches prevent reuse of former broad admissions. Ambiguous AFLW inheritance is removed only from pre-v20 parent selections; v20/v21 explicit choices and explicit participant/competition choices remain.

## Acceptance evidence

`node scripts/update-cards.js --follow-ui --local-only` rebuilt retained canonical Follow/Inspector projections and runtime, then validated curation and the scoped API. No independent ladders/standings refresh was used. This follow-up did not rerun the full external sports refresh pipeline or change historical scoring records.

Passed: curated directories, national identities, Follow decisions, policy parity, Follow-first, followed-fixture resolver, server Feed, live fixture API, calendar/DST boundaries, all-sport visibility, fixture reconciliation and EPIC alerts (including isolated PGLite RLS, triggers and atomic claims).

Browser acceptance covers all twelve distinct unwanted fixtures shown in the six user screenshots, Cricket (24 default teams) and Rugby (35 default teams) with Australia first, Tennis first-load and failed-request recovery, 18 retained AFL/NRL finals and 20 retained F1 race/qualifying fixtures. F1 does not require a driver follow. The fixture test scrolls each expected fixture into view and checks the actual card, with at most 60 mounted cards. The other responsive suite checks complete Monza results, standings, home tag, quick follow and Back restoration.

Failure/recovery tests passed with unavailable directory and optional ratings requests, 320px Watch/Remind/Chat controls, retained unsent draft and bounded long scrolling. A historical cache-first installed shell v236 upgraded automatically to v249; preferences survived, optional failure was tolerated, required failure preserved the working shell, and offline/resumed upgrades passed.

## Measurements and limits

Local Chromium, isolated signed-out synthetic saved preferences; three cold-network and three warm-network samples per viewport. The test server proxies read-only public production APIs. These are not physical iPhone or private authenticated-account benchmarks.

| Width | Cold Feed median | Warm Feed median |
|---|---:|---:|
| 320px | 471 ms | 235 ms |
| 390px | 459 ms | 249 ms |
| 768px | 469 ms | 244 ms |
| 1280px | 496 ms | 275 ms |

The exact-source performance validator passes: five critical requests, critical gzip growth 0.84% against the existing baseline (limit 1.25%), maximum CLS 0.0396. Longest recorded main-thread task: 88 ms. Long tasks are not eliminated. Source fingerprint: `ef50ea402460341350047d43521c74bd63aa5592b15125e5729364ea82279727`.

A separate 390px test with 4× CPU slowdown loaded Cricket in 383 ms, Rugby in 248 ms and Tennis in 298 ms, with zero page errors and no full Inspector request. The production baseline Tennis reproduction remained stuck after 13.4 seconds despite its directory response arriving. Local and production network conditions differ; these are diagnostic observations, not a claimed device speedup ratio.

GitHub push, Vercel READY status, exact releaseGitSha, alias and live browser proof are separate release checks recorded in this task after this local acceptance snapshot. Physical push delivery and the user's installed iPhone behaviour cannot be inferred from browser or server records.
