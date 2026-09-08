# Compact Feed and Follow carousel repair — 9 September 2026

Baseline: freshly verified production/origin main `ac2293c10057d14fc7288445c7471bc7d4167bb4`. Isolated branch `codex/compact-view-repair-20260909`; unrelated primary checkout preserved. Candidate shell v250. Follow admission decisions are unchanged.

## Reproduction and changes

The compact browser regression reproduced 50px cards inside 300px Feed slots. Mounted slots now use the actual card height. Unloaded slots have a compact estimate, and changing density clears measurements from the previous mode. Compact Tennis previously reused the full matchup names/flags in a narrow single row. It now uses shortened names with full accessible labels and canonical profile links, retains all four doubles players, and gives timing its own line at narrow widths. Team logos use compact dimensions, text truncates within each side, and the expand button has reserved space.

The Follow carousel reproduction could not click Next sports: an `identity-image-placeholder` intercepted the pointer. Its absolute positioning used the whole sticky carousel as its containing block, also stacking fallback wordmarks at the bottom. Each 40px sport icon now establishes its own containing block, clips decorative content and does not intercept input. Fallback glyphs receive the actual sport metadata.

## Validation

- `validate-compact-feed-browser.js`: compact slot/card geometry, Tennis name bounds, repeated density changes, saved compact preference after reload, four-name doubles, no horizontal overflow and Feed/Events navigation at 320, 390, 768 and 1280px. Dark-mode screenshots were inspected.
- `validate-follow-carousel-browser.js`: Next/Previous clicks, native Chromium touch swipe, visible sport selection, correct selected state/content, saved sport/page after reload and failed-logo fallbacks. A 390px rendered screenshot was inspected.
- `validate-feed-repair-browser.js` at 390px: expanded logos/actions, full F1 results and standings, profile Follow/Back, retained AFL/NRL finals and repeated tab navigation.
- Exact-source performance validator: five critical requests, 0.96% critical gzip growth against the existing baseline (1.25% limit). Local 390px Feed medians: cold 443ms, warm 248ms. These are synthetic signed-out Chromium measurements, not physical iPhone timings.
- `validate-installed-pwa-upgrade-browser.js`: historical cache-first v236 shell to v250, saved preferences, optional/required request failure, offline and resumed upgrades.
- `git diff --check` and runtime bundle consistency.

No sports data refresh or database migration is required for these rendering fixes. GitHub SHA, READY deployment, releaseGitSha, alias, exact public bytes and live browser checks remain separate release evidence in the task. Physical iPhone input and OS behaviour are not directly observed by these tests.
