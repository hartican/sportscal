# Public Feed native qualification harness

24 October2026 Sydney. **Native harness review repairs prepared for ROOT's existing review pair; native execution pending ROOT allocation and coherent PR37 integration. Public Feed remains Working.** The initial `d4c42c3e` harness was a separate test-only delta after reviewed `f1724b6b`. The later review repair below includes explicitly authorised, value-free async settlement signals in the existing lazy UI owners; it is no longer wholly test-only. SQL/migration remain identical to tested `e14550f6`. No dependency, workflow, publisher, account, credential or service operation is added.

`scripts/validate-public-feed-browser.js` serves the actual app files on an ephemeral loopback port and boots the actual app, SDK, public tray, notification route, media picker and shared card renderer. It does not rewrite HTML, replace the renderer/adapter/SDK/fetch/clock, or suppress personal-state writes. Test data provides a disposable signed-in account and explicit synthetic fixture/Feed admission. Forwarding spies record calls to the real personal card, engagement and seen owners; state snapshots compare preferences, actions, card choices, Results, opened/seen sets, mounted Feed slots and current tab.

All API responses and GIPHY search/media responses are synthetic Playwright route fixtures. Every other external origin is explicitly denied, and the static server never proxies API requests. Fresh browser contexts isolate storage; service workers are blocked for these UI cases. Existing installed-PWA, managed API/database, true provider, push and physical-phone gates remain separate. No real sports facts, identities, account sessions or GIF credentials are used.

## Required combined-source dependency

The script checks actual `config/venue-panel-ui.js` for the reviewed `options.cardState` / `options.onCardStateChange` contract before requiring Playwright, creating an HTTP server or launching a browser. Without it, exit2 reports `DEPENDENCY_PENDING`. Runtime checks then require actual opened/selected card states and exercise the real More/Less callback through a disposable public-alert host, with no saved state writes. There is no substitute adapter or copy of another worker's renderer.

Only the final ROOT-combined checkout qualifies. Do not patch, copy or integrate PR37 in the Public Feed worker to make the test pass. The current isolated Public Feed branch intentionally lacks that dependency. A pure `--preflight` at `f1724b6b` returned the expected dependency-pending exit2 before Playwright/native/server startup; its receipt is in the owner's external `public-feed-20261024/native-harness-preflight-f1724b6b` directory. This is a dependency check, not a browser pass.

## Native cases

The default matrix runs Chromium then WebKit sequentially, at390px with touch taps and1280px with pointer clicks. Each context also permits native keyboard input. Every case must complete; no native case has run in this implementation lane.

- Signed-out and anonymous accounts cannot expand/read a discussion or open an alert destination.
- Inline expansion of an actual full card, escaped text/emojis, one-level reply ownership, positive/negative/switch/remove votes and no upload control.
- Private/public/private picker ownership, native hit targets, dialog containment, attribution, keyboard search, pagination with first-page selection, correct private-reference/public-GIF command, focus return and native Escape closure.
- The24-point boundary blocks provider contact in public and private contexts;25-point positive selection is exercised separately.
- Canonical alias destination through the actual shared adapter, native More/Less collapse/reopen and unchanged saved card/Feed choices.
- One scroll owner for the entire fixture and tray, actual wheel movement, Results OFF with a real Results ON control, live higher-ranked insertion, native anchored geometry/focus, keyboard voting and a live hard-delete delta.
- Held real HTTP provider success/error, reopen/lifetime fencing, detached old control callback, current failure/Retry and current selection. Live controls use native input without force; the intentionally detached callback uses a labelled synthetic invocation because it has no native hit target.
- Delayed configuration after native close, DOM detach and a real SDK account-lifetime change cannot contact the provider or steal the private picker.
- Actual SDK403 handling clears cached rows/draft/composer and fences a late vote acknowledgement; ordinary503 retains draft/content and backs off.
- A discussion URL on cold boot uses the actual deferred route with current Results, without ordinary Feed mounting or saved/open/seen/admission writes; removed membership fails explicitly.

This is UI behavior with synthetic transport, not browser-to-real-Postgres end-to-end proof. Account switching is a deliberate test input; it does not certify cross-device account recovery. Source/JSDOM/API and real isolated SQL gates remain required independently.

## ROOT execution after allocation

Use the existing Node24.21.0 and Playwright1.62.1 installation with both corresponding browser engines. Playwright remains outside project dependencies. Default launch uses Playwright's installed Chromium/WebKit, with no Mac Chrome path or branded-channel assumption. No installation is performed by this script.

In ROOT's exact combined checkout, with `PLAYWRIGHT_MODULE` already set to its existing package directory:

```bash
node --check scripts/validate-public-feed-browser.js
PUBLIC_FEED_OUTPUT="$ROOT_PROOF/public-feed-native" node scripts/validate-public-feed-browser.js --preflight
PUBLIC_FEED_OUTPUT="$ROOT_PROOF/public-feed-native" node scripts/validate-public-feed-browser.js
```

`ROOT_PROOF` must be an allocated absolute output directory outside the source checkout; on this Mac the owner convention is `/Users/jackhartican/Documents/AI/Codex`. A Linux runner can set its existing temporary artifact directory. There is no workflow dispatch or production workflow requirement for this harness.

Optional portable controls, only within ROOT's allocation:

- `PUBLIC_FEED_DEADLINE`: absolute ISO deadline, capped by the harness's ten-minute maximum. Expiry closes the browser.
- `PUBLIC_FEED_CHROMIUM_PATH`, `PUBLIC_FEED_WEBKIT_PATH`: existing compatible engine executable paths. `PUBLIC_FEED_CHROMIUM_CHANNEL` optionally selects an already installed channel; it is unset by default.
- `PUBLIC_FEED_ENGINES` / `PUBLIC_FEED_WIDTHS`: focused diagnosis only. Defaults are `chromium,webkit` / `390,1280`. A changed matrix is explicitly labelled partial, not full acceptance.320px and768px may be run additionally when allocated.

Entry requires4.5GiB free and runtime preserves3GiB. The script starts engines serially, uses isolated contexts, releases held routes, closes browsers/contexts/server in finally paths and writes an external receipt even on dependency failure. Browser waits are bounded15seconds, navigation30seconds, held-boundary entry15seconds, and the overall watchdog uses ROOT's earlier deadline. These are harness resource limits, not permission for an unallocated native run.

Artifacts are `receipt.json`, per-case screenshots and Playwright traces, plus stdout/stderr captured by ROOT. Receipts bind SHA/tree/dirty status, actual file hashes including this harness, Node/platform/architecture, installed Playwright and actual browser versions, case results, failures and denied external origins. Preserve failure logs/traces rather than rerunning unchanged source to green. No screenshot/trace or native pass exists yet.

The original implementation lane ran only Node24.21 syntax and diff checks plus the expected pure dependency preflight. ROOT review, actual combined-source Chromium/WebKit execution, managed schema/API activation and hosted freshness, complete erasure/storage workflow, real provider and physical-phone/push acceptance remain pending. No Ready or deployment claim follows from the original test-only handover.

## Source review repairs after `d4c42c3e`

DEPLOY identified three acceptance gaps without executing the native harness: writes only recorded POST and exempted all chat actions; held late acknowledgements used fixed sleeps; and public fixtures never paginated. The local repair addresses those exact gaps, without running a native engine, database or service or pushing source.

Every mutating method now enters the same audit, including non-API and external-origin attempts. The fixture rejects unlisted methods/actions, account writers, wrong public fixture/target, non-owned deletions, extra fields and GIF references without the current account's explicitly observed private membership/points. Only exact public post/vote/delete and private GIF/read/delivery commands are permitted; one deliberate synthetic sign-in has a narrowly consumed test intent. Every case audits all records. Native negative controls intentionally issue forbidden PUT/PATCH/DELETE, an unlisted chat POST and wrong-owner/foreign-delete commands; only their exact rejected record indices are expected. No path-wide chat exemption remains.

`validate-public-feed-browser-fixtures.js` imports the exact native fixture functions and exercises allowed/forbidden methods, action/owner/target/permission checks, three25-root pages, three25-reply pages, scoped issued cursors, malformed/oversized/stale/future queries and bounded100-entry delta drains. These are pure fixture tests, not API/database proof. Baseline modes evaluate the actual reviewed `d4c42c3e` API/audit functions and reproduce each old failure:

```bash
node scripts/validate-public-feed-browser-fixtures.js
node scripts/validate-public-feed-browser-fixtures.js --reviewed-baseline --case=POST
node scripts/validate-public-feed-browser-fixtures.js --reviewed-baseline --case=PUT
node scripts/validate-public-feed-browser-fixtures.js --reviewed-baseline --case=PATCH
node scripts/validate-public-feed-browser-fixtures.js --reviewed-baseline --case=DELETE
node scripts/validate-public-feed-browser-fixtures.js --reviewed-baseline --case=pagination
```

The current pure checks passed. All five historical controls fail for their intended cause: missing chat-action rejection, missing method record or unbounded root page. An initial POST-control cross-realm assertion was corrected before accepting that control; the corrected failure is the original chat exemption's missing expected rejection.

The native suite uses the actual root/reply continuation buttons against52 roots and57 replies, verifies25/25/2 and25/25/7 page sequences and current cursors, checks3-reply previews and query rejection through the real SDK, and observes the mounted tray consuming a101-entry live delta in bounded batches. The fixture now respects ranking, per-parent scope, revision-bound continuation and the existing25/3/100 budgets.

For held configuration/provider/vote paths, the harness requires `requestfinished` or `requestfailed`, completion of its route handler, and a completion event from each exact original async DOM owner. Resource/body delivery alone is never labelled application settlement. The originally held picker/host is retained even after it is detached; tests cannot mistake a newer operation's completion for the old one. Receipts record transport terminal state and observed value-free owner completion counts. Every held operation must satisfy this barrier before a successful case can close its context. The remaining timed503 check is explicitly a retry-window observation after a rendered error, not a substitute for async settlement.

The smallest product observability change is in `finally` of the real lazy tray write/GIF owners and existing media search owner: `ns-public-comment-write-settled` / `ns-public-comment-gif-settled` on the existing discussion host, and `ns-chat-gif-search-settled` on the original captured picker. They are ordinary value-free Events with no detail, identity, draft, provider or payload data. Protected dispatch cannot change the operation's outcome. They add no timer, request, store, state owner, export or SDK/fetch/renderer replacement. The normal public UI asset is rebuilt from that source; version/cache allocation remains ROOT's integration responsibility.

The affected source tests add ended-config/replaced-search settlement, observer-failure preservation and late real-SDK write completion after erasure denial. New `--settlement-baseline` controls read immutable `d4c42c3e` sources rather than the separate older behavioral baselines:

```bash
node scripts/validate-public-comment-picker.js --case=settlement --settlement-baseline
node scripts/validate-public-comment-picker.js --case=search-settlement --settlement-baseline
node scripts/validate-public-comment-erasure-access.js --settlement-baseline
node scripts/validate-public-feed.js --light
```

All three historical controls failed for their intended missing original-owner completion event (observed0 rather than1). Current source passes the full light suite, including all ten existing-picker cases and actual Auth/API/SDK erasure-denial DOM coverage; SQL engines are explicitly excluded. The pure native fixture checks, affected-file syntax and generated public UI asset check also pass. The actual picker-shaped GIF positive control ensures the write audit accepts the existing media module's input shape before server normalization.

ROOT supplied JSDOM26.1.0 from the already-declared dependency and existing offline cache, outside project source; the owner used that path and the existing Node24.21.0/runtime dependencies without an install or lockfile change. The earlier missing-module attempt is a setup failure, not a causal RED. The final light and independent search-settlement baseline receipts/logs are in `/Users/jackhartican/Documents/AI/Codex/public-feed-20261024/native-harness-review-repairs-2026-10-24T02-46-47-704Z`. They record the pre-commit `d4c42c3e` HEAD and dirty repair scope; the accompanying frozen-source receipt binds the final local review commit separately. No native/browser/server/SQL execution or source push was performed for these review repairs. Final source review must include the explicit small product observability delta, and the original PR37/native/hosted/full-erasure/phone gates remain open.
