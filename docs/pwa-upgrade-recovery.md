# Installed-app update recovery (shell 244)

The reported iOS home-screen layout matched the old interface while ordinary Safari at the same production origin showed the current interface. The exact version on that physical device was not inspected.

An actual shell 236 installation reproduced the defect against release 243: its first navigation returned 236. That worker used cached HTML first, and its page coordinator deliberately did not reload after controllerchange. Testing only the much newer network-first release 241 missed this upgrade path.

## Repair

- The activated worker probes controlled app pages. Pages supporting the new protocol save their route/position and chat draft, wait for writes/editing to finish, and perform one guarded reload. Older pages that cannot acknowledge the protocol receive one same-origin navigation. No preferences, login, calendar URLs or account storage are cleared.
- Registration and checking run independently of Feed hydration and window.load. Startup, pageshow, foreground visibility and reconnection share a throttled, retryable check. Network and registration checks have deadlines. Settings shows the running version and Check for updates; it reports Up to date only after confirming both the published version and worker version.
- app-version.json contains the shell version only. It and service-worker.js bypass HTTP/CDN caching. The version request bypasses Cache Storage too.
- Required HTML/JS/CSS remains installation-gated. Optional images and data cache on use, so an optional image failure cannot block migration. A failed required download retains the last valid worker. Cache cleanup is restricted to superseded Nothing Sport shell caches.

## Evidence and repeatable checks

Run browser checks with PLAYWRIGHT_MODULE pointing to the available Playwright installation. The legacy harness serves exact Git blobs on demand; it does not relabel the candidate as an older release.

- scripts/validate-installed-pwa-upgrade-browser.js: defaults to actual 236; PWA_BASELINE_SHA=878c253 exercises actual 243. PWA_KEEP_OPEN=1 keeps the old page alive during deployment. PWA_BROWSER=webkit selects WebKit. Tests cover automatic migration, explicit follows, optional/required resource failures, unreachable-origin navigation, 100 coalesced pageshow events, subsequent resume updates and preserved drafts/preferences.
- A legacy cache-first worker can necessarily return the old first document. Acceptance is automatic convergence without a second user launch. Newer network-first baselines must also receive the current first document. Both paths limit automatic navigation to one per update.
- scripts/validate-app-update-browser.js: Settings at 390/834/1440px, confirmed version, 44px controls, offline messaging, transient registration failure and a deterministic held write response. The held write is a local transport fixture; it never submits a real contribution.
- Existing UX journey/resilience/account checks retained 28 eligible fixtures before navigation and reload, passed 100 Compact/Expand interactions (45ms maximum measured response), and recorded 0px anchor movement in the tested card/image/NSC/clock cases.
- Repository, mobile, card/chat, bundle and diff checks pass. The static-byte budget now compares against this repair's actual base 878c253, keeping the existing 1.25% ceiling. The previous fixed 5a35299 baseline already failed for unmodified release 243; this repair adds approximately 0.65% gzip bytes and one deferred request.

Desktop WebKit completed the legacy upgrade, unreachable-origin fallback and resume scenarios. Its browser-level setOffline navigation produced an internal error, so actual transport failure is tested separately from the offline indicator. The open-page interrupted-update scenario timed out once at the 45-second resume bound, then passed on two diagnostic reruns. This is Safari-engine evidence, not proof on a physical iPhone or of iOS process restoration.

## Release acceptance

Publish the scoped commit, deploy that exact snapshot, and match the READY production deployment's releaseGitSha and nothingsport.vercel.app alias. Check the public HTML, worker and version endpoint agree on 244 and the version/worker cache headers forbid stale HTTP reuse. Repeat Settings and current-shell checks against the public alias. Physical confirmation on Jim's home-screen installation remains a separate final check.

## 27 September: unread Feed prefetch blocked Chromium activation

The 319 → 320 browser upgrade repeatedly left worker 319 active with 320 waiting,
although page requests and explicit worker `waitUntil` promises had finished.
A minimal page upgraded immediately. Draining proxied data responses isolated the
failure to Feed traffic; draining only navigation or image/script responses did
not fix it. `warmNextFeedPageDuringIdle` fetched the next page but ignored its
body. The original browser scenario passed after consuming that body in the
page, without changing historical workers or removing activation waits.

Release 321 drains successful prefetch bodies, cancels unsuccessful bodies and
bounds the request to eight seconds. The existing full upgrade regression is the
correct test seam: a shallow mocked fetch test would not reproduce Chromium's
worker/stream interaction. Use `PWA_BASELINE_SHA=c263209` for the actual prior
release; use `PWA_BROWSER=webkit` for the second engine. Physical installed-device
behavior still needs separate proof. No diagnostic worker wrappers ship.

## 30 September: exact runtime cache URL mismatch

The 337→338 rehearsal caught a later offline/resume failure in Chromium: a new worker activated but the page stayed at the prior version. Diagnostics showed `metaByKey` initialization failing before the update callback was registered. The install manifest still requested runtime `?v=336` while the document requested `?v=338`; offline fallback could serve the HTML without its exact runtime cache entry. WebKit happened to pass and alone would have missed this defect.

The repair synchronises the install URL with the document. `validate-shell-script-cache.js` fails on the original mismatch and checks every critical local script URL, including its query string, against the worker install manifest. It is a required production gate. The callback-ready experiment did not fix the actual failure and was removed; no update-handler change or diagnostic instrumentation ships. The full installed-browser upgrade rehearsal remains necessary alongside this fast structural check. Physical-device restoration is still separate evidence.
