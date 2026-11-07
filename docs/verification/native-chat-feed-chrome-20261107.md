# Native Chat and Feed chrome continuation — 7 November 2026

Status: source committed; release blocked.

## Scope and preservation

- Repository: `/Users/jackhartican/Documents/AI/Perplexity/Sportscal`.
- Branch: `overnight/nothing-sport` throughout this continuation.
- Retained the previous implementation commits: `2c201b56`, `ffcc8350`, `bcc3a2c6`, `bfc327af`, `cf84c2fb`.
- Inspected the initial 84 dirty paths before editing. Saved their hashes and complete initial diff under the locally excluded `tmp/native-chat-resume-20261107/` directory.
- Preserved all 68 initially dirty data/feed paths byte for byte, including the original deletions. Existing broad-validator edits remain uncommitted.
- No model selection or configuration was changed. No tracked TODO file was found; work followed AGENTS.md and the named active plan.

## Changes and commits

`90ab1d58` — `test: gate native shell and isolate quick-refresh checks`

- Adds native-shell validation to the canonical update chain.
- Makes credential-dependent snapshot step selection deterministic under test.
- Runs quick-refresh regression fixtures in a temporary copy inside the repository, covering both a successful offline update and rejection/rollback of an incomplete result.
- Removes the preliminary `RESULT_COMPLETENESS_INPUT` redirect from the prior uncommitted implementation. The product gate always checks `data/events.json`.

`2c8fc633` — `fix: preserve mobile chat focus and scroll through sends`

- Keeps the composer node during failed sends and avoids asynchronous refocusing after success or failure. Tapping Send retains an already focused composer.
- Removes background inertness before restoring the opening control's focus; preserves Feed scroll with `preventScroll`.
- Rechecks scroll-follow intent in queued viewport frames so reading older messages survives settled keyboard samples.
- Completes the inherited version 272 shell synchronisation and deferred Chat-media cache URL.
- Adds native-shell browser regression coverage and updates existing Chat presentation tests for the sibling composer and visible-viewport offset contract.
- Updates the inherited Chat fixture/media validator for the native Return and modifier+Return contract and retained fixture examples.

## Final local verification

Node v25.9.0. The repository has no npm build script. `node scripts/build-app-shell-runtime.js --check` passed.

Twenty of the following 23 Node checks passed. Run each with `node scripts/<name>.js`; add `--check` for `build-app-shell-runtime`.

Passed:

- `validate-native-mobile-shell`
- `validate-shared-chat-ui`
- `validate-card-chat-viewport-release`
- `validate-private-fixture-chat`
- `validate-chat-fixture-media-plan`
- `validate-events-stakes-giphy-startup-release`
- `validate-header-loader-overlay`
- `validate-feed-ui-geometry`
- `validate-scroll-continuity`
- `validate-mobile-reliability-pass`
- `validate-mobile-feed-events-brand-pass`
- `validate-feed-sport-reliability-pass`
- `validate-backend-efficiency`
- `validate-chat-bulk-receipts`
- `validate-update-cards`
- `build-app-shell-runtime --check`
- `validate-hobby-feed-cache`
- `validate-hobby-feed-client`
- `validate-hobby-deployments`
- `validate-follow-policy-parity`

Failed:

| Command | Exact first failure |
| --- | --- |
| `node scripts/validate-server-feed.js` | `a selected Major Events child must resolve to the curated event in the authenticated Feed` (line 416; expected `rlwc-australia-new-zealand-2026` missing) |
| `node scripts/validate-f1-parent-feed.js` | `mute regression uses a sourced session field` (line 51; contextualised session has no participant IDs) |
| `node scripts/verify-nothingsport.js` | `new cards must render the compact contrast-colour dot` (line 330; expects the former card-renderer assignment) |

The broad-validator diagnostic also finds further old UI/offline-shell expectations and fixture gaps after that first assertion. It is diagnostic evidence only; the normal validator still fails. No assertions were suppressed in a release check.

Browser checks passed:

- `node scripts/validate-native-mobile-shell-browser.js`: 390×844, 430×932, 768×1024, 1280×900. Fixed Feed position/height, full-screen Chat, Return newline, Ctrl+Return sending, three simulated viewport cycles, scroll-back preservation, delayed send success/failure without refocusing, explicit Send focus, and close-to-Feed scroll/focus restoration. No page JavaScript errors.
- `node scripts/validate-chat-presentation-browser.js`: 320, 390, 768 and 1280px. Message receipts, scroll-back limits, stable message/composer nodes, avatars, links and simulated keyboard fit.

Browser dependencies, browser profiles and logs were placed inside the locally excluded task directory. Reproduce using `PLAYWRIGHT_MODULE=<repo>/tmp/native-chat-resume-20261107/browser/node_modules/playwright`, `PLAYWRIGHT_BROWSERS_PATH=<repo>/tmp/native-chat-resume-20261107/browsers`, a local server at `http://127.0.0.1:33958`, and repository-local `TMPDIR`, `XDG_CACHE_HOME` and `XDG_CONFIG_HOME`.

`git diff --check` passed. Full Node results are in `tmp/native-chat-resume-20261107/final-tests.json`; individual logs use the `-final.log` suffix. Browser evidence is in `browser-final.log` and `chat-presentation-final.log`.

## Canonical refresh blocker

Ran `node scripts/update-cards.js --local-only` in a repository-local working-source snapshot to protect the existing generated data. The first completed attempt stopped at:

```text
> node scripts/refresh-wrc-context.js
Error: WRC calendar ROUND/RALLY/DATE table was not found
node scripts/refresh-wrc-context.js failed with exit code 1
```

The official calendar returned HTTP 200 with no HTML tables, and its current calendar is for WRC 2027. The importer targets the retained 2026 context and expects a ROUND/RALLY/DATE table. An official-source season/format migration is required before this refresh can pass; substituting the new season has not been authorised by the Chat plan. Source: [WRC Calendar](https://www.wrc.com/en/calendar).

The final-source rerun also failed at that step, with the exact error `WRC calendar prerender data was not found`. The parser first requires `rb3-prerender-data-cache`, then the legacy table within that payload; the two responses failed at different requirements. Both failures remain blockers.

Initial failure log: `tmp/native-chat-resume-20261107/canonical-attempt-1.log`. The final-source failure is recorded separately in `canonical-attempt-2.log`. Source hashes and the code commit are in `final-source-manifest.json`.

## Release status and remaining acceptance

No push to GitHub main, deployment dispatch or Vercel production change was made. No deployed commit is claimed.

The normal deployment path remains GitHub main → `scripts/deploy-current-commit.sh` → serialized `sportscal-production.yml`, with exact-SHA, rollback and public-release verification. Its required server Feed and F1 checks currently fail locally.

The plan's physical iPhone Safari and standalone-PWA pass remains required: portrait/landscape, real keyboard dismissal, Safari toolbars, dictation/emoji, 200% text, long history, attachments and GIF picker. Browser Chat requests were mocked and viewport geometry was simulated; no live message or GIF was sent. Production alias/SHA, upgraded PWA and cold-start acceptance remain unrun.
