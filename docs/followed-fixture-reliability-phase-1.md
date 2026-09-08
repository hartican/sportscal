# Phase 1: followed-fixture reliability handoff

Implementation date: 8 September 2026. Branch: `codex/followed-fixture-reliability`, based on `origin/main` at `5a5ffe6809c80aefdd256ca22996c6a6dbf0b8f7`. Contract: [approved plan](followed-fixture-reliability-plan.md). Shell version: 245. No commit, push, shared-main merge or deployment has been performed.

## Delivered

- Monza no longer requires a populated two-player matchup to qualify. F1 championship sessions and senior WRC rounds bypass legacy stakes thresholds; practice is excluded from sport-only discovery. Other sports now use the shared eligibility rule instead of a separate stricter browser gate. Complete stakes removal/classification is phase 2, not claimed here.
- Cold Feed loading reconciles followed sport/team/athlete schedules independently of public pagination. Recent races can no longer sit invisibly behind months of future pages. AFLW/NRLW schedules are fetched separately even when their taxonomy parent is also followed.
- Partial/failed schedule reads preserve known fixtures, while explicit status updates replace the old status. Canonical AFL/NRL refresh, official follow-source refresh and canonical Feed publication preserve omitted known records by stable identity. Similar session names do not prove deletion. Existing validation failures leave the last published artifact intact.
- Core normalization, per-fixture enrichment and Feed/Event renderer fallbacks isolate malformed optional information. Unknown dates remain in an explicit Date unconfirmed timeline group. Cancelled/postponed status remains visible; withdrawals/unpublished records are not reclassified as public fixtures.
- Follow F1 opens a dedicated F1 Schedule. Canonical WRC identity overrides stale F1 keys for Sardegna branding and Australian viewing rights. Existing assets are reused; this does not claim the later all-sport official-brand redesign.
- New regression checks run within the canonical `scripts/update-cards.js` workflow. There is no parallel sport/standings refresh command.

## Verification

28 targeted local checks passed: runtime bundle, fixture visibility, snapshot publication, all-sport visibility, card lifecycle, server Feed, followed-fixture surfacing, coverage resilience, Follow-first, authenticated startup, Australian viewing rights, Schedule UI, requested sports, WRC, F1, identities/fallback lifecycle, Events UX, mobile brand contract, Feed reliability/controls, fixtures contract, UI foundation/reliability, startup/performance budgets, update orchestration and source resilience. `git diff --check` passed.

Browser acceptance uses isolated local preferences, blocked external API actions and a fixed 7 September clock at 390×844 and 1280×844. It covers cold Monza Feed presence, a shortened schedule retaining the race while postponing qualifying, failed source reads plus public-page revalidation, US Open with Tennis followed, F1 Schedule without rally rounds, and a visibly rendered minimal card beside an undamaged card. Expected injected failures are isolated; no uncaught page errors are permitted.

The installed-app harness passed a local shell 244→245 upgrade: saved F1/Tennis/NRL follows and display settings survive, optional asset failure is tolerated, missing required runtime retains the previous shell, offline navigation recovers and resume upgrades coalesce. This is simulated installed-browser proof, not Jack's signed-in account, physical iPhone, or push delivery.

Critical initial assets remain five requests. Compressed growth is approximately 1.02% against this branch's actual parent `5a5ffe6`, below the unchanged 1.25% per-release budget. The previous performance baseline was an older release; only the comparison commit was advanced. Precache is 2.98 MB, below 3 MB. No new claim about measured load-time performance is made.

The canonical network/data refresh was not run: this unit changes reliability and rebuilds scoped F1/Motorsport/WRC Schedule artifacts, not real-world fixture coverage. Local checks do not establish live source freshness or production readiness.

## Coverage findings and remaining work

All 27 published Schedule codes were reconciled against the shared candidate catalogue and the server's active-card output. The catalogue contains 3,710 candidates, including 695 released US Open fixtures. This proves transport of known eligible records, not completeness of external calendars.

- Cricket: 16 known fixtures, none dated 1–9 September. The missing early-September source coverage remains unresolved.
- Rugby: partial source coverage; one known fixture in that window. The broader international/women's coverage contract remains phase 2.
- F1: 30 known Schedule records, including Monza, but the season artifact remains truthfully labelled partial.
- Extreme sports, skiing, athletics, swimming, netball and boxing have no fixtures in their published Schedule chunks. Other partial schedules are reported by `validate-all-sport-visibility.js` rather than silently certified complete.
- Some Tennis source records still disagree between display-local date/time and exact UTC; unified timing/provenance correction remains phase 2. This unit does not claim that approximate times, reminders or seven-day compact retention have been redesigned.
- US Open renders with saved local Tennis follows. The reported account-specific Events failure and NSC `TypeError: Load failed` have not been reproduced on the user's real account. NSC replacement remains phase 4.
- Remaining phases: full Follow/stakes policy and cross-code coverage, live server snapshots/revalidation, all requested card/rating/tag/brand changes, toolbar/navigation/calendar changes, and the new Nothing Score ladder.

## Repeat focused acceptance

From this checkout:

```bash
node scripts/build-app-shell-runtime.js --check
node scripts/validate-fixture-snapshot.js
node scripts/validate-fixture-visibility.js
node scripts/validate-all-sport-visibility.js
node scripts/validate-server-feed.js
node scripts/validate-followed-fixture-surfacing.js
node scripts/validate-code-inspector-ui.js
node scripts/validate-feed-performance.js
git diff --check
```

Serve the checkout on `127.0.0.1:8765`, then run:

```bash
PLAYWRIGHT_MODULE=/Users/jackhartican/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright node scripts/validate-fixture-visibility-browser.js
PLAYWRIGHT_MODULE=/Users/jackhartican/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright PWA_BASELINE_SHA=5a5ffe6 node scripts/validate-installed-pwa-upgrade-browser.js
```

The temporary screenshots are `/tmp/fixture-feed-390.png`, `/tmp/fixture-feed-1280.png`, `/tmp/fixture-visibility-390.png` and `/tmp/fixture-visibility-1280.png`.

## Optional reviewed GitHub handoff

These are commands for review, not actions already taken. Check for subsequent edits before staging. Every intended source/generated/test/document file is listed explicitly:

```bash
cd "/Users/jackhartican/.codex/worktrees/b010/Sportscal"
git status -sb
git add 404.html admin-comms.html admin.html app-version.json \
  assets/js/app-shell-runtime.js config/app-shell-modules.json \
  config/card-identities.js config/card-lifecycle.js config/feed-timeline.js \
  config/fixture-identity.js config/follow-feed-policy.js config/follow-first.js \
  data/code-inspector/f1.json data/code-inspector/manifest.json \
  data/code-inspector/motorsport.json data/code-inspector/wrc.json \
  docs/followed-fixture-reliability-plan.md docs/followed-fixture-reliability-phase-1.md \
  index.html lib/calendar-catalogue.js lib/fixture-snapshot.js lib/server-feed-pipeline.js \
  participate.html privacy.html scripts/build-code-inspector.js scripts/lib/feed-utils.js \
  scripts/publish-feed.js scripts/refresh-canonical-sports.js \
  scripts/refresh-official-follow-fixtures.js scripts/update-cards.js \
  scripts/validate-all-sport-visibility.js scripts/validate-code-inspector-ui.js \
  scripts/validate-feed-performance.js scripts/validate-fixture-snapshot.js \
  scripts/validate-fixture-visibility-browser.js scripts/validate-fixture-visibility.js \
  scripts/validate-installed-pwa-upgrade-browser.js scripts/validate-server-feed.js \
  scripts/validate-update-cards.js service-worker.js terms.html
git diff --cached --check
git diff --cached --stat
git commit -m "Protect followed fixtures and correct F1 Schedule routing"
git push -u origin codex/followed-fixture-reliability
```

## Production boundary

Review and explicitly approve the shared-main merge first. Recheck the resulting main snapshot and any intervening work before deployment. Do not deploy the raw working directory. The existing helper materializes an immutable commit, excludes unsafe content, checks the linked project and records `releaseGitSha`:

```bash
git fetch origin main
NS_DEPLOY_REF=origin/main NS_DEPLOY_DRY_RUN=1 ./scripts/deploy-current-commit.sh
```

Only after production approval and successful merged-snapshot acceptance:

```bash
NS_DEPLOY_REF=origin/main ./scripts/deploy-current-commit.sh
phase1_release_sha=$(git rev-parse origin/main)
vercel list sportscal --scope harticans-projects --meta "releaseGitSha=$phase1_release_sha" --status READY --json
```

Finally verify that the production alias serves this exact READY deployment, shell 245 and the requested Feed/Follow behaviour. READY metadata alone does not prove the user's account/device issue is resolved.
