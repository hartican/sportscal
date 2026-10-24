# Temporary offline proxy and trace correction

25 October 2026 Sydney. **Source preparation only; no browser/native/cloud execution. New draft from frozen32ed; do not reopen or push closedPR49. Do not merge this diagnostic mode into47/main. ROOT owns exact review and one future allocation.**

## Evidence and limits

Original Linux CI40124555984 failed at offline reload with a WebKit internal error. The later diagnostic40126907863 (head32edb955, tested mergee8e493, tree6f368) reached every existing offline/cache/native saved-choice assertion, then failed its own isolation guard:29 external responses, zero route denials. Its critical queue held108 lifecycle records,103 pageshow, including the original100 synthetic resume events;128 critical entries were full and23 later facts were dropped. Ordinary events also overflowed1024 by1254. Late reset/reload/socket/terminal facts were lost. That run did not reproduce the original failure or log a crash. Bundled libsoup3.6.5 is an observed version, not a causal finding or authority to upgrade.

ROOT retained the closed49 artifact12573273306, SHA256926e9cd958ec463abfef19d8fc0ea39ef497fd93f53a4623b11aa946e749f1c1, under `/Users/jackhartican/Documents/AI/Codex/installed-offline-boundary-20261025/linux-diagnostic-32edb955-one/`. Existing81 group-cleanup guards and all earlier receipts remain. Diagnostic isolation and trace retention are the two changes here; the app/iPhone cause remains unknown.

## Deny-only proxy on the same owned server

Use the existing loopback origin HTTP server as the browser's diagnostic HTTP/CONNECT proxy, with bypass limited to its exact127.0.0.1:port. No new process, server, listener port, DNS lookup, upstream socket, certificate, credentials or system proxy/firewall configuration is introduced. Pure target parsing permits only owned relative/absolute HTTP requests with the exact owned Host and no credentials. External/invalid HTTP targets destroy their incoming socket before file serving. Every CONNECT tunnel is destroyed. GET canary URI and CONNECT canary authority are matched exactly and counted separately. No product header/body, worker, version, cache binding, original assertion/deadline or networkFailure behavior changes. CONNECT denial is attached to that same server before launch; ordinary requests still reach the existing transport fault.

`context.route` remains an independent secondary check, not the egress boundary. The only exemptions are the two fixed canary URLs in the dedicated preflight context. Main app routing has no exemption, and unrelated outside URLs remain denied. [Playwright documents interception limits with Service Workers](https://playwright.dev/docs/api/class-browsercontext#browser-context-route). The source-supported proxy option is passed by pinned WebKit as Linux `--proxy`/`--ignore-host`; [GLib supports exact IP:port exclusions](https://docs.gtk.org/gio/property.SimpleProxyResolver.ignore-hosts.html). Actual Linux proxy enforcement remains to be verified by the conditional preflight, not inferred from source controls.

## One invocation: preflight, then boundary only if verified

Before any app page executes, one disposable context opens a minimal same-origin diagnostic document that registers the **actual historical baseline worker**, without executing the app or loading outside images. Its real controlled page must show the exact owned controller/document, an activated592 baseline worker and its version reply. It then fetches only `http://ns-offline-http.invalid/proxy-proof` and `https://ns-offline-https.invalid/proxy-proof`. The exact canaries continue through the preflight route so an early route abort cannot masquerade as proxy evidence.

Both fetches must reject before their3000ms abort, **and** the actual server must have recorded at least one exact GET URI and one exact CONNECT authority denial during that phase. A resolved/timeout result, missing/mismatched denial, wrong controller/document/version/activation, any external response or context-close failure blocks the offline boundary. No automatic preflight retry is allowed. The preflight context closes before the original fresh app context is created, preserving its cache/account partition. Product worker/header bytes stay exact. New phase bounds are10s document navigation,30s control acquisition,1s version reply,3s per concurrent canary; the existing six-minute parent watchdog covers both phases. Original test step deadlines are unchanged.

Browser/network-process warm state and timing differ because of proxy/preflight/observation. If a security policy or engine prevents canary transport, the preflight fails closed; it is not bypassed and does not diagnose the old reload. Successful preflight is conditional permission to enter the existing boundary, never release acceptance. `.invalid` is the only outside destination before proof. No live provider/account is used.

## Preserve the late facts within the same caps

Lifecycle messages aggregate in ten fixed trusted/synthetic event-name counters, outside critical storage. All100 original resume dispatches and the original version-request coalescing assertion remain exact. The trace retains bounded activity with honest drop counts. Prelude critical records get at most half the existing128 slots; fixed late reset/reload/main-request/terminal/socket/error/cleanup keys have the other half. Repeated late keys keep their latest fact, count and first sequence, rather than evicting final error/cleanup. These are summaries, not a complete event history. The512KiB artifact cap and128 critical cap are unchanged. Byte-pressure trimming removes activity/snapshots, never silently evicts reserved critical facts.

Existing diagnostic-only success/check/artifact names, stdout64KiB prefix, `pw:browser` stderr256KiB tail, runtime/library metadata, six-minute bound and recorded-group cleanup contract remain. Forced/uncertain cleanup cannot report success. No runtime upgrade, new workflow/job or permission change.

## Source qualification

`node scripts/validate-installed-offline-diagnostic.js` passes152 deterministic guards on Node24.21.0: all81 retained plus71 transport/preflight/retention checks. New controls include exact Host/port/URI parsing, owned relative positives, external/invalid HTTP and all CONNECT denials with no upstream operation, exact launch bypass, dedicated canary route pass-through, unrelated/main-context denial, actual route→proxy-handler doubles, both-denial prerequisites, worker/document/version/activation and close failures, no repeat preflight and original app phase ordering. Existing cleanup controls still use their two disposable loopback servers; new transport controls use only doubles, no browser/DNS/external network.

A source replay of32ed drops the late reload error after100 synthetic resume events. The new replay counts all100 synthetic and the trusted event separately, floods normal/prelude records, then retains all fixed reset/reload/navigation/socket/error/cleanup facts;160 repeated socket facts aggregate without losing cleanup. Caps/drop counts stay honest. Six negative mutations are caught: prior route-denial bypass, swallowed original error, false release acceptance, proxy-denial bypass, canary-route abort and removal of the late reserve. Syntax, unchanged original assertion/timed-call source order, exact product bytes and diff checks pass. Source controls are not actual WebKit proxy or original-failure proof.

Evidence/output: `/Users/jackhartican/Documents/AI/Codex/offline-proxy-trace-20261025/`. The original81 cleanup adapter is unchanged by this delta.

## Handover and rollback

New isolated branch `codex/offline-proxy-trace-20261025` starts at32ed in the same original worktree. New draft targets unchanged `codex/sync-loading-release-20261025` at d31; do not reopen49 or push its branch. ROOT reviews frozen SHA/tree/full patch/delta/manifests first. Only then may ROOT add `pwa-offline-diagnostic` to the **new PR while draft**, and mark it ready once. The existing `ready_for_review` workflow performs one conditional preflight→boundary under the same watchdog; an unsuccessful preflight never enters the boundary. No cloud run is started by this handover.

Expected check: `OFFLINE DIAGNOSTIC - NOT RELEASE ACCEPTANCE (webkit)`. Existing artifact upload/one-day retention stay; the artifact contains preflight/proxy counters and evidence, lifecycle summaries, reserved late facts and cleanup proof. A green diagnostic cannot clear the failed release gate or establish an app fix. No automatic extra run, broad investigation or speculative runtime work is authorised. ROOT chooses any durable repair only from meaningful evidence, or leaves the cause unknown.

Rollback: close this temporary PR without merging and retain evidence. No product,47/main, customer choice, receipt/OFF/unfollow, DB, provider or automation rollback is required. Stop Ready for ROOT.
