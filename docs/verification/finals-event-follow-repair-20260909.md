# Finals, event exclusions and rating controls — 9 September 2026

Baseline: freshly fetched `origin/main` / production `252dc8985bf9260db5490481a67a2264e80a75a3`. Isolated branch `codex/finals-feed-reconciliation-20260909`; primary checkout preserved. Candidate shell v251.

## Reproduced causes

- Saved v19 accounts can contain an explicit AFL premiership choice and a derived disabled AFL parent. The parent vetoed the child. Specific premiership selection now wins over that derived parent, while child/competition/participant/fixture exclusions remain effective.
- Follow schedules only checked manual pins, displaying Add to Feed for automatically admitted finals. They now report In Feed.
- The public NRL Inspector had Sharks v Cowboys, 12 September at 19:50, while `/api/fixtures?ids=major-match:nrl-finals-2026:elimination-final-1` returned the old 5th v 8th provisional draw with no date/time. Live sources now start with the verified published competition fixtures. Shared overlay merging prevents a blank provisional draw from erasing a confirmed fixture; live scores and explicit schedule changes remain applicable.
- Event unfollow removed a positive choice without recording an exclusion. Onboarding migration could also reintroduce the choice. All Events Follow controls now persist explicit event-family exclusions, ahead of participant follows, collections and pins. Refollow removes that exclusion; saved card state is retained. Family choices outside the onboarding shortlist persist, generated children carry canonical family IDs, and ticket cards share their parent event family.
- A five-flame rating was laid out in an 84px grid column. The shared rating section now uses the available width, with 44×52px targets, 36×42px flames and 8px gaps.
- The worker separately cached modules already included in the runtime bundle. Removing duplicate copies reduces its precache from 3.20 MiB to 2.66 MiB (69 assets), below the existing 3 MiB budget. Standalone assets used by other pages remain cached. Offline contract tests now check actual source inclusion in the cached runtime as well as separate files.

## Evidence

- `validate-event-unfollow.js`: initially failed on onboarding re-follow and then on Cincinnati exclusion; now checks every published Events family, canonical aliases, server pin precedence and state preservation.
- `validate-event-unfollow-browser.js`: real Follow Event buttons for Cincinnati, Rugby League World Cup and Australian Grand Prix; US Open immediate removal, persisted exclusion after reload with failed APIs, refollow and preserved reminder/pin state.
- `validate-finals-parent-follow.js`, `validate-finals-live-overlay.js`, `validate-live-fixture-api.js`: actual AFL regression and all four confirmed NRL week-one games, server/browser policy parity, genuine exclusions, live results and postponements.
- `validate-finals-follow-browser.js`: actual Fremantle v Geelong and Sharks v Cowboys, named opponents, published time and In Feed label even after injecting a legacy NRL overlay.
- `validate-rating-flames-browser.js`: filled/unfilled ratings, drawer/card, sealed submissions, touch target dimensions and spacing at 320/390/768/1280px. Rendered 390px screenshot inspected.
- `validate-feed-repair-browser.js`: responsive expanded cards, 18 retained AFL/NRL finals, complete F1 results and standings, profile follow/Back and repeated tab navigation. Cards remain bounded to 60.
- Shared Follow decisions/parity, server Feed, fixture resolver, major events, card polish, feed controls, loading progress, source/venue, refresh lifecycle, ratings, startup budgets and runtime consistency checked.
- Existing `validate-vector-assets.js` reaches a pre-existing failure requiring the retired `traffic-${name}` control. The same assertion fails against the unchanged baseline HTML; the updated offline-module assertion passes. No traffic-control behaviour was changed in this repair.

No user records or notification settings were rewritten. These are isolated Chromium and server-contract checks, not physical iPhone or push-delivery proof. GitHub publication, READY deployment, matching releaseGitSha, alias bytes and live browser checks are verified separately during release.

Installed-PWA regression passed from historical cache-first v236 to v251: automatic catch-up, preserved preferences, optional request failure, required-asset failure retaining the prior shell, offline fallback and resumed upgrade.

Final-source 390px performance: median Feed readiness 441ms cold / 258ms warm, five critical requests, 1.12% critical gzip growth against the existing baseline (1.25% limit). The responsive pass mounted 26 cards at every tested width, below the 60-card ceiling. These local measurements do not substitute for real-device timings.
