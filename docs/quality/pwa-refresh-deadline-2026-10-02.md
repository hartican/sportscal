# Installed app cached-refresh deadline — 2 October 2026

Status: local response-body regression and full Chromium/WebKit 351→352 upgrades passed; exact production release pending. Candidate shell 352. This is a bounded reliability repair, not physical-device acceptance or attribution of the earlier intermittent full-app timeout.

## Reproduced failure and repair

A minimal local page using exact historical worker 350 and published worker 351 serves and drains valid last-good JSON, while its canonical-data background refresh receives headers and an unfinished body. The new worker remains installed/waiting. A completed-response control activates normally; ending the held response permits activation. This demonstrates a real lifetime mechanism. The previous full-app timeout did not retain pending-request evidence, so its cause remains unverified.

The actual regression `PLAYWRIGHT_MODULE=<installed Playwright module> node scripts/validate-worker-refresh-deadline-browser.js` failed on the current worker before the repair: “The worker must abort the stalled headers/body without waiting for server release.” The repaired stale-while-revalidate path uses one eight-second deadline through the complete cache write, rather than stopping at response headers. Cached refreshes consume the network response directly, avoiding an unused tee branch. Partial/aborted bodies do not overwrite valid cache entries. No retry or extra request is added.

The real Chromium regression then passes three cases: a stalled successful body permits successor activation without server release; the same stall preserves last-good cached JSON; a stalled uncached request ends with an explicit 503. Each makes one request and finishes its stalled connection in approximately eight seconds. A fast body/cache regression also joins the normal production workflow. The full upgrade harness retains its assertions for current standings, profile code, saved selections/preferences, unsent drafts, required/optional failures, offline restart and resumed updates.

## Scope and limits

This repair applies to existing stale-while-revalidate canonical/football/directory/default GET routes. It does not redesign navigation, asset caching, APIs, notifications or the source scheduler. Already installed historical workers cannot acquire this deadline until upgraded; ending a held old request or closing/reopening the page remains necessary for that particular blocked transition. No forced storage clearing is proposed.

Business value: reduce the risk that a poor connection leaves an installed app displaying obsolete facts. Additional service cost A$0; no recurring owner task, provider request, database change, new league or subscription. Acceptance: the real response-body regression passes, cache URLs/epochs agree, both full engine upgrades and normal cloud gates pass, and exact published/READY/alias/served proof is retained. Physical iPhone behaviour remains a separate gate. Evidence is saved in the existing delivery folder; failed attempts remain labelled as failures.
