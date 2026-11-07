# Pending first-run setup preserves Account —25 October2026

Source candidate from production593 /5fada632d1dde47fda0df57da126cb618a4f72ce. Ready HOLD for DEPLOY review and its new594 release qualification. No shared data, main push or deployment by this worker.

## Failure and cause

Two hosted account attempts on593 stopped before full acceptance. The first reached a bookkeeping-only setup precondition with different private notification prompt times; its harness-only correction remains separate. The next stopped finding the second native email field. A preceding local replay also lost the password field. Those hosted/local failures remain retained; their complete original timing was not captured.

A deterministic actual-app loopback reproduction isolates another real UI defect. Startup checks `onboardingComplete:false` and schedules first-run Settings after two animation frames. Before that pending action executes, a person can open Account and type, or the disposable QA setup can complete onboarding. The stale callback then unconditionally opens first-run Settings, replaces Account with Set up your Feed, and removes the filled sign-in form. Its actual recorded caller is `runStartupPostLoadActions` → `openFirstRunSettingsAfterFeedAlignment` → `openSettings({firstRun:true})`. Preferences and auth generation remain unchanged; no outside response occurs. This is a source defect matching disappearing fields, not proof that it caused each uncaptured hosted timeout or the physical iPhone sync failure.

## Bounded correction

At the final existing animation frame, recheck current onboarding completion and whether Settings is already open. Automatic setup opens only while still needed and no current Settings journey would be replaced. Both existing animation frames remain. Direct explicit `openSettings({firstRun:true})` remains available. No new timer, loader, helper, request, state store, session/sync owner, preference comparison, merge or account policy is introduced.

The earlier deferred Account-helper fix remains byte-identical: helper mount preserves existing form/input nodes and focus. This correction addresses the separate stale first-run action rather than changing that helper again.

## Regression and qualification

The existing `helper-mount` recovery case now holds only the real already-scheduled first-run callback, then uses the normal local guest setup and native Account fields. After native typing it captures the actual form/input nodes and focus, releases that same callback, and requires those nodes, valid filled inputs, Account section, choices and auth generation to remain. It also confirms explicit first-run setup can still open. The original reload and held-helper race still execute; the exact filled form used for its following native submit must additionally survive a delayed completed-setup callback. Exactly one password-sign-in request remains required. No scenario, original assertion, timeout or full recovery case is removed.

- New permanent regression against exact old5fada source: expected RED at the retained-form assertion, before original sign-in; outside responses0 and browser/server closed.
- Corrected Chromium and WebKit `helper-mount`: PASS including first-run form retention, original deferred-helper form retention, native submit, one actual routed password-sign-in request, successful state hydration, zero uncaught app errors and zero outside responses. A disposable transport adapter adds only the established owned deny proxy to this existing loopback test; it is not product or permanent QA framework code.
- Existing startup-budget validator adds four actual-function controls with state changed between its two real callback stages: untouched unfinished cold setup opens; newly completed setup stays closed; newly opened Account stays open; completed/open Account stays open. Existing shell/first-page checks pass (142 assets,2.99MiB required cache).
- Static performance budget passes:7 critical requests,1.21% gzip growth under unchanged1.25% cap. No new runtime timing claim follows.

Evidence under `/Users/jackhartican/Documents/AI/Codex/ios-account-sync-20261024/deploy-v593/native-form-diagnosis/` retains the initial scheduling-probe readiness failure and a partial GREEN observer failure (the ad-hoc probe captured a null form before async configuration). Neither is accepted as a full pass. A later WebKit fixture-ordering failure is also retained: private setup completed before startup had queued the action. The final regression waits for the actual queued action while setup is still incomplete, then marks completion and captures nodes after native fills. Its final old-source RED and both-engine GREEN receipts are definitive. All owned local browser/server/PID/port cleanup is recorded; no live credentials or accounts were accessed.

## DEPLOY boundary

Only the existing startup callback changes in product source. Remaining changes extend two existing validators and add this evidence record. Generated/runtime/helper/worker/version files, both workflows, account/receipt/CAS/ACK/R2/owner-generation guards, OFF/empty/unfollow rules and the separate hosted setup-stamp candidate remain unchanged.

DEPLOY owns same-pair source review, new594 version/cache rebuild, complete installed/offline/40-case recovery and normal/native/public/repeated/hosted gates before any further phone request. Existing593 normal/repeated/security/A-League passes do not certify this changed source. Full hosted/P1 and actual Home Screen sync acceptance remain open. Rollback is a DEPLOY-owned code revert to its prior exact snapshot; no data inverse is required. Stop Ready HOLD.
